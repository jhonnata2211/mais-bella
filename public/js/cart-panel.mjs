import { cartCount, cartSubtotal, itemKey } from './cart.mjs';
import { escapeHTML, imageTone, money, productURL, productVisual } from './products.mjs';
import { setupDialog } from './dialog.mjs';

export function cartContent(items) {
  if (!items.length) return '<div class="cart-empty"><span aria-hidden="true">♡</span><p>Sua sacola está vazia.</p><a class="text-button" href="/catalogo.html">Explorar a coleção ↗</a></div>';
  return `<ul class="cart-items">${items.map(item => `<li class="cart-item">
    <a class="cart-item-art tone-${imageTone(item.image)}" href="${escapeHTML(productURL(item))}" aria-label="Ver ${escapeHTML(item.name)}">${productVisual(item.image, item.name)}</a>
    <div class="cart-item-info"><h3><a href="${escapeHTML(productURL(item))}">${escapeHTML(item.name)}</a></h3>
      <p>${[item.color, item.size && `Tamanho ${item.size}`].filter(Boolean).map(escapeHTML).join(' · ')}</p>
      <p>Quantidade: ${item.quantity} · ${money(item.price)} por peça</p><strong>${money(Math.round(item.price * 100) * item.quantity / 100)}</strong>
      <button type="button" class="text-button cart-remove" data-remove-item="${escapeHTML(itemKey(item))}" aria-label="Remover ${escapeHTML(item.name)}, ${escapeHTML(item.color)}, tamanho ${escapeHTML(item.size)}">Remover</button>
    </div>
  </li>`).join('')}</ul><div class="cart-total"><span>Subtotal demonstrativo</span><strong>${money(cartSubtotal(items))}</strong></div>`;
}

export function initCartPanel(cart, notify) {
  const dialog = document.createElement('dialog');
  dialog.id = 'cart-dialog';
  dialog.className = 'cart-dialog';
  dialog.setAttribute('aria-labelledby', 'cart-title');
  dialog.setAttribute('aria-describedby', 'cart-demo-note');
  dialog.innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">SUAS ESCOLHAS</p><h2 id="cart-title">Minha sacola</h2></div><button type="button" class="icon-button dialog-close" data-close-dialog aria-label="Fechar sacola">×</button></div>
    <p class="demo-note" id="cart-demo-note">Sacola local demonstrativa · sem compra, reserva ou checkout.</p>
    <div id="mini-cart-content"></div><p id="mini-cart-feedback" class="product-feedback" role="status" aria-live="polite"></p><a class="button cart-view" href="/sacola.html">Ver sacola <span aria-hidden="true">↗</span></a>`;
  document.body.append(dialog);
  const controller = setupDialog(dialog);
  const trigger = document.querySelector('#bag-button');
  trigger.setAttribute('aria-controls', dialog.id);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  function render(items) {
    const count = cartCount(items);
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
