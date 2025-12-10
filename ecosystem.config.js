
module.exports = {
  apps: [{
    name: "breeze-cid-proxy",
    script: "app.js",
    watch: false,
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};
