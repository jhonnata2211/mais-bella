import { clearStoredKey } from './privacy.mjs';
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
    return { ok: false, items, message: `Sua sacola já tem ${existing?.quantity || 0} unidade(s) desta variação. Limite disponível: ${validation.stock}.` };
  }
  const next = existing
    ? items.map(entry => itemKey(entry) === key ? { ...item, quantity: totalQuantity } : { ...entry })
    : [...items.map(entry => ({ ...entry })), item];
  return { ok: true, items: next, message: 'Peça adicionada à sacola. Você pode continuar comprando ou revisar suas escolhas.' };
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

export function reconcileCart(saved, source = products) {
  const changes = [], normalized = [];
  if (!Array.isArray(saved)) return { items: [], changes };
  for (const entry of saved) {
    if (!entry || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) {
      changes.push('Um item com quantidade inválida foi removido.'); continue;
    }
    const product = findProduct({ id: entry.productId }, source);
    const selection = { color: entry.color || '', size: entry.size || '' };
    const validation = validateSelection(product, selection);
    if (!validation.ok) {
      changes.push(product ? product.name + ': essa opção está esgotada ou indisponível e foi removida.' : 'Uma peça indisponível foi removida da sacola.'); continue;
    }
    const existing = normalized.find(item => itemKey(item) === itemKey(entry));
    const remaining = validation.stock - (existing?.quantity || 0);
    if (entry.quantity > remaining) changes.push(product.name + ': ajustamos a quantidade ao estoque disponível (' + validation.stock + ').');
    if (entry.price !== undefined && entry.price !== effectivePrice(product)) changes.push(product.name + ': o preço foi atualizado.');
    if (entry.name !== undefined && (entry.name !== product.name || entry.slug !== product.slug)) changes.push(product.name + ': o cadastro foi atualizado.');
    if (remaining < 1) continue;
    const result = addItem(normalized, product, selection, Math.min(entry.quantity, remaining));
    if (result.ok) normalized.splice(0, normalized.length, ...result.items);
  }
  return { items: normalized, changes: [...new Set(changes)] };
}
function readCartState(storage, source = products) {
  try { return reconcileCart(JSON.parse(storage?.getItem(CART_KEY) || '[]'), source); }
  catch { return { items: [], changes: [], unavailable: true }; }
}
export function readCart(storage, source = products) { return readCartState(storage, source).items; }

export function writeCart(storage, items) {
  try {
    storage?.setItem(CART_KEY, JSON.stringify(items));
    return Boolean(storage);
  } catch { return false; }
}

export function createCartStore(storage) {
  const initial = readCartState(storage);
  let items = initial.items, changes = initial.changes;
  let persistent = Boolean(storage) && !initial.unavailable;
  const listeners = new Set();
  const snapshot = () => items.map(item => ({ ...item, image: { ...item.image } }));
  const emit = () => listeners.forEach(listener => listener(snapshot()));
  function readCurrent() {
    const report = readCartState(storage);
    if (report.unavailable) { persistent = false; return; }
    items = report.items; changes = [...new Set([...changes, ...report.changes])];
  }
  function save(next) {
    items = next;
    persistent = writeCart(storage, items);
    emit();
    return persistent;
  }
  return {
    getItems: snapshot,
    clear() {
      items = []; changes = []; persistent = clearStoredKey(storage, CART_KEY);
      emit(); return persistent;
    },
    getChanges: () => [...changes],
    acknowledgeChanges(persist = false) { changes = []; if (persist && persistent) persistent = writeCart(storage, items); },
    revalidate() {
      const previous = JSON.stringify(items.map(item => [itemKey(item), item.quantity, item.price]));
      if (persistent) readCurrent();
      const report = reconcileCart(items);
      changes = [...new Set([...changes, ...report.changes])];
      const current = JSON.stringify(report.items.map(item => [itemKey(item), item.quantity, item.price]));
      if (previous !== current && !changes.length) changes.push('Os itens da sacola foram atualizados. Confira as quantidades.');
      save(report.items);
      return { items: snapshot(), changes: [...changes] };
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    add(product, selection, quantity) {
      if (persistent) readCurrent();
      const result = addItem(items, product, selection, quantity);
      if (!result.ok) { emit(); return result; }
      const saved = save(result.items);
      return { ...result, persistent: saved, message: result.message + (saved ? '' : ' Armazenamento indisponível: os itens ficam apenas nesta página.') };
    },
    updateQuantity(key, quantity) {
      if (persistent) readCurrent();
      const result = updateItemQuantity(items, key, quantity);
      if (!result.ok) { emit(); return result; }
      const saved = save(result.items);
      return { ...result, persistent: saved, message: result.message + (saved ? '' : ' A alteração fica apenas nesta página.') };
    },
    remove(key) {
      if (persistent) readCurrent();
      return save(removeItem(items, key));
    },
    refresh() {
      if (persistent) { readCurrent(); emit(); }
    }
  };
}
