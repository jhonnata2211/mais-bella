import { products } from './data/products.mjs';
import { hasDemoItems, isDemoProduct } from './commerce.mjs';
import { cartCount, cartSubtotal, itemKey } from './cart.mjs';
import { escapeHTML, imageTone, money, productURL, productVisual } from './products.mjs';
import { setupDialog } from './dialog.mjs';
import { findProduct, getVariation } from './product-model.mjs';

export function cartContent(items, { editable = false, showTotal = true } = {}) {
  if (!items.length) return '<div class="cart-empty"><span aria-hidden="true">♡</span><h2>Sua sacola está esperando por você.</h2><p>Encontre as peças que combinam com a sua essência.</p><a class="button" href="/catalogo.html">Explorar coleção <span aria-hidden="true">↗</span></a></div>';
  const rows = items.map(item => {
    const key = escapeHTML(itemKey(item));
    const product = findProduct({ id: item.productId });
    const stock = getVariation(product, item)?.stock;
    const knownStock = Number.isSafeInteger(stock) && stock >= 0;
    const stockNote = knownStock ? `<p class="cart-stock-note">${isDemoProduct(product) ? `Limite demonstrativo: ${stock} unidade(s)` : `Disponível: ${stock} ${stock === 1 ? 'unidade' : 'unidades'}`}</p>` : '';
    const variationLabel = escapeHTML([item.name, item.color, item.size].filter(Boolean).join(', '));
    const controls = editable ? `<div class="cart-quantity-control" role="group" aria-label="Quantidade de ${variationLabel}"><button type="button" data-cart-key="${key}" data-cart-delta="-1" aria-label="Diminuir quantidade de ${variationLabel}" ${item.quantity <= 1 ? 'disabled' : ''}>−</button><output aria-label="Quantidade atual">${item.quantity}</output><button type="button" data-cart-key="${key}" data-cart-delta="1" aria-label="Aumentar quantidade de ${variationLabel}" ${!knownStock || item.quantity >= stock ? 'disabled' : ''}>+</button></div>${stockNote}` : '';
    return `<li class="cart-item"><a class="cart-item-art tone-${imageTone(item.image)}" href="${escapeHTML(productURL(item))}" aria-label="Ver ${escapeHTML(item.name)}">${productVisual(item.image, item.name)}</a>
      <div class="cart-item-info"><h3><a href="${escapeHTML(productURL(item))}">${escapeHTML(item.name)}</a></h3>
        <p>${[item.color, item.size && `Tamanho ${item.size}`].filter(Boolean).map(escapeHTML).join(' · ')}</p>
        ${isDemoProduct(product) ? '<p class="demo-note">Produto demonstrativo</p>' : ''}
        <p>Quantidade: ${item.quantity} · Preço unitário: ${money(item.price)}</p><strong>Subtotal: ${money(Math.round(item.price * 100) * item.quantity / 100)}</strong>
        ${controls}<button type="button" class="text-button cart-remove" data-remove-item="${key}" aria-label="Remover ${variationLabel}">Remover</button>
      </div></li>`;
  }).join('');
  return `<ul class="cart-items">${rows}</ul>${showTotal ? `<div class="cart-total"><span>Subtotal dos produtos</span><strong>${money(cartSubtotal(items))}</strong></div>` : ''}`;
}

export function initCartPanel(cart, notify) {
  const dialog = document.createElement('dialog');
  dialog.id = 'cart-dialog';
  dialog.className = 'cart-dialog';
  dialog.setAttribute('aria-labelledby', 'cart-title');
  dialog.setAttribute('aria-describedby', 'cart-demo-note');
  dialog.innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">SUAS ESCOLHAS</p><h2 id="cart-title">Minha sacola</h2></div><button type="button" class="icon-button dialog-close" data-close-dialog aria-label="Fechar sacola">×</button></div>
    <p class="demo-note" id="cart-demo-note">Entrega, retirada e pagamento serão combinados pelo WhatsApp.</p>
    <div id="mini-cart-content"></div><p id="mini-cart-feedback" class="product-feedback" role="status" aria-live="polite"></p><a class="button cart-view" href="/sacola.html">Ver sacola <span aria-hidden="true">↗</span></a>`;
  document.body.append(dialog);
  const controller = setupDialog(dialog);
  const trigger = document.querySelector('#bag-button');
  trigger.setAttribute('aria-controls', dialog.id);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  function render(items) {
    const count = cartCount(items);
    document.querySelector('#cart-demo-note').textContent = hasDemoItems(items, products) ? 'Sua sacola contém produtos demonstrativos, sem disponibilidade real para venda.' : 'Entrega, retirada e pagamento serão combinados pelo WhatsApp.';
    document.querySelector('#bag-count').textContent = count;
    trigger.setAttribute('aria-label', `Abrir sacola local, ${count} ${count === 1 ? 'peça' : 'peças'}`);
    document.querySelector('#mini-cart-content').innerHTML = cartContent(items);
  }
  trigger.addEventListener('click', () => { cart.refresh(); controller.open(trigger); });
  dialog.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-item]');
    if (!remove) return;
    const saved = cart.remove(remove.dataset.removeItem);
    (dialog.querySelector('[data-remove-item]') || dialog.querySelector('[data-close-dialog]')).focus({ preventScroll: true });
    const message = `Peça removida da sacola.${saved ? '' : ' A alteração fica apenas nesta página.'}`;
    document.querySelector('#mini-cart-feedback').textContent = message;
    notify(message);
  });
  cart.subscribe(render);
  render(cart.getItems());
  return controller;
}
