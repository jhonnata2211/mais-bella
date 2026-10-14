import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../public/js/data/products.mjs';
import { catalogOptions, effectivePrice, normalize, queryProducts } from '../public/js/catalog.mjs';
import { productCard, productURL } from '../public/js/products.mjs';
import { FAVORITES_KEY, readFavorites, writeFavorites } from '../public/js/storefront.mjs';

const ids = list => list.map(product => product.id);

test('modelo: 12 produtos, IDs/slugs únicos, preços e estoques numéricos coerentes', () => {
  assert.equal(products.length, 12);
  assert.equal(new Set(ids(products)).size, 12);
  assert.equal(new Set(products.map(product => product.slug)).size, 12);
  assert.equal(new Set(products.map(product => product.category)).size, 5);
  for (const product of products) {
    for (const field of ['id', 'slug', 'name', 'shortDescription', 'description', 'category', 'createdAt']) assert.ok(product[field]);
    assert.ok(Number.isFinite(product.price) && product.price > 0);
    if (product.promotionalPrice !== undefined) assert.ok(product.promotionalPrice > 0 && product.promotionalPrice < product.price);
    for (const field of ['featured', 'isNew', 'bestSeller', 'active']) assert.equal(typeof product[field], 'boolean');
    assert.ok(product.images.length && product.images.every(image => image.alt));
    assert.ok(product.colors.length && product.sizes.length);
    for (const variation of product.variations) {
      assert.ok(product.colors.includes(variation.color));
      assert.ok(product.sizes.includes(variation.size));
      assert.ok(Number.isInteger(variation.stock) && variation.stock >= 0);
    }
  }
});

test('filtro por categoria', () => {
  assert.deepEqual(new Set(ids(queryProducts(products, { category: 'Vestidos' }))), new Set(['vestido', 'vestido-luna']));
  assert.equal(queryProducts(products, { category: 'Inexistente' }).length, 0);
});

test('filtro por tamanho, incluindo PP e GG', () => {
  const pp = queryProducts(products, { size: 'PP' });
  assert.equal(pp.length, 5);
  assert.ok(pp.every(product => product.sizes.includes('PP')));
  assert.ok(queryProducts(products, { size: 'GG' }).every(product => product.sizes.includes('GG')));
  assert.equal(queryProducts(products, { size: 'XXL' }).length, 0);
});

test('filtros de categoria, cor e tamanho são combinados', () => {
  assert.deepEqual(ids(queryProducts(products, { category: 'Calças', size: 'GG', color: 'Chumbo' })), ['calca']);
  const sample = { ...products[0], variations: [{ color: 'Nude', size: 'P', stock: 2 }, { color: 'Rosa queimado', size: 'M', stock: 0 }] };
  assert.equal(queryProducts([sample], { size: 'M', color: 'Nude' }).length, 0);
  assert.equal(queryProducts([sample], { size: 'M', color: 'Rosa queimado' }).length, 1);
});

test('busca por nome ignora acentos, caixa e espaços externos', () => {
  assert.equal(normalize('  AMÉLIA  '), 'amelia');
  assert.deepEqual(ids(queryProducts(products, { search: '  AMELIA  ' })), ['calca']);
  assert.deepEqual(ids(queryProducts(products, { search: 'cecília' })), ['blusa-cecilia']);
});

test('busca pesquisa categoria, descrições curta e completa', () => {
  assert.equal(queryProducts(products, { search: 'vestidos' }).length, 2);
  assert.deepEqual(ids(queryProducts(products, { search: 'pregas frontais' })), ['calca']);
  assert.deepEqual(ids(queryProducts(products, { search: 'entardecer' })), ['vestido-luna']);
  assert.deepEqual(ids(queryProducts(products, { search: 'mangas delicadas' })), ['blusa-cecilia']);
  assert.equal(queryProducts(products, { search: 'não-existe-na-coleção' }).length, 0);
});

test('ordenação crescente e decrescente usa o preço promocional efetivo', () => {
  const ascending = queryProducts(products, { sort: 'price-asc' }).map(effectivePrice);
  const descending = queryProducts(products, { sort: 'price-desc' }).map(effectivePrice);
  assert.deepEqual(ascending, [...ascending].sort((a, b) => a - b));
  assert.deepEqual(descending, [...ascending].reverse());
  assert.equal(ascending[0], 99.90);
  assert.equal(descending[0], 299.90);
});

test('faixa de preço é inclusiva e considera promoção', () => {
  assert.deepEqual(new Set(ids(queryProducts(products, { minPrice: 179.90, maxPrice: 189.90 }))), new Set(['calca', 'vestido']));
  assert.equal(queryProducts(products, { minPrice: 500, maxPrice: 100 }).length, 0);
  assert.equal(queryProducts(products, { minPrice: '', maxPrice: '' }).length, 12);
  assert.equal(queryProducts(products, { maxPrice: 0 }).length, 0);
});

test('ordenação por nome e novidades; consulta não altera fonte', () => {
  const before = ids(products);
  const names = queryProducts(products, { sort: 'name' }).map(product => product.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  assert.equal(queryProducts(products)[0].id, 'vestido');
  assert.equal(queryProducts(products, { newOnly: true }).length, 5);
  assert.equal(queryProducts(products, { bestOnly: true }).length, 4);
  assert.deepEqual(ids(products), before);
});

test('inativos não aparecem nas consultas nem nas opções de filtro', () => {
  const inactive = { ...products[0], id: 'inativo', active: false, colors: ['Azul'], sizes: ['XG'], category: 'Outra' };
  assert.equal(queryProducts([inactive]).length, 0);
  const options = catalogOptions([...products, inactive]);
  assert.ok(!options.colors.includes('Azul'));
  assert.ok(!options.categories.includes('Outra'));
  assert.deepEqual(options.sizes, ['PP', 'P', 'M', 'G', 'GG']);
});

test('promoção opcional e valores inválidos não substituem preço base', () => {
  assert.equal(effectivePrice(products[0]), 189.90);
  assert.equal(effectivePrice(products[1]), 259.90);
  for (const promotionalPrice of [NaN, -1, 300]) assert.equal(effectivePrice({ price: 200, promotionalPrice }), 200);
  assert.equal(queryProducts(products, { promotionsOnly: true }).length, 5);
});

test('favoritos usam IDs e suportam filtro vazio', () => {
  assert.deepEqual(ids(queryProducts(products, { favoritesOnly: true, favorites: new Set(['blusa']) })), ['blusa']);
  assert.equal(queryProducts(products, { favoritesOnly: true }).length, 0);
});

test('favoritos persistem com IDs válidos e toleram dados inválidos/bloqueio', () => {
  const storage = { value: null, getItem(key) { assert.equal(key, FAVORITES_KEY); return this.value; }, setItem(key, value) { assert.equal(key, FAVORITES_KEY); this.value = value; } };
  assert.ok(writeFavorites(storage, new Set(['vestido', 'blusa'])));
  assert.deepEqual([...readFavorites(storage)], ['vestido', 'blusa']);
  storage.value = '["vestido", "desconhecido", 3, "vestido"]';
  assert.deepEqual([...readFavorites(storage)], ['vestido']);
  for (const malformed of ['{', 'null', '{}', '42']) {
    storage.value = malformed;
    assert.equal(readFavorites(storage).size, 0);
  }
  const blocked = { getItem() { throw Error('bloqueado'); }, setItem() { throw Error('bloqueado'); } };
  assert.equal(readFavorites(blocked).size, 0);
  assert.equal(writeFavorites(blocked, new Set()), false);
});

test('card reutilizável inclui indicadores, preço, favorito e seleção por slug', () => {
  const card = productCard(products[0], new Set(['vestido']));
  assert.ok(card.includes('Novo') && card.includes('Promoção'));
  assert.ok(card.includes('aria-pressed="true"'));
  assert.ok(card.includes('data-favorite="vestido"'));
  assert.ok(card.includes('3x de') && card.includes('demo'));
  assert.equal(productURL(products[0]), '/produto.html?slug=vestido-midi-essencia');
  assert.ok(!productCard(products[1]).includes('<s>'));
});

test('card escapa dados textuais antes de renderizar HTML', () => {
  const card = productCard({ ...products[0], name: '<script>alert("x")</script>', images: [{ type: 'illustration', alt: '" onmouseover="alert(1)', tone: 'rose', shape: 'dress' }] });
  assert.ok(!card.includes('<script>'));
  assert.ok(card.includes('&lt;script&gt;'));
  assert.ok(card.includes('&quot; onmouseover=&quot;'));
});
