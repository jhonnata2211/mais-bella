import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LOW_STOCK_LIMIT, stockState, stockSummary, stockRows, dashboardMetrics, filterProducts, slugFromName, parseMoney, money, productWithStatus, productPayload, draftChanged } from '../public/js/admin-model.mjs';
const require = createRequire(import.meta.url);
const { validateProduct } = require('../src/services/validation');

// Dados exclusivos do teste, sem carregar banco/.env nem cadastrar produtos na loja.
const categories = [{ id: 'vestidos', name: 'Vestidos', active: true }, { id: 'blusas', name: 'Blusas', active: false }];
const variations = [
  { id: 'azul-p', color: 'Azul', size: 'P', stock: 0, active: true },
  { id: 'azul-m', color: 'Azul', size: 'M', stock: 3, active: true },
  { id: 'azul-g', color: 'Azul', size: 'G', stock: 4, active: true },
  { id: 'nude-g', color: 'Nude', size: 'G', stock: 0, active: false }
];
const products = [
  { id: 'essencia', name: 'Vestido Essência', categoryId: 'vestidos', active: true, demo: true, variations },
  { id: 'amelia', name: 'Blusa Amélia', categoryId: 'blusas', active: false, variations: [{ color: 'Rosa', size: 'M', stock: 1, active: true }] },
  { id: 'sem-ativas', name: 'Peça sem opções ativas', categoryId: 'blusas', active: true, variations: [{ color: 'Branco', size: 'P', stock: 20, active: false }] }
];
function values(overrides = {}) {
  return { name: 'Peça de teste', slug: 'peca-de-teste', shortDescription: 'Descrição curta', description: 'Descrição completa', categoryId: 'vestidos', price: '129,90', promotion: '', image: '', active: true, featured: false, isNew: false, bestSeller: false, ...overrides };
}

test('dashboard usa cadastros reais: produtos, status, categorias e marca demonstrativa separados', () => {
  assert.deepEqual(dashboardMetrics(products, categories), { total: 3, active: 2, inactive: 1, empty: 1, low: 2, categories: 2, demo: 1 });
  assert.deepEqual(dashboardMetrics([], []), { total: 0, active: 0, inactive: 0, empty: 0, low: 0, categories: 0, demo: 0 });
});
test('estoque baixo inclui 1 a 3, esgotado é zero e disponível começa em 4', () => {
  assert.equal(LOW_STOCK_LIMIT, 3);
  assert.deepEqual(stockState(0), { key: 'empty', label: 'Esgotado' });
  for (const n of [1, 2, 3]) assert.equal(stockState(n).key, 'low');
  for (const n of [4, 1000000]) assert.equal(stockState(n).key, 'available');
});
test('resumo exclui variações inativas sem ocultar estoque de produtos inativos', () => {
  assert.deepEqual(stockSummary(products[0]), { units: 7, variations: 3, empty: 1, low: 1 });
  assert.deepEqual(stockSummary(products[1]), { units: 1, variations: 1, empty: 0, low: 1 });
  assert.deepEqual(stockSummary(products[2]), { units: 0, variations: 0, empty: 0, low: 0 });
});
test('busca por nome ignora acentos e caixa e combina palavras, categoria e status', () => {
  assert.deepEqual(filterProducts(products, { search: 'ESSENCIA vestido', status: 'active', categoryId: 'vestidos' }).map(p => p.id), ['essencia']);
  assert.deepEqual(filterProducts(products, { search: 'AMÉLIA', status: 'inactive', categoryId: 'blusas' }).map(p => p.id), ['amelia']);
  assert.equal(filterProducts(products, { search: 'Amélia', status: 'active' }).length, 0);
  assert.equal(filterProducts(products, { categoryId: 'vestidos', status: 'inactive' }).length, 0);
  assert.equal(filterProducts(products, { search: 'Rosa' }).length, 0); // Busca de Produtos é por nome.
  assert.equal(filterProducts(products).length, 3);
  assert.equal(filterProducts([], {}).length, 0);
});
test('estoque combina nome/cor/tamanho e situação, com inclusão explícita de variações inativas', () => {
  assert.equal(stockRows(products).length, 4);
  assert.equal(stockRows(products, { includeInactive: true }).length, 6);
  assert.equal(stockRows(products, { status: 'empty' }).length, 1);
  assert.equal(stockRows(products, { status: 'empty', includeInactive: true }).length, 2);
  assert.equal(stockRows(products, { search: 'ESSÊNCIA AZUL M', status: 'low' })[0].variation.id, 'azul-m');
  assert.equal(stockRows(products, { search: 'nude' }).length, 0);
  assert.equal(stockRows(products, { search: 'nude', includeInactive: true }).length, 1);
  assert.equal(stockRows(products, { status: 'available' }).length, 1);
  assert.equal(stockRows(products, { search: 'inexistente' }).length, 0);
});
test('filtros e contagens não alteram produtos, variações nem seus estoques', () => {
  const before = structuredClone(products);
  dashboardMetrics(products, categories); filterProducts(products, { search: 'peça' }); stockRows(products, { includeInactive: true }); products.forEach(stockSummary);
  assert.deepEqual(products, before);
});
test('endereço sugerido é compatível com slug do servidor e limitado a 120 caracteres', () => {
  assert.equal(slugFromName(' Vestido Essência & Rosa! '), 'vestido-essencia-rosa');
  assert.equal(slugFromName('Calça Amélia 2026'), 'calca-amelia-2026');
  assert.equal(slugFromName('😀'), ''); // Não inventa identificador; formulário exige preenchimento.
  assert.ok(slugFromName('a-'.repeat(100)).length <= 120);
  assert.ok(!slugFromName('a-'.repeat(100)).endsWith('-'));
});
test('conversão de reais preserva centavos e recusa formatos ambíguos antes do envio', () => {
  for (const [input, cents] of [['129,90', 12990], ['0,29', 29], ['19.9', 1990], ['0', 0], [' 10,00 ', 1000]]) assert.equal(parseMoney(input), cents);
  for (const input of ['1,234', 'R$ 10', '-1', 'NaN', '1.000,00', '1e2', '']) assert.throws(() => parseMoney(input));
  assert.match(money(12990), /129,90/);
});
test('cadastro sem foto gera ilustração provisória válida, sem produto demonstrativo inventado', () => {
  const payload = productPayload(values(), variations, null, 'nova-peca');
  const checked = validateProduct(payload);
  assert.equal(checked.id, 'nova-peca'); assert.equal(checked.priceCents, 12990); assert.equal(checked.promotionalPriceCents, null);
  assert.equal(checked.images[0].type, 'illustration'); assert.match(checked.images[0].alt, /sem fotografia/); assert.equal(checked.demo, false);
});
test('edição mantém ID, galeria e variações inativas; promoção vazia vira null', () => {
  const existing = { ...products[0], images: [{ id: 'foto-existente', type: 'image', src: '/assets/peca.webp', alt: 'Foto real', primary: true }] };
  const payload = productPayload(values({ image: '/assets/outra.webp', promotion: '' }), variations, existing, 'id-descartado');
  const checked = validateProduct(payload);
  assert.equal(checked.id, existing.id); assert.deepEqual(payload.images, existing.images); assert.equal(checked.variations.length, 4); assert.equal(checked.variations[3].active, false); assert.equal(checked.promotionalPriceCents, null);
});
test('foto preparada e promoção são enviadas pelo mesmo contrato administrativo existente', () => {
  const payload = productPayload(values({ image: '/assets/foto.webp', promotion: '99,90' }), variations, null, 'nova-peca');
  const checked = validateProduct(payload); assert.equal(checked.images[0].src, '/assets/foto.webp'); assert.equal(checked.promotionalPriceCents, 9990);
  // Servidor mantém a palavra final para estoque e promoção, inclusive valores fora dos limites.
  assert.throws(() => validateProduct(productPayload(values({ promotion: '150,00' }), variations, null, 'teste')));
  assert.throws(() => validateProduct(productPayload(values(), [{ color: 'A', size: 'M', stock: -1 }], null, 'teste')));
});
test('ativação/desativação preserva preço, imagens, flags e todo o estoque no PUT completo', () => {
  const original = { ...products[0], images: [{ type: 'image', src: '/assets/roupa.webp' }], priceCents: 19900, promotionalPriceCents: 15900, featured: true };
  const before = structuredClone(original), changed = productWithStatus(original, false);
  assert.deepEqual(changed, { ...original, active: false }); assert.deepEqual(original, before);
  const noPromotion = productWithStatus({ ...original, promotionalPriceCents: undefined }, true); assert.equal(noPromotion.promotionalPriceCents, null);
});
test('rascunho detecta texto, checkbox, remoção de variação e permite voltar ao valor salvo', () => {
  const saved = [['name', 'Vestido'], ['active', 'on'], ['color-id', 'Azul'], ['stock-id', '3']];
  const baseline = JSON.stringify(saved);
  assert.equal(draftChanged(baseline, structuredClone(saved)), false);
  assert.equal(draftChanged(baseline, [['name', 'Vestido'], ['color-id', 'Azul'], ['stock-id', '3']]), true);
  assert.equal(draftChanged(baseline, [['name', 'Vestido'], ['active', 'on']]), true);
  const edited = structuredClone(saved); edited[3][1] = '4'; assert.equal(draftChanged(baseline, edited), true); edited[3][1] = '3'; assert.equal(draftChanged(baseline, edited), false);
});
