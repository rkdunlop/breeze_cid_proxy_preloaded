require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cache = require("./lib/cache");
const app = express();

const normalizePhone = (num) =>
  num.replace(/[^\d]/g, "").replace(/^1?(\d{10})$/, "1$1");

// Preload people on startup
async function preloadPeople() {
  try {
    console.log("Preloading Breeze contacts...");

    const filter = { 883493060: "*" };
    const encodedFilter = encodeURIComponent(JSON.stringify(filter));

    const { data } = await axios.get(
      `https://${process.env.BREEZE_SUBDOMAIN}.breezechms.com/api/people?details=1&filter_json=${encodedFilter}`,
      {
        headers: { "Api-Key": process.env.BREEZE_API_KEY },
      }
    );

    let count = 0;

    for (const person of data) {
      const name = `${person.first_name} ${person.last_name}`;
      const details = person.details.details;
      //const details = person.details || {};
      //const numbers = [details.mobile, details.home, details.work];
    }

    console.log(`Cached ${count} phone numbers from Breeze.`);
  } catch (err) {
    console.error("Failed to preload Breeze contacts:", err.message);
  }
}

// Lookup endpoint
app.get("/lookup/:number", (req, res) => {
  const phone = normalizePhone(req.params.number || "");
  if (!phone) return res.status(400).json({ error: "Invalid phone number" });

  const entry = cache.get(phone);
  if (entry) {
    res.json({ source: "cache", ...entry });
  } else {
    res.status(404).json({ error: "No match found" });
  }
});

// Manual refresh endpoint
app.post("/refresh", async (req, res) => {
  await preloadPeople();
  res.json({ message: "Cache refreshed" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await preloadPeople();
  console.log(`Breeze CID Proxy running on port ${PORT}`);
});
