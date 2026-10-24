const { redirect, send } = require('../utils/http');
const { roleHome } = require('../config/roles');
const { hasRole } = require('../middleware/auth');
const { loginPage } = require('../views/auth/login');
const { passwordPage } = require('../views/auth/change-password');
const { homePage } = require('../views/dashboard/home');
const { navigation } = require('../config/navigation');
const { escape } = require('../utils/html');

function pageRoutes(req, res, { url, user, session }) {
      const respond = (title, content, status = 200) => send(res, title, content, user, session, status, url.pathname);
      if(req.method !== 'GET') { res.writeHead(405); return res.end('Method not allowed'); }
      if(url.pathname === '/login') {
        if(user) return redirect(res,roleHome(user.role));
        const message = url.searchParams.get('changed') === '1' ? '<div class="alert success" role="status">Đổi mật khẩu thành công. Hãy đăng nhập lại.</div>' : '';
        return send(res,'Đăng nhập',loginPage(session).replace('<form method="post" action="/login">',message+'<form method="post" action="/login">'),null,session);
      }
      if(!user) return redirect(res,'/login');
      if(url.pathname === '/') return redirect(res,roleHome(user.role));
      if(url.pathname === '/admin' && !hasRole(user, 'admin')) return send(res,'Không có quyền','<main class="workspace"><p class="eyebrow">403 · GIỚI HẠN TRUY CẬP</p><h1>Bạn không có quyền vào trang quản trị.</h1><a class="button" href="/staff">Về trang nhân viên →</a></main>',user,session,403);
      if(url.pathname === '/admin' || url.pathname === '/staff') return respond(url.pathname === '/admin' ? 'Trang quản trị' : 'Trang nhân viên',homePage(user));
      if(url.pathname === '/change-password') return respond('Đổi mật khẩu',passwordPage(session));
      const item = navigation.flatMap(group => group.items).find(item => item.path === url.pathname);
      if (item) {
        if ((item.adminOnly && !hasRole(user, 'admin')) || (item.staffOnly && user.role !== 'staff')) return respond('Không có quyền', '<main class="workspace"><p class="eyebrow">403 · GIỚI HẠN TRUY CẬP</p><h1>Bạn không có quyền sử dụng chức năng này.</h1><a class="text-link" href="/">Về trang chủ →</a></main>', 403);
        const admin = user.role === 'admin';
        const title = admin && item.adminLabel ? item.adminLabel : item.label;
        const description = admin && item.adminDescription ? item.adminDescription : item.description;
        return respond(title, `<main class="workspace"><p class="eyebrow">${admin ? 'KHÔNG GIAN QUẢN TRỊ' : 'KHÔNG GIAN NHÂN VIÊN'}</p><div class="page-title"><div><h1>${escape(title)}</h1><p class="muted">${escape(description)}</p></div></div><section class="module-placeholder"><span class="pill">ĐANG PHÁT TRIỂN</span><h2>Chức năng sẽ sớm được bổ sung</h2><p>Trang này hiện dùng để điều hướng. Nghiệp vụ và dữ liệu sẽ được triển khai ở bước tiếp theo.</p></section></main>`);
      }
      return send(res,'Không tìm thấy','<main class="workspace"><h1>Không tìm thấy trang</h1><a href="/">Về trang chủ</a></main>',user,session,404);

}
module.exports = { pageRoutes };
