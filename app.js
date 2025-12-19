require('dotenv').config();
const fs = require('fs');
const path = require('path');
const CACHE_FILE = path.join(__dirname, 'cache.json');
const express = require('express');
const cache = require('./lib/cache');
const breezeClient = require('./lib/breezeClient');
const app = express();

let refreshInProgress = false;

let lastPreloadAt = null;
let lastPreloadError = null;
let isReady = false;
let isFirstStarup = true;

function loadCacheFromDisk() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return false;

    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const data = JSON.parse(raw);

    if (typeof data !== 'object' || !data.entries) {
      throw new Error('Invalid cache format');
    }
    cache.clear();
    for (const [phone, entry] of Object.entries(data.entries)) {
      cache.set(phone, entry);
    }

    lastPreloadAt = new Date(data.savedAt);
    isReady = cache.size() > 0;

    console.log(`Loaded ${cache.size()} entries from disk cache`);
    return true;
  } catch (err) {
    console.log('Failed to load disk cache:', err.message);
    return false;
  }
}

function saveCacheToDisk() {
  try {
    const tmpFile = `${CACHE_FILE}.tmp`;

    const payload = {
      savedAt: new Date().toISOString(),
      entries: cache.entries(),
    };

    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2));
    fs.renameSync(tmpFile, CACHE_FILE);

    console.log(`Saved ${cache.size()} entries to disk cache`);
  } catch (err) {
    console.error('Failed to save disk cache:', err.message);
  }
}

const normalizePhone = (num) => {
  if (!num) return null;
  return String(num)
    .replace(/[^\d]/g, '')
    .replace(/^1?(\d{10})$/, '1$1');
};

// Preload people on startup
async function preloadPeople() {
  if (refreshInProgress) {
    console.log('Refresh already in progress, skipping');
    return;
  }

  refreshInProgress = true;

  try {
    console.log('Preloading Breeze contacts...');

    const filter = { 883493060: '*' };
    const encodedFilter = encodeURIComponent(JSON.stringify(filter));

    const { data } = await breezeClient.get(`/people?details=1&filter_json=${encodedFilter}`);
    let count = 0;

    const PHONE_KEYS = ['home', 'mobile', 'work'];

    for (const person of data) {
      const name = `${person.first_name} ${person.last_name}`;
      const details = person.details.details || {};

      const phones = new Set();

      for (const key of PHONE_KEYS) {
        const raw = details[key];
        const phone = normalizePhone(raw);
        if (phone) phones.add(phone);
      }

      for (const phone of phones) {
        cache.set(phone, { name });
        count++;
      }
    }

    if (cache.size() === 0) {
      throw new Error('Cache empty after preload');
    }

    saveCacheToDisk();

    console.log(`Cached ${count} phone numbers from Breeze.`);
    lastPreloadAt = new Date();
    lastPreloadError = null;
    isReady = cache.size() > 0;

    isFirstStarup = false;
  } catch (err) {
    console.error('Failed to preload Breeze contacts:', err.message);
    lastPreloadError = err.message;
    isReady = false;

    if (isFirstStarup) {
      console.error('Startup preload failed - exiting for PM2 restart');
      process.exit(1);
    }
  } finally {
    refreshInProgress = false;
  }
}

// Lookup endpoint
app.get('/lookup/:number', (req, res) => {
  const phone = normalizePhone(req.params.number || '');
  if (!phone) return res.status(400).json({ error: 'Invalid phone number' });

  const entry = cache.get(phone);
  if (entry) {
    res.type('text/plain').send(entry.name);
  } else {
    res.status(404).json({ error: 'No match found' });
  }
});

// Cache inspection endpoint
app.get('/cache', (req, res) => {
  res.json(cache.entries());
});

// Manual refresh endpoint
app.post('/refresh', async (req, res) => {
  await preloadPeople();
  res.json({ message: 'Cache refreshed' });
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: lastPreloadError ? 'degraded' : 'ok',
    cacheSize: cache.size(),
    lastPreloadAt,
    refreshInProgress,
    error: lastPreloadError,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Ready endpoing
app.get('/ready', (req, res) => {
  if (!isReady) {
    return res.status(503).json({
      status: 'not-ready',
      cacheSize: cache.size(),
      lastPreloadAt,
    });
  }

  res.json({
    status: 'ready',
    cacheSize: cache.size(),
    lastPreloadAt,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Breeze CID Proxy starting on port ${PORT}`);

  const loadedFromDisk = loadCacheFromDisk();

  if (!loadedFromDisk) {
    console.log('No disk cache found, loading from Breeze...');
  }

  await preloadPeople();

  // Auto-refresh every N hours
  const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

  setInterval(() => {
    console.log('Auto-refresh triggered');
    preloadPeople();
  }, REFRESH_INTERVAL_MS);

  console.log(`Breeze CID Proxy running on port ${PORT}`);
});
