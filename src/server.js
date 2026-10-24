require('./config/env').loadEnv();
const { createApp } = require('./app');

createApp().then(server => {
  server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => {
    console.log(`Kho Viet: http://localhost:${server.address().port}`);
  });
}).catch(error => {
  console.error(`Không thể khởi động ứng dụng (${error.code || 'DATABASE_ERROR'}). Kiểm tra kết nối và migration cơ sở dữ liệu.`);
  process.exitCode = 1;
});
