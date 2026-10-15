import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { crc32 } from 'node:zlib';
import { pngImage, jpegImage, webpImage } from './helpers/image-fixture.mjs';
const require = createRequire(import.meta.url);
const { sanitizeImage } = require('../src/services/image-privacy');
const { MAX_IMAGE_BYTES, validateImage } = require('../src/services/image-validation');
const secret = Buffer.from('GPS_AUTOR_APARELHO_DATA_THUMBNAIL_SINTETICOS');
function tiff(orientation = 6, order = 'II') {
  const result = Buffer.alloc(26 + secret.length);
  const u16 = (value, offset) => order === 'II' ? result.writeUInt16LE(value, offset) : result.writeUInt16BE(value, offset);
  const u32 = (value, offset) => order === 'II' ? result.writeUInt32LE(value, offset) : result.writeUInt32BE(value, offset);
  result.write(order); u16(42, 2); u32(8, 4); u16(1, 8); u16(0x0112, 10); u16(3, 12); u32(1, 14); u16(orientation, 18);
  secret.copy(result, 26); return result;
}
function privateTiff() {
  // IFD0 com Orientation, Artist e ponteiro para GPS IFD; coordenadas só sintéticas.
  const result=Buffer.alloc(105+secret.length);result.write('II');result.writeUInt16LE(42,2);result.writeUInt32LE(8,4);result.writeUInt16LE(3,8);
  const entry=(offset,tag,type,count,value)=>{result.writeUInt16LE(tag,offset);result.writeUInt16LE(type,offset+2);result.writeUInt32LE(count,offset+4);result.writeUInt32LE(value,offset+8)};
  entry(10,0x0112,3,1,6);entry(22,0x013b,2,secret.length+1,104);entry(34,0x8825,4,1,50);
  result.writeUInt16LE(2,50);entry(52,1,2,2,0x4e);entry(64,2,5,3,80);
  for(let i=0;i<3;i++){result.writeUInt32LE(i===0?1:0,80+i*8);result.writeUInt32LE(1,84+i*8)}
  secret.copy(result,104);return result;
}
function segment(marker, data) { const header = Buffer.from([255, marker, 0, 0]); header.writeUInt16BE(data.length + 2, 2); return Buffer.concat([header, data]); }
function jpeg(...segments) { return Buffer.concat([jpegImage.subarray(0, 2), ...segments, jpegImage.subarray(2)]); }
function pngChunk(kind, data) {
  const body = Buffer.concat([Buffer.from(kind), data]), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(body)); return Buffer.concat([size, body, checksum]);
}
function png(...chunks) { const original = pngImage(); return Buffer.concat([original.subarray(0, 33), ...chunks, original.subarray(33)]); }
function webpChunk(kind, data) { const out = Buffer.alloc(8 + data.length + data.length % 2); out.write(kind); out.writeUInt32LE(data.length, 4); data.copy(out, 8); return out; }
function webp(...chunks) {
  const vp8x = Buffer.alloc(10); vp8x[0] = 0x0c;
  const parts = Buffer.concat([webpChunk('VP8X', vp8x), webpImage.subarray(12), ...chunks]);
  const header = Buffer.from('RIFF\0\0\0\0WEBP', 'binary'); header.writeUInt32LE(parts.length + 4, 4); return Buffer.concat([header, parts]);
}
function chunks(buffer, type) {
  const rows = []; let offset = type === 'png' ? 8 : 12;
  while (offset < buffer.length) {
    const size = type === 'png' ? buffer.readUInt32BE(offset) : buffer.readUInt32LE(offset + 4);
    const kind = buffer.toString('ascii', offset + (type === 'png' ? 4 : 0), offset + (type === 'png' ? 8 : 4));
    const start = offset + 8; rows.push({ kind, data: buffer.subarray(start, start + size) });
    offset += size + (type === 'png' ? 12 : 8 + size % 2);
  }
  return rows;
}
const orientationExif = value => segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff(value)]));
test('JPEG remove EXIF privado, XMP, IPTC, comentários e APP desconhecido sem recomprimir pixels', () => {
  const input = jpeg(segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), privateTiff()])), segment(0xe1, Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0'), secret])), segment(0xed, secret), segment(0xfe, secret), segment(0xe3, secret));
  const original = Buffer.from(input), output = sanitizeImage(input, 'image/jpeg').buffer;
  assert.equal(output.includes(secret), false); assert.deepEqual(input, original);
  const start = jpegImage.indexOf(Buffer.from([255, 218]));
  assert.deepEqual(output.subarray(output.indexOf(Buffer.from([255, 218]))), jpegImage.subarray(start));
  const exif = output.indexOf(Buffer.from('Exif\0\0')); assert.ok(exif > 0);
  assert.equal(output.readUInt16LE(exif + 6 + 18), 6);
  assert.equal(output.readUInt16LE(exif + 6 + 8), 1); // sem Artist/GPS IFD após reconstrução
  assert.equal(validateImage(output,'image/jpeg'),'jpg');
});
test('orientações EXIF de celular 1–8 e endian big/little são preservadas apenas no bloco mínimo', () => {
  for (const order of ['II','MM']) for (let orientation = 1; orientation <= 8; orientation++) {
    const input = jpeg(segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff(orientation, order)])));
    const out = sanitizeImage(input,'image/jpeg').buffer, start = out.indexOf(Buffer.from('Exif\0\0'));
    assert.equal(out.includes(secret),false);
    if (orientation === 1) assert.equal(start,-1); else assert.equal(out.readUInt16LE(start+24),orientation);
  }
});
test('JPEG remove comentário após dados de scan e thumbnail JFIF; preserva transformação e perfil de cor', () => {
  const jfif = Buffer.alloc(14 + secret.length); jfif.write('JFIF\0'); jfif[12]=1; jfif[13]=1; secret.copy(jfif,14);
  const icc=Buffer.concat([Buffer.from('ICC_PROFILE\0'),Buffer.from([1,1]),Buffer.from('perfil-cor-sintetico')]);
  const adobe=Buffer.alloc(12);adobe.write('Adobe');
  const input = jpeg(segment(0xe0,jfif),segment(0xe2,icc),segment(0xee,adobe));
  const withComment=Buffer.concat([input.subarray(0,-2),segment(0xfe,secret),input.subarray(-2)]);
  const out=sanitizeImage(withComment,'image/jpeg').buffer;
  assert.ok(!out.includes(secret));assert.ok(out.includes(icc));assert.ok(out.includes(adobe));
  assert.equal(validateImage(out,'image/jpeg'),'jpg');
});
test('PNG remove textos, XMP, data, EXIF privado e chunks auxiliares desconhecidos; mantém IDAT/cores/alpha', () => {
  const gamma=Buffer.from([0,0,177,143]),alpha=Buffer.from([0,255,0,255,0,255]);
  const input=png(pngChunk('tEXt',secret),pngChunk('iTXt',secret),pngChunk('zTXt',secret),pngChunk('tIME',secret),pngChunk('eXIf',tiff(8)),pngChunk('vpAg',secret),pngChunk('gAMA',gamma),pngChunk('tRNS',alpha));
  const out=sanitizeImage(input,'image/png').buffer, rows=chunks(out,'png');
  assert.ok(!out.includes(secret));assert.ok(!rows.some(row=>['tEXt','iTXt','zTXt','tIME','vpAg'].includes(row.kind)));
  assert.deepEqual(rows.find(row=>row.kind==='IDAT').data,chunks(pngImage(),'png').find(row=>row.kind==='IDAT').data);
  assert.deepEqual(rows.find(row=>row.kind==='gAMA').data,gamma);assert.deepEqual(rows.find(row=>row.kind==='tRNS').data,alpha);
  assert.equal(rows.find(row=>row.kind==='eXIf').data.readUInt16LE(18),8);
  assert.equal(validateImage(out,'image/png'),'png');
});
test('WebP limpa EXIF/XMP/desconhecidos, atualiza flags/tamanho/padding e preserva pixels, ICC e orientação', () => {
  const input=webp(webpChunk('EXIF',tiff(6)),webpChunk('XMP ',secret),webpChunk('PRIV',secret),webpChunk('ICCP',Buffer.from('perfil-cor-sintetico')));
  const out=sanitizeImage(input,'image/webp').buffer,rows=chunks(out,'webp');
  assert.equal(out.readUInt32LE(4)+8,out.length);assert.ok(!out.includes(secret));
  assert.equal(rows[0].data[0]&0x0c,0x08);assert.equal(rows.find(row=>row.kind==='EXIF').data.readUInt16LE(18),6);
  assert.deepEqual(rows.find(row=>row.kind==='VP8 ').data,chunks(webpImage,'webp')[0].data);
  assert.ok(rows.some(row=>row.kind==='ICCP'));assert.equal(validateImage(out,'image/webp'),'webp');
  const normal=sanitizeImage(webp(webpChunk('EXIF',tiff(1)),webpChunk('XMP ',secret)),'image/webp').buffer;
  assert.equal(chunks(normal,'webp')[0].data[0]&0x0c,0);assert.ok(!chunks(normal,'webp').some(row=>row.kind==='EXIF'));
});
test('EXIF truncado, orientação inválida/duplicada e chunks críticos desconhecidos são recusados com erro seguro', () => {
  const bad=tiff(6);bad.writeUInt32LE(0xffffffff,4);
  for(const input of [jpeg(segment(0xe1,Buffer.from('Exif\0\0inválido'))),jpeg(segment(0xe1,Buffer.concat([Buffer.from('Exif\0\0'),bad]))),jpeg(orientationExif(0)),jpeg(orientationExif(9)),jpeg(orientationExif(6),orientationExif(6))]) assert.throws(()=>sanitizeImage(input,'image/jpeg'),/preparar esta foto/);
  assert.throws(()=>sanitizeImage(png(pngChunk('BADX',secret)),'image/png'),/preparar esta foto/);
  const invalidType=pngImage();invalidType[12]|=0x80;invalidType.writeUInt32BE(crc32(invalidType.subarray(12,29)),29);
  assert.throws(()=>sanitizeImage(invalidType,'image/png'),/preparar esta foto/);
});
test('saneamento mantém limite de entrada, MIME real e rejeição de imagem inválida/animada', () => {
  assert.throws(()=>sanitizeImage(Buffer.alloc(MAX_IMAGE_BYTES+1),'image/png'),/muito grande/);
  assert.throws(()=>sanitizeImage(pngImage(),'image/jpeg'),/Formato/);
  assert.throws(()=>sanitizeImage(png(pngChunk('acTL',Buffer.alloc(8))),'image/png'),/animação/);
  assert.throws(()=>sanitizeImage(Buffer.from('<svg/>'),'image/png'),/Formato/);
});
