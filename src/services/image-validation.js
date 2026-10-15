const { crc32 } = require('node:zlib');
const { ValidationError } = require('./validation');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 20;
const IMAGE_TYPES = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });
const invalid = () => { throw new ValidationError('Formato de imagem não permitido ou arquivo danificado. Use JPEG, PNG ou WebP.'); };
function dimensions(width, height) {
  if (!width || !height || width > 10000 || height > 10000 || width * height > 40000000) throw new ValidationError('Esta imagem tem resolução muito alta. Escolha uma foto de até 40 megapixels e 10000 pixels por lado.');
}
function png(buffer) {
  let offset = 8, hasData = false, hasHeader = false;
  while (offset + 12 <= buffer.length) {
    const size = buffer.readUInt32BE(offset), end = offset + 12 + size;
    if (end > buffer.length) invalid();
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (buffer.readUInt32BE(end - 4) !== crc32(buffer.subarray(offset + 4, end - 4))) invalid();
    if (!hasHeader) {
      if (type !== 'IHDR' || size !== 13) invalid();
      dimensions(buffer.readUInt32BE(offset + 8), buffer.readUInt32BE(offset + 12));
      const depths = { 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] };
      if (!depths[buffer[offset + 17]]?.includes(buffer[offset + 16]) || buffer[offset + 18] !== 0 || buffer[offset + 19] !== 0 || buffer[offset + 20] > 1) invalid();
      hasHeader = true;
    } else if (type === 'IHDR') invalid();
    if (type === 'acTL') throw new ValidationError('Escolha uma imagem sem animação.');
    if (type === 'IDAT' && size > 0) hasData = true;
    if (type === 'IEND') { if (size !== 0 || !hasData || end !== buffer.length) invalid(); return; }
    offset = end;
  }
  invalid();
}
function jpeg(buffer) {
  if (buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) invalid();
  let offset = 2, hasFrame = false;
  while (offset + 4 < buffer.length) {
    if (buffer[offset++] !== 0xff) invalid();
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xda) { if (!hasFrame || buffer.readUInt16BE(offset) < 6 || offset + buffer.readUInt16BE(offset) >= buffer.length - 2) invalid(); return; }
    if ([0x00, 0xd8, 0xd9].includes(marker) || marker >= 0xd0 && marker <= 0xd7) invalid();
    if (offset + 2 > buffer.length) invalid();
    const size = buffer.readUInt16BE(offset);
    if (size < 2 || offset + size > buffer.length) invalid();
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (size < 8 || buffer[offset + 2] !== 8 || ![1,3,4].includes(buffer[offset + 7]) || size !== 8 + 3 * buffer[offset + 7]) invalid();
      dimensions(buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)); hasFrame = true;
    }
    offset += size;
  }
  invalid();
}
function webp(buffer) {
  if (buffer.readUInt32LE(4) + 8 !== buffer.length) invalid();
  let offset = 12, hasPixels = false;
  while (offset + 8 <= buffer.length) {
    const kind = buffer.toString('ascii', offset, offset + 4), size = buffer.readUInt32LE(offset + 4), data = offset + 8;
    const end = data + size + (size % 2);
    if (end > buffer.length) invalid();
    if (kind === 'VP8X') {
      if (size !== 10) invalid();
      if (buffer[data] & 2) throw new ValidationError('Escolha uma imagem sem animação.');
      dimensions(1 + buffer.readUIntLE(data + 4, 3), 1 + buffer.readUIntLE(data + 7, 3));
    }
    if (kind === 'VP8 ') {
      if (size < 10 || buffer[data] & 1 || !buffer.subarray(data + 3, data + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) invalid();
      dimensions(buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff); hasPixels = true;
    }
    if (kind === 'VP8L') {
      if (size < 5 || buffer[data] !== 0x2f) invalid();
      const bits = buffer.readUInt32LE(data + 1);
      if (bits >>> 29) invalid();
      dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); hasPixels = true;
    }
    if (kind === 'ANIM' || kind === 'ANMF') throw new ValidationError('Escolha uma imagem sem animação.');
    offset = end;
  }
  if (!hasPixels || offset !== buffer.length) invalid();
}
function validateImage(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || !IMAGE_TYPES[mime]) invalid();
  if (buffer.length > MAX_IMAGE_BYTES) throw new ValidationError('Esta imagem é muito grande. O limite é 5 MiB por foto.');
  try {
    if (buffer.length >= 33 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { if (mime !== 'image/png') invalid(); png(buffer); }
    else if (buffer.length >= 20 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) { if (mime !== 'image/jpeg') invalid(); jpeg(buffer); }
    else if (buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') { if (mime !== 'image/webp') invalid(); webp(buffer); }
    else invalid();
  } catch (error) { if (error instanceof ValidationError) throw error; invalid(); }
  return IMAGE_TYPES[mime];
}
module.exports = { validateImage, MAX_IMAGE_BYTES, MAX_IMAGES, IMAGE_TYPES };
