const navigation = [
  { title: 'Sản phẩm', items: [
    { path: '/products', label: 'Sản phẩm', icon: 'box', description: 'Tra cứu, tìm kiếm và lọc sản phẩm, xem giá bán và số lượng tồn kho.' },
    { path: '/categories', label: 'Danh mục', icon: 'grid', adminOnly: true, description: 'Tạo và cập nhật danh mục sản phẩm.' }
  ] },
  { title: 'Kho hàng', items: [
    { path: '/inventory/receive', label: 'Nhập kho', icon: 'in', adminOnly: true, description: 'Ghi nhận hàng nhập và cập nhật số lượng tồn kho.' },
    { path: '/inventory/adjust', label: 'Kiểm kê, điều chỉnh', icon: 'adjust', adminOnly: true, description: 'Điều chỉnh chênh lệch tồn kho sau kiểm kê, kèm lý do.' },
    { path: '/inventory/history', label: 'Lịch sử kho', icon: 'history', adminOnly: true, description: 'Theo dõi toàn bộ lịch sử nhập, bán, hoàn trả và điều chỉnh tồn kho.' },
    { path: '/inventory/low-stock', label: 'Cảnh báo tồn thấp', icon: 'alert', description: 'Theo dõi các sản phẩm sắp hết hàng.' }
  ] },
  { title: 'Bán hàng', items: [
    { path: '/sales', label: 'Bán hàng', icon: 'cart', staffOnly: true, description: 'Ghi nhận giao dịch bán theo giá hiện tại và số lượng hàng còn trong kho.' },
    { path: '/sales/history', label: 'Lịch sử bán của tôi', icon: 'history', staffOnly: true, description: 'Tra cứu các giao dịch bán hàng do bạn thực hiện.' }
  ] },
  { title: 'Trả hàng và hàng hỏng', items: [
    { path: '/requests/return', label: 'Yêu cầu trả hàng', icon: 'return', description: 'Gửi yêu cầu trả hàng từ giao dịch bán gốc để quản trị viên xem xét.' },
    { path: '/requests/damage', label: 'Báo hàng hỏng', icon: 'alert', description: 'Gửi yêu cầu xử lý hàng hỏng, kèm số lượng và lý do.' },
    { path: '/requests', label: 'Yêu cầu của tôi', adminLabel: 'Duyệt yêu cầu', icon: 'check', description: 'Theo dõi trạng thái các yêu cầu trả hàng và hàng hỏng của bạn.', adminDescription: 'Xem toàn bộ yêu cầu trả hàng và hàng hỏng để duyệt hoặc từ chối.' }
  ] },
  { title: 'Quản trị', items: [
    { path: '/admin/sales-history', label: 'Lịch sử bán hàng nhân viên', icon: 'history', adminOnly: true, description: 'Xem lịch sử bán hàng của các nhân viên trong cửa hàng.' },
    { path: '/pricing', label: 'Quy tắc định giá', icon: 'tag', adminOnly: true, description: 'Cấu hình giá cơ sở, ngưỡng tồn kho, mức tăng giảm và tính lại giá.' },
    { path: '/pricing/history', label: 'Lịch sử giá', icon: 'history', adminOnly: true, description: 'Theo dõi các lần thay đổi giá và nguyên nhân thay đổi.' },
    { path: '/reports', label: 'Báo cáo, thống kê', icon: 'chart', adminOnly: true, description: 'Theo dõi doanh thu sau hoàn trả, tồn kho và biến động giá.' },
    { path: '/users', label: 'Quản lý tài khoản', icon: 'users', adminOnly: true, description: 'Tạo tài khoản, thay đổi vai trò và khóa tài khoản người dùng.' }
  ] }
];

module.exports = { navigation };
