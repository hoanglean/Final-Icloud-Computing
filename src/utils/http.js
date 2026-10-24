const { layout } = require('../views/layout');
function redirect(res, target) { res.writeHead(303, { Location: target }); res.end(); }
function send(res, title, content, user, session, status = 200, currentPath = '') {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(layout(title, content, user, session, currentPath));
}
async function readForm(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 8192) throw new Error('FORM_TOO_LARGE'); }
  return Object.fromEntries(new URLSearchParams(body));
}

module.exports = { redirect, send, readForm };
