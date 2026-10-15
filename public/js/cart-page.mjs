import { initStorefront } from './storefront.mjs';
import { cartContent } from './cart-panel.mjs';
import { cartCount, cartSubtotal, itemKey } from './cart.mjs';
import { money } from './products.mjs';
import { storeConfig } from './config.mjs';
import { isStoreNumberValid, prepareWhatsAppOrder, validateOrder, WHATSAPP_UNAVAILABLE } from './whatsapp.mjs';

export function initCartPage() {
  const form = document.querySelector('#order-form');
  const button = document.querySelector('#finalize-whatsapp');
  const fields = { name: '#order-name', phone: '#order-phone', city: '#order-city', neighborhood: '#order-neighborhood', deliveryNote: '#order-delivery-note' };
  let showValidation = false;
  const store = initStorefront({ onCartChange: render });
  const details = () => Object.fromEntries(new FormData(form));
  function showErrors(errors, focus = false) {
    for (const key of [...Object.keys(fields), 'receiving']) {
      const controls = key === 'receiving' ? form.querySelectorAll('[name="receiving"]') : [document.querySelector(fields[key])];
      controls.forEach(control => control.setAttribute('aria-invalid', String(Boolean(errors[key]))));
      const message = document.querySelector(`#error-${key}`);
      message.textContent = errors[key] || '';
      message.hidden = !errors[key];
    }
    const summary = document.querySelector('#order-errors');
    summary.hidden = !Object.keys(errors).length;
    summary.textContent = Object.keys(errors).length ? `Vamos revisar antes de continuar. ${Object.values(errors).join(' ')}` : '';
    if (focus && !summary.hidden) summary.focus();
  }
  function updateReceiving() {
    const receiving = form.querySelector('[name="receiving"]:checked')?.value;
    document.querySelector('#delivery-note-field').hidden = receiving !== 'delivery';
    document.querySelector('#order-delivery-note').disabled = receiving !== 'delivery';
    document.querySelector('#delivery-info').hidden = receiving !== 'delivery';
    document.querySelector('#pickup-info').hidden = receiving !== 'pickup';
    if (receiving === 'pickup') document.querySelector('#order-delivery-note').value = '';
  }
  function render() {
    const items = store.cart.getItems();
    document.querySelector('#full-cart-content').innerHTML = cartContent(items, { editable: true, showTotal: false });
    document.querySelector('#full-cart-count').textContent = `${cartCount(items)} peça(s) na sacola local`;
    document.querySelector('#order-item-count').textContent = cartCount(items);
    document.querySelector('#order-subtotal').textContent = money(cartSubtotal(items));
    document.querySelector('#order-section').hidden = items.length === 0;
    const configured = isStoreNumberValid(storeConfig.whatsappNumber);
    button.disabled = !configured || !items.length;
    document.querySelector('#whatsapp-config-status').textContent = configured
      ? 'Ao continuar, o WhatsApp será aberto para você revisar e enviar a mensagem.' : WHATSAPP_UNAVAILABLE;
    if (!items.length) { form.reset(); updateReceiving(); showValidation = false; showErrors({}); }
    else if (showValidation) showErrors(validateOrder(items, details()).errors);
  }
  function cartFeedback(message) {
    document.querySelector('#cart-feedback').textContent = message;
    store.notify(message);
  }
  const list = document.querySelector('#full-cart-content');
  list.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-item]');
    if (remove) {
      const saved = store.cart.remove(remove.dataset.removeItem);
      (list.querySelector('[data-remove-item]') || document.querySelector('#continue-shopping')).focus({ preventScroll: true });
      cartFeedback(`Peça removida da sacola.${saved ? '' : ' A alteração fica apenas nesta página.'}`);
      return;
    }
    const quantityButton = event.target.closest('[data-cart-delta]');
    if (!quantityButton || quantityButton.disabled) return;
    const key = quantityButton.dataset.cartKey;
    const item = store.cart.getItems().find(entry => itemKey(entry) === key);
    if (!item) return;
    const result = store.cart.updateQuantity(key, item.quantity + Number(quantityButton.dataset.cartDelta));
    const controls = [...list.querySelectorAll('[data-cart-delta]')].filter(control => control.dataset.cartKey === key && !control.disabled);
    (controls.find(control => control.dataset.cartDelta === quantityButton.dataset.cartDelta) || controls[0] || document.querySelector('#continue-shopping')).focus({ preventScroll: true });
    cartFeedback(result.message);
  });
  form.addEventListener('change', updateReceiving);
  form.addEventListener('input', () => {
    document.querySelector('#order-status').textContent = '';
    if (showValidation) showErrors(validateOrder(store.cart.getItems(), details()).errors);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    store.cart.refresh();
    const result = prepareWhatsAppOrder(store.cart.getItems(), details());
    showValidation = true;
    if (!result.ok) {
      showErrors(result.errors, store.cart.getItems().length > 0);
      if (!store.cart.getItems().length) cartFeedback(result.errors.cart);
      return;
    }
    showErrors({});
    document.querySelector('#order-status').textContent = 'Mensagem pronta. Confira os dados e confirme o envio dentro do WhatsApp.';
    window.location.assign(result.url);
  });
  // Dados pessoais só permanecem no formulário durante esta visita, inclusive sem restauração por BFCache.
  window.addEventListener('pagehide', () => { form.reset(); updateReceiving(); showErrors({}); document.querySelector('#order-status').textContent = ''; showValidation = false; });
  form.reset();
  updateReceiving();
  render();
}
