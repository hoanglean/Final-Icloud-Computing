const { sessions, newSession } = require('../services/session');
function resolveAuth(req, res, users) {
      const cookie = /(?:^|;\s*)inventory\.sid=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
      let id = cookie?.[1], session = sessions.get(id);
      if (!session || session.expires < Date.now()) { if(id) sessions.delete(id); ({id,session}=newSession(res)); }
      const user = users.find(u => u.id === session.userId && u.isActive && u.version === session.version && ['admin','staff'].includes(u.role));
  return { id, session, user };
}
function hasRole(user, role) {
  return Boolean(user && (user.role === 'admin' || user.role === role));
}
module.exports = { resolveAuth, hasRole };
