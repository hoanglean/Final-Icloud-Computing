function invalid(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function text(value, label, max, { multiline = false } = {}) {
  let result = (value || '').trim();
  if (multiline) result = result.replace(/\r\n?/g, '\n');
  const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (!result || [...result].length > max || controls.test(result)) invalid(`${label} cần từ 1 đến ${max} ký tự và không chứa ký tự điều khiển.`);
  return result;
}

function recordId(value, label = 'Mã') {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) invalid(`${label} không hợp lệ.`);
  return Number(value);
}

function activeValue(value) {
  if (!['true', 'false'].includes(value)) invalid('Trạng thái không hợp lệ.');
  return value === 'true';
}

function price(value) {
  const result = (value || '').trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(result)) invalid('Giá cơ sở phải không âm, tối đa 12 chữ số và 2 chữ số thập phân.');
  return result;
}

module.exports = { invalid, text, recordId, activeValue, price };
