import { loadCatalog } from './data/products.mjs';
import { prepareWhatsAppOrder, validateOrder } from './whatsapp.mjs';
import { storeConfig } from './config.mjs';
const signature = items => JSON.stringify(items.map(item => [item.productId, item.color, item.size, item.quantity, item.price]));
// GETs públicos apenas. Dados pessoais nunca são enviados à API da loja.
export async function reviewWhatsAppOrder(cart, details, { refreshCatalog = loadCatalog, number = storeConfig.whatsappNumber } = {}) {
  const requested = cart.getItems();
  const initial = validateOrder(requested, details, { number });
  if (Object.keys(initial.errors).some(key => key !== 'cart')) return initial;
  try { await refreshCatalog(); }
  catch { return { ok: false, errors: { cart: 'Não foi possível conferir a disponibilidade agora. Sua sacola foi mantida. Tente novamente antes de abrir o WhatsApp.' } }; }
  const reviewed = cart.revalidate();
  const changes = reviewed.changes;
  if (signature(requested) !== signature(reviewed.items) && !changes.length) changes.push('Os itens da sacola mudaram durante a conferência. Confira as quantidades e os valores.');
  if (changes.length) {
    cart.acknowledgeChanges();
    return { ok: false, changed: true, errors: { cart: 'Atualizamos sua sacola. ' + changes.join(' ') + ' Revise as escolhas e toque novamente em Finalizar pelo WhatsApp.' } };
  }
  return prepareWhatsAppOrder(reviewed.items, details, number);
}
