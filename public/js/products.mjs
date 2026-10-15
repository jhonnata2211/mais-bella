import { effectivePrice } from './catalog.mjs';

export const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3 12C-3 5 7-1 12 6c5-7 15-1 9 6Z"/></svg>';
export const productURL = product => `/produto.html?slug=${encodeURIComponent(product.slug)}`;

export function imageTone(image) {
  return ['rose', 'sand', 'cream', 'clay'].includes(image?.tone) ? image.tone : 'cream';
}

export function productVisual(image, name, eager = false) {
  const shape = ['dress', 'set', 'blouse', 'pants', 'skirt', 'shorts'].includes(image?.shape) ? image.shape : 'dress';
  const safeSource = image?.type === 'image' && typeof image.src === 'string' &&
    (image.src.startsWith('/assets/') && !image.src.includes('..') || /^\/uploads\/products\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(image.src));
  return safeSource
    ? `<img src="${escapeHTML(image.src)}" alt="${escapeHTML(image.alt || name)}" loading="${eager ? 'eager' : 'lazy'}" width="330" height="420">`
    : `<div class="garment garment-${shape}" role="img" aria-label="${escapeHTML(image?.alt || `Ilustração demonstrativa: ${name}`)}"></div>`;
}

export function productCard(product, favorites = new Set()) {
  const selected = favorites.has(product.id);
  const price = effectivePrice(product);
  const image = product.images[0];
  const name = escapeHTML(product.name);
  const id = escapeHTML(product.id);
  const url = escapeHTML(productURL(product));
  return `<article class="product-card" data-product-id="${id}">
    <div class="product-art tone-${imageTone(image)}">
      <a class="product-visual-link" href="${url}" aria-label="Ver detalhes de ${name}">${productVisual(image, product.name)}</a>
      <div class="product-badges">${product.isNew ? '<span class="product-label">Novo</span>' : ''}${price < product.price ? '<span class="product-label promotion-label">Promoção</span>' : ''}</div>
      <button type="button" class="product-favorite" data-favorite="${id}" aria-pressed="${selected}" aria-label="${selected ? 'Remover dos' : 'Adicionar aos'} favoritos: ${name}">${heart}</button>
      <span class="placeholder-label">${image?.type === 'image' ? 'MAIS BELLA' : 'ILUSTRAÇÃO · MAIS BELLA'}</span>
    </div>
    <div class="product-info"><h3><a href="${url}">${name}</a></h3>
      <div class="price-row">${price < product.price ? `<s><span class="sr-only">Preço original: </span>${money(product.price)}</s>` : ''}<strong><span class="sr-only">Preço demonstrativo: </span>${money(price)}</strong></div>
      <p class="installment">3x de ${money(price / 3)} sem juros · demo</p>
      <a class="add-button" href="${url}">Escolher opções <span aria-hidden="true">↗</span></a>
    </div>
  </article>`;
}

export function renderProductGrid(container, list, favorites) {
  container.innerHTML = list.map(product => productCard(product, favorites)).join('');
}
