require("dotenv").config();
const express = require("express");
const cache = require("./lib/cache");
const breezeClient = require("./lib/breezeClient");
const app = express();

let lastPreloadAt = null;
let lastPreloadError = null;
let isReady = false;
let isFirstStarup = true;

const PHONE_FIELDS = new Set(["phone", "mobile", "work"]);

const normalizePhone = (num) => {
  if (!num) return null;
  return String(num)
    .replace(/[^\d]/g, "")
    .replace(/^1?(\d{10})$/, "1$1");
};

// Preload people on startup
async function preloadPeople() {
  try {
    console.log("Preloading Breeze contacts...");

    const filter = { 883493060: "*" };
    const encodedFilter = encodeURIComponent(JSON.stringify(filter));

    const { data } = await breezeClient.get(
      `/people?details=1&filter_json=${encodedFilter}`
    );
    let count = 0;

    const PHONE_KEYS = ["home", "mobile", "work"];

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

    console.log("cache.size():");

    console.log(`Cached ${count} phone numbers from Breeze.`);
    let lastPreloadAt = new Date();
    let lastPreloadError = null;
    isReady = Object.keys(cache.entries()).length > 0;
    if (Object.keys(cache.entries()).length === 0) {
      throw new Error("Cache empty after preload");
    }
    let isFirstStarup = false;
  } catch (err) {
    console.error("Failed to preload Breeze contacts:", err.message);
    lastPreloadError = err.message;
    isReady = false;

    if (isFirstStarup) {
      console.error("Startup preload failed - exiting for PM2 restart");
      process.exit(1);
    }
  }
}

// Lookup endpoint
app.get("/lookup/:number", (req, res) => {
  const phone = normalizePhone(req.params.number || "");
  if (!phone) return res.status(400).json({ error: "Invalid phone number" });

  const entry = cache.get(phone);
  if (entry) {
    res.type("text/plain").send(entry.name);
  } else {
    res.status(404).json({ error: "No match found" });
  }
});

// Cache inspection endpoint
app.get("/cache", (req, res) => {
  res.json(cache.entries());
});

// Manual refresh endpoint
app.post("/refresh", async (req, res) => {
  await preloadPeople();
  res.json({ message: "Cache refreshed" });
});

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: lastPreloadError ? "degraded" : "ok",
    cacheSize: Object.keys(cache.entries()).length,
    lastPreloadAt,
    error: lastPreloadError,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Ready endpoing
app.get("/ready", (req, res) => {
  if (!isReady) {
    return res.status(503).json({
      status: "not-ready",
      cacheSize: cache.entries().length,
      lastPreloadAt,
    });
  }

  res.json({
    status: "ready",
    cacheSize: cache.entries().length,
    lastPreloadAt,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await preloadPeople();
  console.log(`Breeze CID Proxy running on port ${PORT}`);
});
