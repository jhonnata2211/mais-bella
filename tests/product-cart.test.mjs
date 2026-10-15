import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from './helpers/catalog-fixture.mjs';
import { findProduct, getVariation, validateSelection } from '../public/js/product-model.mjs';
import { effectivePrice } from '../public/js/catalog.mjs';
import { CART_KEY, addItem, cartCount, cartSubtotal, createCartStore, itemKey, readCart, removeItem, writeCart } from '../public/js/cart.mjs';

const product = products[0];
const selection = { color: 'Rosa queimado', size: 'M' }; // Estoque demonstrativo: 5.
const storage = () => ({ value: null, getItem(key) { assert.equal(key, CART_KEY); return this.value; }, setItem(key, value) { assert.equal(key, CART_KEY); this.value = value; } });

test('localiza produto ativo por slug ou ID; desconhecido/inativo retorna null', () => {
  assert.equal(findProduct({ slug: product.slug }), product);
  assert.equal(findProduct({ id: product.id }), product);
  assert.equal(findProduct({ slug: 'inexistente' }), null);
  assert.equal(findProduct(), null);
  assert.equal(findProduct({ slug: product.slug }, [{ ...product, active: false }]), null);
});

test('preço vigente usa promoção válida ou preço base', () => {
  assert.equal(effectivePrice(product), 189.90);
  assert.equal(effectivePrice(products[1]), 259.90);
  assert.equal(effectivePrice({ price: 100, promotionalPrice: 120 }), 100);
});

test('validação exige cor e tamanho e rejeita combinações inexistentes', () => {
  assert.match(validateSelection(product).message, /cor/);
  assert.match(validateSelection(product, { color: 'Nude' }).message, /tamanho/);
  assert.equal(getVariation(product, { color: 'Azul', size: 'M' }), null);
  assert.equal(validateSelection(product, { color: 'Nude', size: 'XG' }).ok, false);
  assert.equal(getVariation(product, selection).stock, 5);
  assert.equal(validateSelection(product, selection).ok, true);
});

test('variação esgotada, quantidade zero, fracionária e acima do estoque são recusadas', () => {
  assert.equal(validateSelection(product, { color: 'Rosa queimado', size: 'P' }).ok, false);
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 6]) assert.equal(validateSelection(product, selection, quantity).ok, false);
  assert.equal(validateSelection(product, selection, 5).ok, true);
});

test('adiciona item com dados completos e não altera produto/estoque ou lista original', () => {
  const before = JSON.stringify(product);
  const original = [];
  const result = addItem(original, product, selection, 2);
  assert.equal(result.ok, true);
  assert.equal(original.length, 0);
  assert.deepEqual(result.items[0], { productId: product.id, slug: product.slug, name: product.name, price: 189.90, color: selection.color, size: selection.size, quantity: 2, image: product.images[0] });
  assert.equal(JSON.stringify(product), before);
  assert.equal(cartCount(result.items), 2);
  assert.equal(cartSubtotal(result.items), 379.80);
});

test('combina mesmo produto/cor/tamanho e respeita quantidade total no estoque', () => {
  const first = addItem([], product, selection, 2).items;
  const result = addItem(first, product, selection, 3);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 5);
  assert.equal(first[0].quantity, 2);
  const rejected = addItem(result.items, product, selection, 1);
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.items, result.items);
});

test('cores e tamanhos diferentes permanecem em itens separados', () => {
  let items = addItem([], product, selection).items;
  items = addItem(items, product, { color: 'Rosa queimado', size: 'G' }).items;
  items = addItem(items, product, { color: 'Nude', size: 'M' }).items;
  assert.equal(items.length, 3);
  assert.equal(new Set(items.map(itemKey)).size, 3);
});

test('recusa adição esgotada ou sem opções sem modificar a sacola', () => {
  const initial = addItem([], product, selection).items;
  for (const invalid of [{}, { color: 'Azul', size: 'M' }, { color: 'Rosa queimado', size: 'P' }]) {
    const result = addItem(initial, product, invalid, 1);
    assert.equal(result.ok, false);
    assert.deepEqual(result.items, initial);
  }
});

test('remoção usa chave da variação, preserva as outras e permite sacola vazia', () => {
  const first = addItem([], product, selection).items;
  const items = addItem(first, product, { color: 'Nude', size: 'M' }).items;
  const result = removeItem(items, itemKey(first[0]));
  assert.equal(result.length, 1);
  assert.equal(result[0].color, 'Nude');
  assert.equal(items.length, 2);
  assert.deepEqual(removeItem(result, itemKey(result[0])), []);
  assert.deepEqual(removeItem(result, 'inexistente'), result);
});

test('persistência recompõe dados do catálogo e mantém itens após recarregar', () => {
  const local = storage();
  const items = addItem([], product, selection, 2).items;
  assert.ok(writeCart(local, items));
  assert.deepEqual(readCart(local), items);
  const loaded = createCartStore(local);
  assert.equal(loaded.getItems()[0].quantity, 2);
  const result = loaded.add(product, selection, 1);
  assert.equal(result.persistent, true);
  assert.equal(createCartStore(local).getItems()[0].quantity, 3);
});

test('dados locais inválidos são ignorados; estoque/preços/imagens não são confiados ao armazenamento', () => {
  const local = storage();
  const valid = addItem([], product, selection, 2).items[0];
  local.value = JSON.stringify([{ ...valid, quantity: 100, price: 0.01, name: 'Falso', image: { src: 'https://externo' } }, { ...valid, quantity: 2 }, { ...valid, productId: 'inexistente' }, { ...valid, size: 'P' }, { ...valid, quantity: 1.5 }, null]);
  const read = readCart(local);
  assert.equal(read.length, 1);
  assert.equal(read[0].quantity, 5);
  assert.equal(read[0].price, 189.90);
  assert.equal(read[0].name, product.name);
  assert.deepEqual(read[0].image, product.images[0]);
  for (const bad of ['{', 'null', '{}', '42']) { local.value = bad; assert.deepEqual(readCart(local), []); }
});

test('subtotal soma centavos sem erro de ponto flutuante', () => {
  assert.equal(cartSubtotal([{ price: 0.10, quantity: 1 }, { price: 0.20, quantity: 1 }]), 0.30);
});

test('store tolera bloqueio de armazenamento com fallback em memória e notificações', () => {
  const blocked = { getItem() { throw Error('bloqueado'); }, setItem() { throw Error('bloqueado'); } };
  const store = createCartStore(blocked);
  let changes = 0;
  store.subscribe(() => changes++);
  const result = store.add(product, selection, 1);
  assert.equal(result.ok, true);
  assert.equal(result.persistent, false);
  assert.match(result.message, /apenas nesta página/);
  assert.equal(store.add(product, selection, 1).items[0].quantity, 2);
  assert.equal(store.getItems()[0].quantity, 2);
  store.remove(itemKey(store.getItems()[0]));
  assert.deepEqual(store.getItems(), []);
  assert.equal(changes, 3);
});

test('store relê alterações locais antes de adicionar/remover e protege seus snapshots', () => {
  const local = storage();
  const a = createCartStore(local);
  const b = createCartStore(local);
  a.add(product, selection, 2);
  b.add(product, selection, 2);
  a.refresh();
  assert.equal(a.getItems()[0].quantity, 4);
  assert.equal(a.add(product, selection, 2).ok, false);
  const copy = a.getItems();
  copy[0].quantity = 100;
  copy[0].image.alt = 'alterado';
  assert.equal(a.getItems()[0].quantity, 4);
  assert.equal(a.getItems()[0].image.alt, product.images[0].alt);
  b.remove(itemKey(b.getItems()[0]));
  a.refresh();
  assert.deepEqual(a.getItems(), []);
});

test('produto sem variações exige estoque simples explícito', () => {
  const simple = { ...product, colors: [], sizes: [], variations: [], stock: 3 };
  assert.equal(validateSelection(simple, {}, 3).ok, true);
  assert.equal(validateSelection(simple, {}, 4).ok, false);
  assert.equal(validateSelection({ ...simple, stock: undefined }, {}).ok, false);
});
