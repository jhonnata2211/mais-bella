export const MAX_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export function photoType(file) {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split('.').at(-1).toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' })[extension] || '';
}
export function checkPhotoSelection(files, count) {
  if (files.length + count > MAX_PHOTOS) throw Error('Você pode usar até 20 imagens por produto. Remova uma para adicionar outra.');
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photoType(file))) throw Error('Formato de imagem não permitido. Escolha JPEG, PNG ou WebP.');
    if (!file.size || file.size > MAX_PHOTO_BYTES) throw Error('Esta imagem é muito grande ou está vazia. O limite é 5 MiB por foto.');
  }
}
export function normalizeGallery(items) {
  const primary = items.findIndex(item => item.primary);
  return items.map((item, index) => ({ ...item, order: index, primary: index === (primary < 0 ? 0 : primary) }));
}
export function choosePrimary(items, id) { return normalizeGallery(items.map(item => ({ ...item, primary: item.id === id }))); }
export function removePhoto(items, id) { return normalizeGallery(items.filter(item => item.id !== id)); }
export function galleryImages(items, name) {
  if (!items.length) return [{ type: 'illustration', tone: 'rose', shape: 'dress', alt: 'Ilustração provisória de roupa, sem fotografia do produto', primary: true, order: 0 }];
  return normalizeGallery(items).map((item, index) => ({
    id: item.id, type: item.type, order: index, primary: item.primary,
    alt: item.alt?.trim() || `Foto de ${name.trim()} — ${index + 1}`,
    ...(item.type === 'image' ? { src: item.src } : { tone: item.tone, shape: item.shape })
  }));
}
export function galleryFingerprint(items) {
  return JSON.stringify(items.map(item => [item.id, item.order, item.primary, item.alt, item.src, item.file?.name, item.file?.size, item.file?.lastModified]));
}
