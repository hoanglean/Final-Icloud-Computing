const fs = require('node:fs');
const path = require('node:path');

function loadEnv() {
  const file = path.join(__dirname, '../../.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

module.exports = { loadEnv };
