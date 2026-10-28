const fs = require('node:fs');
const path = require('node:path');

async function applySchema(db) {
  const directory = path.join(__dirname, '../../database/migrations');
  for (const file of fs.readdirSync(directory).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    await db.exec(fs.readFileSync(path.join(directory, file), 'utf8'));
  }
}

module.exports = { applySchema };
