
const cache = {};
const TTL = 24 * 60 * 60 * 1000; // 24 hours

function set(key, value) {
  cache[key] = { value, expires: Date.now() + TTL };
}

function get(key) {
  const entry = cache[key];
  if (entry && entry.expires > Date.now()) {
    return entry.value;
  } else {
    delete cache[key];
    return null;
  }
}

function entries() {
  const now = Date.now();
  const active = {};

  for (const [key, entry] of Object.entries(cache)) {
    if (entry.expires > now) {
      active[key] = entry.value;
    } else {
      delete cache[key];
    }
  }

  return active;
}

module.exports = { set, get, entries };
