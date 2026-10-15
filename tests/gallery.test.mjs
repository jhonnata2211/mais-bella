import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { checkPhotoSelection, photoType, normalizeGallery, choosePrimary, removePhoto, galleryImages, galleryFingerprint, MAX_PHOTO_BYTES } from '../public/js/admin-gallery.mjs';
import { productPayload } from '../public/js/admin-model.mjs';
const require = createRequire(import.meta.url);
const { validateProduct } = require('../src/services/validation');
const images = [
  { id: 'primeira', type: 'image', src: '/assets/primeira.webp', alt: 'Foto de frente', primary: true, order: 0 },
  { id: 'segunda', type: 'image', src: '/uploads/products/' + 'a'.repeat(32) + '.png', alt: 'Foto das costas', primary: false, order: 1 }
];
const file = changes => ({ name: 'foto.jpg', type: 'image/jpeg', size: 200, lastModified: 1, ...changes });

test('seleção aceita galeria múltipla JPEG/PNG/WebP e orienta sobre tipo, tamanho e quantidade', () => {
  assert.doesNotThrow(() => checkPhotoSelection([file({}), file({ name: 'a.png', type: 'image/png' }), file({ name: 'a.webp', type: 'image/webp' })], 17));
  assert.throws(() => checkPhotoSelection([file({})], 20), /20 imagens/);
  assert.throws(() => checkPhotoSelection([file({ type: 'image/svg+xml' })], 0), /Formato/);
  assert.throws(() => checkPhotoSelection([file({ type: 'text/html', name: 'falsa.jpg' })], 0), /Formato/);
  assert.throws(() => checkPhotoSelection([file({ size: MAX_PHOTO_BYTES + 1 })], 0), /muito grande/);
  assert.throws(() => checkPhotoSelection([file({ size: 0 })], 0), /vazia/);
  assert.doesNotThrow(() => checkPhotoSelection([file({ size: MAX_PHOTO_BYTES })], 0));
});
test('MIME vazio no navegador usa extensão como dica; o servidor ainda verifica os bytes', () => {
  assert.equal(photoType(file({ type: '', name: 'FOTO.JPEG' })), 'image/jpeg');
  assert.equal(photoType(file({ type: '', name: 'foto.png' })), 'image/png');
  assert.equal(photoType(file({ type: '', name: 'foto.svg' })), '');
});
test('adicionar imagens preserva anteriores e a principal; normalização não altera o original', () => {
  const before = structuredClone(images);
  const added = normalizeGallery([...images, { id: 'nova', type: 'image', file: file({}), preview: 'blob:previa', primary: false }]);
  assert.deepEqual(images, before); assert.equal(added.length, 3); assert.equal(added[0].primary, true); assert.equal(added[1].src, images[1].src); assert.equal(added[2].order, 2);
  assert.equal(normalizeGallery([{ id: 'nova', type: 'image' }])[0].primary, true);
});
test('troca de principal e remoção preservam uma única principal sem apagar outras fotos', () => {
  const primary = choosePrimary(images, 'segunda'); assert.equal(primary[1].primary, true); assert.equal(primary[0].primary, false);
  assert.equal(images[0].primary, true);
  const removed = removePhoto(primary, 'segunda'); assert.equal(removed.length, 1); assert.equal(removed[0].primary, true); assert.equal(removed[0].order, 0);
  assert.deepEqual(removePhoto(removed, 'primeira'), []);
});
test('somente dados persistíveis vão ao servidor: alt padrão e ausência de arquivos/blob no JSON', () => {
  const item = { ...images[1], alt: '', file: file({}), preview: 'blob:segredo', uploaded: true };
  const result = galleryImages([item], 'Vestido Azul'); assert.equal(result[0].alt, 'Foto de Vestido Azul — 1'); assert.equal(result[0].primary, true);
  assert.ok(!JSON.stringify(result).includes('blob:')); assert.equal('file' in result[0], false); assert.equal('uploaded' in result[0], false);
  assert.equal(galleryImages([], 'Vestido')[0].type, 'illustration');
});
test('dados finais da galeria usam contrato existente e passam pelos validadores reais', () => {
  const values = { name: 'Roupa', slug: 'roupa', shortDescription: 'Curta', description: 'Completa', categoryId: 'roupas', price: '100,00', promotion: '', active: true, featured: false, isNew: false, bestSeller: false };
  const payload = productPayload(values, [{ color: 'Azul', size: 'P', stock: 1 }], null, 'roupa', galleryImages(choosePrimary(images, 'segunda'), 'Roupa'));
  assert.equal(validateProduct(payload).images.length, 2); assert.equal(payload.images[1].primary, true); assert.equal(payload.images[0].alt, 'Foto de frente');
});
test('adição, remoção, alt e principal tornam o rascunho alterado; cópias idênticas não', () => {
  const baseline = galleryFingerprint(images); assert.equal(galleryFingerprint(structuredClone(images)), baseline);
  assert.notEqual(galleryFingerprint(choosePrimary(images, 'segunda')), baseline);
  assert.notEqual(galleryFingerprint(removePhoto(images, 'segunda')), baseline);
  assert.notEqual(galleryFingerprint(images.map(image => ({ ...image, alt: 'Outra descrição' }))), baseline);
  assert.notEqual(galleryFingerprint([...images, { id: 'arquivo-local', file: file({}), primary: false }]), baseline);
});
