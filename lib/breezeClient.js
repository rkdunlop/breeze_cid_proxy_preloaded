const axios = require("axios");
const rateLimit = require("axios-rate-limit");

const breezeClient = rateLimit(
  axios.create({
    baseURL: `https://${process.env.BREEZE_SUBDOMAIN}.breezechms.com/api`,
    headers: { "Api-Key": process.env.BREEZE_API_KEY },
    timeout: 60000,
  }),
  {
    maxRequests: 1,
    perMilliseconds: 3500,
  }
);

module.exports = breezeClient;
