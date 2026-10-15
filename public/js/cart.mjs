import { products } from './data/products.mjs';
import { effectivePrice } from './catalog.mjs';
import { findProduct, validateSelection } from './product-model.mjs';

export const CART_KEY = 'maisbella:cart:v1';
export const itemKey = item => JSON.stringify([item.productId, item.color || '', item.size || '']);
export const cartCount = items => items.reduce((sum, item) => sum + item.quantity, 0);
export const cartSubtotal = items => items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;

export function addItem(items, product, selection, quantity = 1) {
  const validation = validateSelection(product, selection, quantity);
  if (!validation.ok) return { ...validation, items };
  const item = {
    productId: product.id, slug: product.slug, name: product.name,
    price: effectivePrice(product), color: selection.color || '', size: selection.size || '',
    quantity, image: { ...product.images[0] }
  };
  const key = itemKey(item);
  const existing = items.find(entry => itemKey(entry) === key);
  const totalQuantity = (existing?.quantity || 0) + quantity;
  if (totalQuantity > validation.stock) {
    return { ok: false, items, message: `Sua sacola já tem ${existing?.quantity || 0} unidade(s) desta variação. Limite demonstrativo: ${validation.stock}.` };
  }
  const next = existing
    ? items.map(entry => itemKey(entry) === key ? { ...item, quantity: totalQuantity } : { ...entry })
    : [...items.map(entry => ({ ...entry })), item];
  return { ok: true, items: next, message: 'Peça adicionada à sacola local. Nenhuma compra foi realizada.' };
}

export function updateItemQuantity(items, key, quantity, source = products) {
  const item = items.find(entry => itemKey(entry) === key);
  if (!item) return { ok: false, items, message: 'Este item não está mais na sacola.' };
  const product = findProduct({ id: item.productId }, source);
  const validation = validateSelection(product, item, quantity);
  if (!validation.ok) return { ...validation, items };
  return {
    ok: true,
    items: items.map(entry => itemKey(entry) === key ? { ...entry, quantity, price: effectivePrice(product) } : { ...entry }),
    message: 'Quantidade atualizada na sacola.'
  };
}

export const removeItem = (items, key) => items.filter(item => itemKey(item) !== key);

export function readCart(storage, source = products) {
  try {
    const saved = JSON.parse(storage?.getItem(CART_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    let items = [];
    for (const entry of saved) {
      if (!entry || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) continue;
      const product = findProduct({ id: entry.productId }, source);
      const selection = { color: entry.color || '', size: entry.size || '' };
      const validation = validateSelection(product, selection);
      if (!validation.ok) continue;
      const existing = items.find(item => itemKey(item) === itemKey(entry));
      const remaining = validation.stock - (existing?.quantity || 0);
      if (remaining < 1) continue;
      const result = addItem(items, product, selection, Math.min(entry.quantity, remaining));
      if (result.ok) items = result.items;
    }
    return items;
  } catch {
    return [];
  }
}

export function writeCart(storage, items) {
  try {
    storage?.setItem(CART_KEY, JSON.stringify(items));
    return Boolean(storage);
  } catch { return false; }
}

export function createCartStore(storage) {
  let items = readCart(storage);
  let persistent = Boolean(storage);
  const listeners = new Set();
  const snapshot = () => items.map(item => ({ ...item, image: { ...item.image } }));
  const emit = () => listeners.forEach(listener => listener(snapshot()));
  function save(next) {
    items = next;
    persistent = writeCart(storage, items);
    emit();
    return persistent;
  }
  return {
    getItems: snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    add(product, selection, quantity) {
      if (persistent) items = readCart(storage);
      const result = addItem(items, product, selection, quantity);
      if (!result.ok) { emit(); return result; }
      const saved = save(result.items);
      return { ...result, persistent: saved, message: result.message + (saved ? '' : ' Armazenamento indisponível: os itens ficam apenas nesta página.') };
    },
    updateQuantity(key, quantity) {
      if (persistent) items = readCart(storage);
      const result = updateItemQuantity(items, key, quantity);
      if (!result.ok) { emit(); return result; }
      const saved = save(result.items);
      return { ...result, persistent: saved, message: result.message + (saved ? '' : ' A alteração fica apenas nesta página.') };
    },
    remove(key) {
      if (persistent) items = readCart(storage);
      return save(removeItem(items, key));
    },
    refresh() {
      if (persistent) { items = readCart(storage); emit(); }
    }
  };
}
