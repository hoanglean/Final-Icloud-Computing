const crypto = require('node:crypto');
const sessions = new Map();
const ttl = 2 * 60 * 60 * 1000;
function newSession(res, user = null) {
  const id = crypto.randomBytes(32).toString('hex');
  const session = { userId: user?.id, version: user?.version, csrf: crypto.randomBytes(32).toString('hex'), expires: Date.now() + ttl };
  sessions.set(id, session);
  res.setHeader('Set-Cookie', `inventory.sid=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200`);
  return { id, session };
}

function destroySession(res, id) {
  sessions.delete(id);
  res.setHeader('Set-Cookie', 'inventory.sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}
module.exports = { sessions, newSession, destroySession };
