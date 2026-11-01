require('./config/env').loadEnv();
const { createApp } = require('./app');

createApp().then(server => {
  const host = process.env.HOST || '0.0.0.0';
  const port = Number(process.env.PORT || 3000);
  server.listen(port, host, () => {
    console.log(`Kho Viet: http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}`);
  });
}).catch(error => {
  console.error(`Không thể khởi động ứng dụng (${error.code || 'DATABASE_ERROR'}). Kiểm tra kết nối và migration cơ sở dữ liệu.`);
  process.exitCode = 1;
});
