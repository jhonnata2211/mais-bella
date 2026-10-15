import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { products, categories, replaceCatalog, loadCatalog } from '../public/js/data/products.mjs';
import { isDemoProduct, hasDemoItems, applyDemoNotices } from '../public/js/commerce.mjs';
import { addItem, createCartStore, cartSubtotal, itemKey, reconcileCart, CART_KEY } from '../public/js/cart.mjs';
import { validateSelection, getVariation, simplifySelection } from '../public/js/product-model.mjs';
import { generateOrderMessage, prepareWhatsAppOrder, validateOrder } from '../public/js/whatsapp.mjs';
import { reviewWhatsAppOrder } from '../public/js/cart-checkout.mjs';
import { productCard, productVisual, money } from '../public/js/products.mjs';
import { cartContent } from '../public/js/cart-panel.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../src/db/database');
const { CatalogService } = require('../src/services/catalog-service');
const { CatalogRepository } = require('../src/repositories/catalog-repository');
const { createApp } = require('../src/app');
const { getConfig } = require('../src/config');
const details = { name: 'Cliente de teste', phone: '12345123456', city: 'Cidade de teste', neighborhood: 'Bairro de teste', receiving: 'delivery' };
const number = '1'.repeat(11); // Apenas formato; nenhum teste abre ou envia conversa.
const selection = { color: 'Azul', size: 'M' };
function product(overrides = {}) {
  return { id: 'real', slug: 'peca-real', name: 'Peça real ♡', shortDescription: 'Descrição curta', description: 'Descrição completa', categoryId: 'roupas', category: 'Roupas', active: true, demo: false, price: 129.90, promotionalPrice: 119.90, priceCents: 12990, promotionalPriceCents: 11990,
    featured: true, isNew: true, bestSeller: false, images: [{ type: 'image', src: '/uploads/products/' + 'a'.repeat(32) + '.png', alt: 'Foto da peça', primary: true }], colors: ['Azul'], sizes: ['M', 'G'], variations: [{ id: 'm', color: 'Azul', size: 'M', stock: 5, active: true }, { id: 'g', color: 'Azul', size: 'G', stock: 0, active: true }], ...overrides };
}
function catalog(t, source = [product()]) {
  const before = [...products], beforeCategories = [...categories];
  replaceCatalog(source, []); t.after(() => replaceCatalog(before, beforeCategories)); return source;
}
function storage() { const values = new Map(); return { values, getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; }
function cart(t, source = [product()], quantity = 2, local = storage()) {
  catalog(t, source); const store = createCartStore(local); store.add(source[0], selection, quantity); return { store, local };
}

test('produto real: imagem da principal, preço promocional e sacola sem alegações demonstrativas', t => {
  const { store } = cart(t); const p = products[0];
  assert.equal(validateSelection(p, selection, 5).ok, true); assert.match(productVisual(p.images[0], p.name), /<img/);
  const card = productCard(p); assert.ok(card.includes(money(119.90))); assert.ok(card.includes(money(129.90))); assert.ok(!/demo|fictício|3x de/.test(card));
  const markup = cartContent(store.getItems(), { editable: true }); assert.ok(markup.includes('Preço unitário:')); assert.ok(markup.includes('Quantidade: 2')); assert.ok(markup.includes('Disponível: 5 unidades')); assert.ok(!/demonstrativo|fictício/.test(markup));
  assert.equal(cartSubtotal(store.getItems()), 239.80);
});
test('esgotado e variação inativa são recusados; opção única em estoque é selecionada sem inventar opções', () => {
  const p = product(); assert.equal(validateSelection(p, { color: 'Azul', size: 'G' }).message, 'Essa opção está esgotada.');
  assert.deepEqual(simplifySelection(p), selection); assert.equal(addItem([], p, { color: 'Azul', size: 'G' }).ok, false);
  const inactive = { ...p, variations: p.variations.map(v => ({ ...v, active: false })) }; assert.equal(getVariation(inactive, selection), null); assert.equal(validateSelection(inactive, selection).ok, false);
  assert.deepEqual(simplifySelection(inactive), { color: '', size: '' });
  const multiple = { ...p, colors: ['Azul', 'Rosa'], variations: [...p.variations, { color: 'Rosa', size: 'M', stock: 1, active: true }] }; assert.deepEqual(simplifySelection(multiple), { color: '', size: '' });
  assert.deepEqual(simplifySelection(multiple, { color: 'Rosa' }), { color: 'Rosa', size: 'M' });
});
test('mensagem real organizada usa total dos produtos, dados, recebimento e nenhuma classificação demonstrativa', t => {
  const { store } = cart(t); const message = generateOrderMessage(store.getItems(), details);
  for (const text of ['Olá! Quero fazer um pedido na Mais Bella ♡', 'MEU PEDIDO', '1. Peça real ♡', 'Cor: Azul', 'Tamanho: M', 'Quantidade: 2', `Valor unitário: ${money(119.90)}`, `Subtotal: ${money(239.80)}`, `Total dos produtos: ${money(239.80)}`, 'DADOS', 'RECEBIMENTO', 'Entrega', 'Gostaria de confirmar a disponibilidade, entrega e forma de pagamento.']) assert.ok(message.includes(text), text);
  assert.equal(message.match(/^Subtotal: /gm)?.length, 1);
  assert.equal(message.match(/^Total dos produtos: /gm)?.length, 1);
  assert.ok(!/demonstrativo|fictício|demo\b/i.test(message));
  const result = prepareWhatsAppOrder(store.getItems(), { ...details, receiving: 'pickup', name: 'Ana & Lívia + 10% #♡' }, number);
  assert.equal(result.ok, true); assert.equal(new URL(result.url).searchParams.get('text'), result.message); assert.match(result.message, /Retirada/); assert.ok(result.message.includes('Ana & Lívia + 10% #♡'));
});
test('modo misto mantém avisos apenas para os itens marcados demo pelo catálogo', t => {
  const real = product(), demo = product({ id: 'demo', slug: 'demo', name: 'Peça de teste', demo: true }); catalog(t, [real, demo]);
  const items = addItem(addItem([], real, selection).items, demo, selection).items;
  const message = generateOrderMessage(items, details); assert.ok(message.includes('1. Peça real ♡\n')); assert.ok(message.includes('2. Peça de teste [DEMONSTRATIVO]'));
  assert.equal(hasDemoItems(items, products), true); assert.equal(isDemoProduct({ demo: 'false' }), false);
  assert.equal(hasDemoItems([{ ...items[0], demo: true }], [real]), false); // O localStorage não controla essa classificação.
});
test('avisos globais de demonstração ficam ocultos com catálogo real ou vazio', () => {
  const notes = [{ hidden: false }, { hidden: false }]; const root = { querySelectorAll: () => notes };
  applyDemoNotices([product()], root); assert.ok(notes.every(note => note.hidden));
  applyDemoNotices([product({ demo: true })], root); assert.ok(notes.every(note => !note.hidden));
  applyDemoNotices([], root); assert.ok(notes.every(note => note.hidden));
});
test('reconciliação limita estoque e recompõe preço/foto sem confiar nos dados locais', () => {
  const p = product(); const saved = [{ productId: p.id, color: 'Azul', size: 'M', quantity: 50, price: .01, name: 'Nome adulterado', slug: 'falso', image: { src: 'https://externo' } }];
  const result = reconcileCart(saved, [p]); assert.equal(result.items[0].quantity, 5); assert.equal(result.items[0].price, 119.90); assert.deepEqual(result.items[0].image, p.images[0]); assert.ok(result.changes.length);
  assert.deepEqual(reconcileCart(saved, []).items, []);
});
test('estoque menor bloqueia a primeira finalização, informa ajuste e permite confirmar depois', async t => {
  const { store } = cart(t); const updated = product({ variations: [{ ...product().variations[0], stock: 1 }] });
  const refreshCatalog = async () => replaceCatalog([updated], []);
  let result = await reviewWhatsAppOrder(store, details, { refreshCatalog, number }); assert.equal(result.ok, false); assert.equal(result.changed, true); assert.match(result.errors.cart, /estoque disponível/); assert.equal(result.url, undefined); assert.equal(store.getItems()[0].quantity, 1);
  result = await reviewWhatsAppOrder(store, details, { refreshCatalog, number }); assert.equal(result.ok, true); assert.match(result.message, /Quantidade: 1/);
});
test('preço alterado exige revisão e depois usa exclusivamente o valor atualizado', async t => {
  const { store } = cart(t); const updated = product({ promotionalPrice: 99.90, promotionalPriceCents: 9990 });
  const refreshCatalog = async () => replaceCatalog([updated], []);
  const result = await reviewWhatsAppOrder(store, details, { refreshCatalog, number }); assert.equal(result.ok, false); assert.match(result.errors.cart, /preço foi atualizado/);
  const next = await reviewWhatsAppOrder(store, details, { refreshCatalog, number }); assert.equal(next.ok, true); assert.ok(next.message.includes(money(199.80)));
});
test('estoque zero, produto desativado ou removido não abrem pedido nem reservam estoque', async t => {
  for (const mode of ['empty', 'removed']) {
    const { store } = cart(t); const source = mode === 'removed' ? [] : [product({ variations: product().variations.map(v => ({ ...v, stock: 0 })) })];
    const result = await reviewWhatsAppOrder(store, details, { refreshCatalog: async () => replaceCatalog(source, []), number }); assert.equal(result.ok, false); assert.equal(result.url, undefined); assert.deepEqual(store.getItems(), []);
  }
  assert.equal(validateSelection(product({ active: false }), selection).ok, false);
});
test('falha da API impede abertura e mantém a sacola intacta', async t => {
  const { store } = cart(t); const before = store.getItems();
  const result = await reviewWhatsAppOrder(store, details, { refreshCatalog: async () => { throw Error('offline'); }, number });
  assert.equal(result.ok, false); assert.match(result.errors.cart, /conferir a disponibilidade/); assert.deepEqual(store.getItems(), before); assert.equal(result.url, undefined);
});
test('fallback em memória também revalida estoque sem perder itens por armazenamento bloqueado', async t => {
  const blocked = { getItem() { throw Error('bloqueado'); }, setItem() { throw Error('bloqueado'); } }; const { store } = cart(t, [product()], 2, blocked);
  const result = await reviewWhatsAppOrder(store, details, { refreshCatalog: async () => replaceCatalog([product({ variations: [{ ...product().variations[0], stock: 1 }] })], []), number });
  assert.equal(result.ok, false); assert.equal(store.getItems()[0].quantity, 1);
});
test('alterações de quantidade em outra aba exigem nova revisão antes de abrir WhatsApp', async t => {
  const { store, local } = cart(t); const other = createCartStore(local); other.updateQuantity(itemKey(other.getItems()[0]), 3);
  const result = await reviewWhatsAppOrder(store, details, { refreshCatalog: async () => {}, number }); assert.equal(result.ok, false); assert.equal(result.changed, true); assert.equal(store.getItems()[0].quantity, 3);
  const pending = await reviewWhatsAppOrder(store, details, { refreshCatalog: async () => { other.updateQuantity(itemKey(other.getItems()[0]), 4); store.refresh(); }, number });
  assert.equal(pending.ok, false); assert.equal(pending.changed, true); assert.match(pending.errors.cart, /durante a conferência/);
});
test('dados pessoais inválidos e número comercial ausente são recusados sem navegação ou consulta desnecessária', async t => {
  const { store, local } = cart(t); let requests = 0;
  for (const supplied of [{}, { ...details, receiving: '' }, { ...details, phone: 'abc' }]) {
    const result = await reviewWhatsAppOrder(store, supplied, { refreshCatalog: async () => { requests++; }, number }); assert.equal(result.ok, false); assert.equal(result.url, undefined);
  }
  const missing = await reviewWhatsAppOrder(store, details, { refreshCatalog: async () => { requests++; }, number: '' }); assert.equal(missing.ok, false); assert.ok(missing.errors.whatsapp); assert.equal(requests, 0);
  assert.deepEqual([...local.values.keys()], [CART_KEY]); assert.ok(![...local.values.values()].some(value => value.includes(details.phone) || value.includes(details.city)));
});
test('integração HTTP/SQLite: estoque é relido antes de finalizar; chamadas não enviam dados do cliente', async t => {
  const before = [...products], beforeCategories = [...categories]; t.after(() => replaceCatalog(before, beforeCategories));
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const service = new CatalogService(new CatalogRepository(db));
  service.createCategory({ id: 'roupas', slug: 'roupas', name: 'Roupas' });
  service.createProduct({ ...product(), images: [{ type: 'image', src: '/assets/preparada.webp', alt: 'Foto preparada' }], categoryId: 'roupas' });
  const server = await new Promise(resolve => { const s = createApp({ db, config: getConfig({ SEED_DEMO: 'false' }) }).listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const calls = [], base = 'http://127.0.0.1:' + server.address().port;
  const fetcher = (url, options) => { calls.push({ url, options }); return fetch(base + url, options); };
  await loadCatalog(fetcher); const store = createCartStore(storage()); store.add(products[0], selection, 2);
  db.prepare('UPDATE product_variations SET stock=1 WHERE size=?').run('M');
  const refreshCatalog = () => loadCatalog(fetcher);
  assert.equal((await reviewWhatsAppOrder(store, details, { refreshCatalog, number })).changed, true);
  const result = await reviewWhatsAppOrder(store, details, { refreshCatalog, number }); assert.equal(result.ok, true); assert.match(result.message, /Quantidade: 1/);
  assert.equal(db.prepare('SELECT stock FROM product_variations WHERE size=?').get('M').stock, 1); // Sem reserva ou baixa.
  for (const call of calls) { assert.ok(['/api/products', '/api/categories'].includes(call.url)); assert.equal(call.options.body, undefined); assert.equal(call.options.method, undefined); }
});
test('revisão inicial pode persistir ajustes uma vez; avisos entre abas não geram gravações em ciclo', async t => {
  const p = product(); catalog(t, [p]); const local = storage();
  const item = addItem([], p, selection, 2).items[0];
  local.setItem(CART_KEY, JSON.stringify([{ ...item, quantity: 99 }]));
  let writes = 0; const originalWrite = local.setItem; local.setItem = (key, value) => { writes++; originalWrite(key, value); };
  const store = createCartStore(local); assert.equal(store.getItems()[0].quantity, 5);
  store.acknowledgeChanges(true); assert.equal(writes, 1); assert.equal(JSON.parse(local.getItem(CART_KEY))[0].quantity, 5);
  store.refresh(); store.acknowledgeChanges(); assert.equal(writes, 1);
  assert.equal((await reviewWhatsAppOrder(store, details, { refreshCatalog: async () => {}, number })).ok, true);
});

test('sacola identifica demonstrativos e só informa estoque numérico conhecido', t => {
  const { store } = cart(t); const items = store.getItems();
  replaceCatalog([product({ demo: true })], []);
  const demo = cartContent(items, { editable: true });
  assert.ok(demo.includes('Produto demonstrativo'));
  assert.ok(demo.includes('Limite demonstrativo: 5 unidade(s)'));
  for (const stock of [0, 1, 5, undefined, null, NaN, -1]) {
    const p = product(); p.variations[0].stock = stock; replaceCatalog([p], []);
    const markup = cartContent(items, { editable: true });
    assert.ok(!markup.includes('demonstrativo'));
    if (Number.isSafeInteger(stock) && stock >= 0) {
      assert.ok(markup.includes('Disponível: ' + stock + (stock === 1 ? ' unidade</p>' : ' unidades</p>')));
    } else {
      assert.ok(!markup.includes('cart-stock-note'));
      assert.match(markup, /data-cart-delta="1"[^>]*disabled/);
    }
  }
  replaceCatalog([], []);
  assert.ok(!cartContent(items, { editable: true }).includes('cart-stock-note'));
});
