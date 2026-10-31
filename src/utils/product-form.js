const { readForm } = require('./http');
const { invalid } = require('./validation');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

async function readProductForm(req) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) return { form: await readForm(req), imageFile: null };
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) invalid('Biểu mẫu không được hỗ trợ.', 415);
  const maxBody = MAX_IMAGE_BYTES + 16384;
  if (Number(req.headers['content-length']) > maxBody) {
    req.resume();
    invalid('Ảnh tối đa 2 MB. Hãy chọn tệp nhỏ hơn.', 413);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBody) {
      req.resume();
      invalid('Ảnh tối đa 2 MB. Hãy chọn tệp nhỏ hơn.', 413);
    }
    chunks.push(chunk);
  }
  let data;
  try {
    data = await new Response(Buffer.concat(chunks), { headers: { 'content-type': contentType } }).formData();
  } catch {
    invalid('Biểu mẫu tải ảnh không hợp lệ. Hãy tải lại trang.');
  }
  const form = {};
  let imageFile = null, fieldBytes = 0;
  const seen = new Set();
  for (const [key, value] of data) {
    if (seen.has(key)) invalid('Biểu mẫu có trường bị lặp. Hãy tải lại trang.');
    seen.add(key);
    if (typeof value === 'string') {
      fieldBytes += Buffer.byteLength(key) + Buffer.byteLength(value);
      if (fieldBytes > 8192) invalid('Nội dung biểu mẫu quá dài.', 413);
      Object.defineProperty(form, key, { value, enumerable: true });
    } else {
      if (key !== 'image') invalid('Trường tải ảnh không hợp lệ.');
      if (value.size > MAX_IMAGE_BYTES) invalid('Ảnh tối đa 2 MB. Hãy chọn tệp nhỏ hơn.', 413);
      if (value.size || value.name) imageFile = value;
    }
  }
  return { form, imageFile };
}

module.exports = { readProductForm, MAX_IMAGE_BYTES };
