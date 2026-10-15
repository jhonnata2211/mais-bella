const { crc32 } = require('node:zlib');
const { validateImage } = require('./image-validation');
const { ValidationError } = require('./validation');
const invalid = () => { throw new ValidationError('Não foi possível preparar esta foto com segurança. Exporte-a como JPEG, PNG ou WebP e tente novamente.'); };

// Reconstrói EXIF apenas com orientação. Não copia GPS, autor, aparelho, datas,
// thumbnails, MakerNote, ponteiros de sub-IFDs ou outros bytes do bloco original.
function orientationOnly(data) {
  const tiff = data.subarray(data.subarray(0, 6).equals(Buffer.from('Exif\0\0')) ? 6 : 0);
  if (tiff.length < 8) invalid();
  const order = tiff.toString('latin1', 0, 2);
  if (!['II', 'MM'].includes(order)) invalid();
  const u16 = offset => order === 'II' ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const u32 = offset => order === 'II' ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);
  if (u16(2) !== 42) invalid();
  const offset = u32(4);
  if (offset < 8 || offset + 2 > tiff.length) invalid();
  const count = u16(offset);
  if (offset + 2 + 12 * count + 4 > tiff.length) invalid();
  let orientation = 1, found = false;
  for (let i = 0; i < count; i++) {
    const entry = offset + 2 + i * 12;
    if (u16(entry) !== 0x0112) continue;
    if (found || u16(entry + 2) !== 3 || u32(entry + 4) !== 1) invalid();
    found = true; orientation = u16(entry + 8);
    if (orientation < 1 || orientation > 8) invalid();
  }
  if (orientation === 1) return null;
  const clean = Buffer.alloc(26); clean.write('II'); clean.writeUInt16LE(42, 2); clean.writeUInt32LE(8, 4);
  clean.writeUInt16LE(1, 8); clean.writeUInt16LE(0x0112, 10); clean.writeUInt16LE(3, 12); clean.writeUInt32LE(1, 14); clean.writeUInt16LE(orientation, 18);
  return clean;
}
function jpegSegment(marker, data) {
  const header = Buffer.from([0xff, marker, 0, 0]); header.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([header, data]);
}
function cleanJPEG(input) {
  const parts = [input.subarray(0, 2)]; let offset = 2, entropy = false, exifSeen = false;
  while (offset < input.length) {
    if (entropy) {
      const start = offset;
      while (offset < input.length) {
        if (input[offset] !== 0xff) { offset++; continue; }
        let next = offset + 1;
        while (input[next] === 0xff) next++;
        if (input[next] === 0 || input[next] >= 0xd0 && input[next] <= 0xd7) { offset = next + 1; continue; }
        break;
      }
      parts.push(input.subarray(start, offset)); entropy = false;
    }
    if (input[offset] !== 0xff) invalid();
    const start = offset++;
    while (input[offset] === 0xff) offset++;
    const marker = input[offset++];
    if (marker === 0xd9) {
      if (offset !== input.length) invalid();
      parts.push(input.subarray(start, offset)); return Buffer.concat(parts);
    }
    if (!marker || marker === 0xd8 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7 || offset + 2 > input.length) invalid();
    const size = input.readUInt16BE(offset), end = offset + size;
    if (size < 2 || end > input.length) invalid();
    const data = input.subarray(offset + 2, end);
    if (marker === 0xe1 && data.subarray(0, 6).equals(Buffer.from('Exif\0\0'))) {
      if (exifSeen) invalid(); exifSeen = true;
      const clean = orientationOnly(data);
      if (clean) parts.push(jpegSegment(marker, Buffer.concat([Buffer.from('Exif\0\0'), clean])));
    } else if (marker === 0xe0 && data.subarray(0, 5).equals(Buffer.from('JFIF\0'))) {
      if (data.length < 14) invalid();
      const header = Buffer.from(data.subarray(0, 14)); header[12] = 0; header[13] = 0;
      parts.push(jpegSegment(marker, header));
    } else if (marker === 0xe2 && data.subarray(0, 12).equals(Buffer.from('ICC_PROFILE\0')) || marker === 0xee && data.subarray(0, 5).equals(Buffer.from('Adobe')) && data.length === 12) {
      parts.push(input.subarray(start, end)); // perfil de cor/transformação necessários à aparência
    } else if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) {
      parts.push(input.subarray(start, end));
    }
    entropy = marker === 0xda; offset = end;
  }
  invalid();
}
function pngChunk(kind, data) {
  const chunk = Buffer.alloc(12 + data.length); chunk.writeUInt32BE(data.length); chunk.write(kind, 4, 4, 'ascii'); data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, chunk.length - 4)), chunk.length - 4); return chunk;
}
function cleanPNG(input) {
  const keep = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'iCCP', 'sRGB', 'cICP', 'mDCv', 'cLLi', 'sBIT', 'bKGD', 'pHYs']);
  const parts = [input.subarray(0, 8)]; let offset = 8, exifSeen = false;
  while (offset < input.length) {
    const size = input.readUInt32BE(offset), kind = input.toString('latin1', offset + 4, offset + 8), end = offset + 12 + size;
    if (keep.has(kind)) parts.push(input.subarray(offset, end));
    else if (kind === 'eXIf') {
      if (exifSeen) invalid(); exifSeen = true;
      const clean = orientationOnly(input.subarray(offset + 8, end - 4));
      if (clean) parts.push(pngChunk(kind, clean));
    } else if (!(input[offset + 4] & 32)) invalid(); // não remover chunks críticos desconhecidos
    offset = end;
  }
  return Buffer.concat(parts);
}
function webpChunk(kind, data) {
  const chunk = Buffer.alloc(8 + data.length + data.length % 2); chunk.write(kind, 0, 4, 'ascii'); chunk.writeUInt32LE(data.length, 4); data.copy(chunk, 8); return chunk;
}
function cleanWebP(input) {
  const parts = []; let offset = 12, extended, orientation, exifSeen = false;
  while (offset < input.length) {
    const kind = input.toString('latin1', offset, offset + 4), size = input.readUInt32LE(offset + 4), end = offset + 8 + size + size % 2;
    const data = input.subarray(offset + 8, offset + 8 + size);
    if (kind === 'VP8X') {
      if (extended) invalid();
      extended = Buffer.from(data); extended[0] &= ~0x0c;
      parts.push(webpChunk(kind, extended));
    } else if (kind === 'EXIF') {
      if (exifSeen) invalid(); exifSeen = true;
      orientation = orientationOnly(data);
    } else if (['ICCP', 'ALPH', 'VP8 ', 'VP8L'].includes(kind)) parts.push(webpChunk(kind, data));
    offset = end;
  }
  if (orientation) {
    if (!extended) invalid();
    // Atualiza também o payload já copiado no primeiro chunk VP8X.
    const header = parts.find(chunk => chunk.toString('ascii', 0, 4) === 'VP8X'); header[8] |= 0x08;
    parts.push(webpChunk('EXIF', orientation));
  }
  const header = Buffer.from('RIFF\0\0\0\0WEBP', 'binary'), body = Buffer.concat(parts);
  header.writeUInt32LE(body.length + 4, 4); return Buffer.concat([header, body]);
}
function sanitizeImage(input, mime) {
  const extension = validateImage(input, mime);
  let clean;
  try { clean = extension === 'jpg' ? cleanJPEG(input) : extension === 'png' ? cleanPNG(input) : cleanWebP(input); }
  catch (error) { if (error instanceof ValidationError) throw error; invalid(); }
  validateImage(clean, mime);
  return { extension, buffer: clean };
}
module.exports = { sanitizeImage };
