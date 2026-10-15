// Apresentação administrativa. O servidor continua responsável pela validação final.
export const LOW_STOCK_LIMIT = 3;
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function stockState(stock) {
  if (stock === 0) return { key: 'empty', label: 'Esgotado' };
  if (stock <= LOW_STOCK_LIMIT) return { key: 'low', label: 'Estoque baixo' };
  return { key: 'available', label: 'Disponível' };
}
export function stockSummary(product) {
  const variations = product.variations.filter(v => v.active);
  return {
    units: variations.reduce((sum, v) => sum + v.stock, 0),
    variations: variations.length,
    empty: variations.filter(v => v.stock === 0).length,
    low: variations.filter(v => stockState(v.stock).key === 'low').length
  };
}
export function dashboardMetrics(products, categories) {
  return {
    total: products.length,
    active: products.filter(p => p.active).length,
    inactive: products.filter(p => !p.active).length,
    empty: products.reduce((sum, p) => sum + stockSummary(p).empty, 0),
    low: products.reduce((sum, p) => sum + stockSummary(p).low, 0),
    categories: categories.length,
    demo: products.filter(p => p.demo).length
  };
}
export function filterProducts(products, { search = '', status = 'all', categoryId = '' } = {}) {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  return products.filter(p => terms.every(term => normalize(p.name).includes(term)) &&
    (status === 'all' || p.active === (status === 'active')) && (!categoryId || p.categoryId === categoryId));
}
export function stockRows(products, { search = '', status = 'all', includeInactive = false } = {}) {
  const term = normalize(search);
  return products.flatMap(product => product.variations
    .filter(v => (includeInactive || v.active) && (status === 'all' || stockState(v.stock).key === status) &&
      normalize(`${product.name} ${v.color} ${v.size}`).includes(term))
    .map(variation => ({ product, variation, state: stockState(variation.stock) })));
}
export function slugFromName(name) {
  return normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120).replace(/-$/g, '');
}
export function parseMoney(value) {
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw Error('Informe o preço em reais, com até duas casas decimais.');
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
// PUT substitui o produto completo. Nunca reconstruir galeria/variações ao mudar só o status.
export function productWithStatus(product, active) {
  return { ...product, active, promotionalPriceCents: product.promotionalPriceCents ?? null };
}
export function productPayload(values, variations, existing, id) {
  return {
    id: existing?.id || id,
    ...Object.fromEntries(['name', 'slug', 'shortDescription', 'description', 'categoryId', 'active', 'featured', 'isNew', 'bestSeller'].map(key => [key, values[key]])),
    priceCents: parseMoney(values.price),
    promotionalPriceCents: values.promotion.trim() ? parseMoney(values.promotion) : null,
    images: existing ? existing.images : values.image.trim()
      ? [{ type: 'image', src: values.image.trim(), alt: values.name }]
      : [{ type: 'illustration', tone: 'rose', shape: 'dress', alt: 'Ilustração provisória de roupa, sem fotografia do produto' }],
    variations
  };
}
// Não persiste rascunhos no navegador. A comparação também detecta remoção/reordenação.
export function draftChanged(baseline, entries) { return baseline !== JSON.stringify(entries); }
