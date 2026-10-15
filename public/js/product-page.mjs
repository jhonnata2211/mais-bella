import { isDemoProduct } from './commerce.mjs';
import { findProduct, getVariation, validateSelection, simplifySelection } from './product-model.mjs';
import { effectivePrice } from './catalog.mjs';
import { escapeHTML, imageTone, money, productVisual } from './products.mjs';
import { initStorefront } from './storefront.mjs';
import { itemKey } from './cart.mjs';
import { setupDialog } from './dialog.mjs';
import { bindWhatsAppButton } from './whatsapp-ui.mjs';
import { productQuestion, WHATSAPP_UNAVAILABLE, isStoreNumberValid } from './whatsapp.mjs';
import { storeConfig } from './config.mjs';

const swatches = { 'Rosa queimado': '#b37568', Nude: '#d4b79a', Bege: '#c8b994', 'Off-white': '#f5eee5', Chumbo: '#655d53' };

export function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const product = findProduct({ slug: params.get('slug'), id: params.get('id') });
  const store = initStorefront({ onCartChange() { if (product) updateAvailability(); } });
  if (!product) {
    document.querySelector('#product-not-found').hidden = false;
    document.querySelector('#product-loading').hidden = true;
    document.title = 'Produto não encontrado — Mais Bella';
    return;
  }
  let selection = simplifySelection(product);
  const demo = isDemoProduct(product);
  document.querySelector('#product-demo-note').hidden = !demo;
  let imageIndex = 0;
  const price = effectivePrice(product);
  const discounted = price < product.price;
  document.title = `${product.name} — Mais Bella`;
  document.querySelector('#product-breadcrumb').textContent = product.name;
  document.querySelector('#product-loading').hidden = true;
  document.querySelector('#product-detail').hidden = false;
  document.querySelector('#product-category').textContent = product.category;
  document.querySelector('#product-title').textContent = product.name;
  document.querySelector('#product-short-description').textContent = product.shortDescription;
  document.querySelector('#product-description').textContent = product.description;
  document.querySelector('#product-price').textContent = money(price);
  document.querySelector('#product-old-price').hidden = !discounted;
  document.querySelector('#product-old-price').textContent = money(product.price);
  document.querySelector('#product-discount').hidden = !discounted;
  document.querySelector('#product-discount').textContent = `${Math.round((1 - price / product.price) * 100)}% de desconto${demo ? ' · demo' : ''}`;
  document.querySelector('#product-new').hidden = !product.isNew;
  document.querySelector('#product-installment').textContent = demo ? `3x de ${money(price / 3)} sem juros · condição fictícia` : 'Pagamento combinado pelo WhatsApp.';
  document.querySelector('#product-favorite').dataset.favorite = product.id;
  store.syncFavorites();
  const contactFeedback = document.querySelector('#product-contact-status');
  if (!isStoreNumberValid(storeConfig.whatsappNumber)) contactFeedback.textContent = WHATSAPP_UNAVAILABLE;
  bindWhatsAppButton(document.querySelector('#product-question'), () => productQuestion(product), message => {
    contactFeedback.textContent = message;
    store.notify(message);
  });

  const images = product.images.length ? product.images : [{ type: 'illustration', alt: `Ilustração: ${product.name}` }];
  document.querySelector('#gallery-thumbnails').innerHTML = images.map((image, index) => `<button type="button" class="gallery-thumbnail tone-${imageTone(image)}" data-image-index="${index}" aria-label="Mostrar imagem ${index + 1}: ${escapeHTML(image.alt || product.name)}" aria-pressed="false">${productVisual(image, product.name)}</button>`).join('');
  document.querySelector('#gallery-thumbnails').hidden = images.length < 2;
  document.querySelector('#gallery-controls').hidden = images.length < 2;
  function showImage(index) {
    imageIndex = (index + images.length) % images.length;
    const main = document.querySelector('#gallery-main');
    main.className = `gallery-main tone-${imageTone(images[imageIndex])}`;
    main.innerHTML = productVisual(images[imageIndex], product.name, true);
    const note = document.querySelector('#product-photo-note');
    note.hidden = images[imageIndex].type === 'image';
    note.textContent = demo ? 'Ilustração de produto demonstrativo.' : 'Ilustração provisória. Confira os detalhes da peça pelo WhatsApp.';
    document.querySelectorAll('[data-image-index]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.imageIndex) === imageIndex)));
    document.querySelector('#gallery-count').textContent = `Imagem ${imageIndex + 1} de ${images.length}`;
  }
  document.querySelector('#gallery-thumbnails').addEventListener('click', event => {
    const thumbnail = event.target.closest('[data-image-index]');
    if (thumbnail) showImage(Number(thumbnail.dataset.imageIndex));
  });
  document.querySelector('#gallery-previous').addEventListener('click', () => showImage(imageIndex - 1));
  document.querySelector('#gallery-next').addEventListener('click', () => showImage(imageIndex + 1));
  showImage(0);

  document.querySelector('#color-fieldset').hidden = product.colors.length === 0;
  document.querySelector('#size-fieldset').hidden = product.sizes.length === 0;
  document.querySelector('#product-colors').innerHTML = product.colors.map(color => {
    const available = product.variations.some(variation => variation.active !== false && variation.color === color && variation.stock > 0);
    return `<label class="product-option color-option${available ? '' : ' unavailable'}"><input type="radio" name="color" value="${escapeHTML(color)}" ${available ? '' : 'disabled'} ${selection.color === color && available ? 'checked' : ''}><span class="option-face"><span class="color-swatch" style="background:${swatches[color] || '#b5aaa1'}" aria-hidden="true"></span>${escapeHTML(color)}${available ? '' : ' · esgotada'}</span></label>`;
  }).join('');
  function renderSizes() {
    document.querySelector('#product-sizes').innerHTML = product.sizes.map(size => {
      const variation = getVariation(product, { color: selection.color, size });
      const available = variation?.stock > 0;
      const unavailable = selection.color && !available;
      return `<label class="product-option size-option${unavailable ? ' unavailable' : ''}"><input type="radio" name="size" value="${escapeHTML(size)}" ${available ? '' : 'disabled'} ${selection.size === size && available ? 'checked' : ''}><span class="option-face">${escapeHTML(size)}${unavailable ? '<span class="size-unavailable">Esgotado</span>' : ''}</span></label>`;
    }).join('');
  }
  const quantity = document.querySelector('#product-quantity');
  function remainingStock() {
    const variation = getVariation(product, selection);
    if (!variation || variation.stock < 1) return 0;
    const existing = store.cart.getItems().find(item => itemKey(item) === itemKey({ productId: product.id, ...selection }));
    return Math.max(0, variation.stock - (existing?.quantity || 0));
  }
  function updateAvailability() {
    const validation = validateSelection(product, selection);
    const remaining = validation.ok ? remainingStock() : 0;
    const validQuantity = Number.isSafeInteger(Number(quantity.value)) && Number(quantity.value) >= 1 && Number(quantity.value) <= remaining;
    quantity.disabled = remaining === 0;
    quantity.max = String(Math.max(1, remaining));
    document.querySelector('#quantity-decrease').disabled = remaining === 0 || Number(quantity.value) <= 1;
    document.querySelector('#quantity-increase').disabled = remaining === 0 || Number(quantity.value) >= remaining;
    document.querySelector('#product-add').disabled = !validation.ok || !validQuantity;
    const soldOut = product.variations.length > 0 && !product.variations.some(v => v.active !== false && v.stock > 0);
    document.querySelector('#stock-status').textContent = soldOut ? 'Essa opção está esgotada.' : !validation.ok ? validation.message : remaining === 0
      ? 'Todas as unidades disponíveis desta opção já estão na sua sacola.'
      : `${demo ? 'Estoque demonstrativo' : 'Disponível'}: ${validation.stock} unidade(s). Você pode adicionar mais ${remaining}.`;
    document.querySelector('#selected-color').textContent = selection.color || 'Selecione uma opção';
    document.querySelector('#selected-size').textContent = selection.size || (selection.color ? 'Selecione uma opção' : 'Escolha a cor primeiro');
  }
  document.querySelector('#product-options').addEventListener('change', event => {
    if (event.target.name === 'color') {
      selection.color = event.target.value;
      const variation = getVariation(product, selection);
      if (!variation || variation.stock === 0) selection.size = '';
      selection = simplifySelection(product, selection);
      renderSizes();
    } else if (event.target.name === 'size') selection.size = event.target.value;
    else return;
    quantity.value = '1';
    document.querySelector('#product-feedback').textContent = '';
    updateAvailability();
  });
  quantity.addEventListener('input', () => {
    const remaining = remainingStock();
    if (quantity.value !== '' && Number.isFinite(Number(quantity.value))) {
      quantity.value = String(Math.max(1, Math.min(remaining || 1, Math.floor(Number(quantity.value)))));
    }
    updateAvailability();
  });
  quantity.addEventListener('change', () => {
    quantity.value = String(Math.max(1, Math.min(remainingStock() || 1, Math.floor(Number(quantity.value) || 1))));
    updateAvailability();
  });
  document.querySelector('#quantity-decrease').addEventListener('click', () => { quantity.value = String(Math.max(1, Number(quantity.value) - 1)); updateAvailability(); });
  document.querySelector('#quantity-increase').addEventListener('click', () => { quantity.value = String(Math.min(remainingStock(), Number(quantity.value) + 1)); updateAvailability(); });
  document.querySelector('#product-options').addEventListener('submit', event => {
    event.preventDefault();
    const result = store.cart.add(product, selection, Number(quantity.value));
    document.querySelector('#product-feedback').textContent = result.message;
    store.notify(result.message);
    if (result.ok) {
      quantity.value = '1';
      document.querySelector('#open-added-cart').hidden = false;
    }
    updateAvailability();
  });
  const guide = setupDialog(document.querySelector('#size-guide-dialog'));
  const measures = document.querySelector('#size-guide-button');
  if (demo) measures.addEventListener('click', event => guide.open(event.currentTarget));
  else {
    measures.textContent = 'Consultar medidas pelo WhatsApp ↗';
    for (const name of ['aria-haspopup', 'aria-controls', 'aria-expanded']) measures.removeAttribute(name);
    bindWhatsAppButton(measures, () => 'Olá! Gostaria de conferir as medidas de ' + product.name + '.', store.notify);
  }
  renderSizes();
  updateAvailability();
}
