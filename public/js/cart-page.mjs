import { initStorefront } from './storefront.mjs';
import { cartContent } from './cart-panel.mjs';
import { cartCount } from './cart.mjs';

export function initCartPage() {
  const store = initStorefront({ onCartChange: render });
  function render() {
    const items = store.cart.getItems();
    document.querySelector('#full-cart-content').innerHTML = cartContent(items);
    document.querySelector('#full-cart-count').textContent = `${cartCount(items)} peça(s) na sacola local`;
  }
  document.querySelector('#full-cart-content').addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-item]');
    if (!remove) return;
    const saved = store.cart.remove(remove.dataset.removeItem);
    (document.querySelector('#full-cart-content [data-remove-item]') || document.querySelector('#continue-shopping')).focus({ preventScroll: true });
    store.notify(`Peça removida da sacola.${saved ? '' : ' A alteração fica apenas nesta página.'}`);
  });
  render();
}
