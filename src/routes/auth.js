const { redirect, send, readForm } = require('../utils/http');
const { roleHome } = require('../config/roles');
const { hashPassword, matches } = require('../services/password');
const { sessions, newSession, destroySession } = require('../services/session');
const { loginPage } = require('../views/auth/login');
const { passwordPage } = require('../views/auth/change-password');

async function authRoutes(req, res, context) {
  const { url, id, session, user, users, userRepository, attempts, dummyHash } = context;
        if (!(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) { res.writeHead(415); return res.end('Unsupported form'); }
        const form = await readForm(req);
        if (form.csrf !== session.csrf) return send(res,'Yêu cầu không hợp lệ','<main class="workspace"><h1>Phiên biểu mẫu không hợp lệ</h1><p>Hãy tải lại trang và thử lại.</p><a href="/">Về trang chủ</a></main>',user,session,403);
        if (url.pathname === '/login') {
          if(user) return redirect(res,roleHome(user.role));
          const email = (form.email || '').trim().toLowerCase();
          const password = form.password || '';
          const key = req.socket.remoteAddress;
          let attempt = attempts.get(key);
          if(!attempt || attempt.until < Date.now()) { attempt={count:0,until:Date.now()+15*60000}; attempts.set(key,attempt); }
          if(attempt.count >= 10) return send(res,'Đăng nhập',loginPage(session,'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.',email),null,session,429);
          attempt.count++;
          const found = users.find(u=>u.email === email);
          const valid = await matches(password.slice(0,128),found?.passwordHash || dummyHash);
          if(!valid || password.length > 128 || !found?.isActive || !['admin','staff'].includes(found.role)) return send(res,'Đăng nhập',loginPage(session,'Email hoặc mật khẩu không đúng.',email),null,session,401);
          attempts.delete(key); sessions.delete(id); newSession(res,found); return redirect(res,roleHome(found.role));
        }
        if(!user) return redirect(res,'/login');
        if(url.pathname === '/logout') {
          destroySession(res, id); return redirect(res,'/login');
        }
        if(url.pathname === '/change-password') {
          let error = '';
          const current = form.currentPassword || '', next = form.newPassword || '';
          const oldHash = user.passwordHash;
          const key = `password:${user.id}`;
          let attempt = attempts.get(key);
          if(!attempt || attempt.until < Date.now()) { attempt={count:0,until:Date.now()+15*60000}; attempts.set(key,attempt); }
          if(attempt.count >= 10) return send(res,'Đổi mật khẩu',passwordPage(session,'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.'),user,session,429);
          attempt.count++;
          if(current.length > 128 || !(await matches(current,oldHash))) error='Mật khẩu hiện tại không đúng.';
          else if(next.length < 8 || next.length > 128 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/[0-9]/.test(next)) error='Mật khẩu mới cần 8–128 ký tự, có chữ hoa, chữ thường và số.';
          else if(next !== form.confirmPassword) error='Hai mật khẩu mới không trùng khớp.';
          else if(next === current) error='Mật khẩu mới phải khác mật khẩu hiện tại.';
          if(error) return send(res,'Đổi mật khẩu',passwordPage(session,error),user,session,400);
          const passwordHash = await hashPassword(next);
          // Compare and update atomically so concurrent changes cannot overwrite a newer password.
          if (!(await userRepository.changePassword(user.id, oldHash, passwordHash))) return redirect(res,'/login');
          attempts.delete(key);
          for(const [sid,s] of sessions) if(s.userId===user.id) sessions.delete(sid);
          destroySession(res, id);
          return redirect(res,'/login?changed=1');
        }
  res.writeHead(404);
  res.end('Không tìm thấy thao tác.');
}
module.exports = { authRoutes };
