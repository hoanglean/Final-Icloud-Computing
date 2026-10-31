const sharp = require('sharp');
const { invalid } = require('../utils/validation');
const { MAX_IMAGE_BYTES } = require('../utils/product-form');

async function prepareProductImage(file) {
  if (!file.size) invalid('Tệp ảnh trống. Hãy chọn một ảnh khác.');
  if (file.size > MAX_IMAGE_BYTES) invalid('Ảnh tối đa 2 MB. Hãy chọn tệp nhỏ hơn.', 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) invalid('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
  try {
    // Decode and re-encode uploads, discarding metadata and bounding pixel/memory use.
    const image = await sharp(bytes, { limitInputPixels: 16000000, failOn: 'warning' })
      .rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
    if (image.length > MAX_IMAGE_BYTES) invalid('Ảnh sau xử lý quá lớn. Hãy chọn ảnh nhỏ hơn.', 413);
    return image;
  } catch (error) {
    if (error.status) throw error;
    invalid('Ảnh bị hỏng hoặc kích thước quá lớn. Hãy chọn ảnh khác.');
  }
}

module.exports = { prepareProductImage };
