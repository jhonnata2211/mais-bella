// Lógica pura compartilhada pela Home, catálogo e testes. Não depende do DOM.
export const normalize = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export function effectivePrice(product) {
  return Number.isFinite(product.promotionalPrice) && product.promotionalPrice >= 0 && product.promotionalPrice < product.price
    ? product.promotionalPrice : product.price;
}

export function queryProducts(source, filters = {}) {
  const { category = '', size = '', color = '', minPrice, maxPrice, search = '',
    sort = 'newest', favoritesOnly = false, favorites = new Set(), newOnly = false,
    bestOnly = false, promotionsOnly = false } = filters;
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  const lower = minPrice === '' || minPrice == null ? -Infinity : Number(minPrice);
  const upper = maxPrice === '' || maxPrice == null ? Infinity : Number(maxPrice);
  const filtered = source.filter(product => {
    const text = normalize(`${product.name} ${product.category} ${product.shortDescription} ${product.description}`);
    const price = effectivePrice(product);
    const matchingVariation = !size || !color || !product.variations?.length ||
      product.variations.some(variation => variation.size === size && variation.color === color);
    return product.active &&
      (!category || product.category === category) &&
      (!size || product.sizes.includes(size)) &&
      (!color || product.colors.includes(color)) && matchingVariation &&
      price >= lower && price <= upper && terms.every(term => text.includes(term)) &&
      (!favoritesOnly || favorites.has(product.id)) &&
      (!newOnly || product.isNew) && (!bestOnly || product.bestSeller) &&
      (!promotionsOnly || effectivePrice(product) < product.price);
  });
  const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
  const comparators = {
    'price-asc': (a, b) => effectivePrice(a) - effectivePrice(b) || byName(a, b),
    'price-desc': (a, b) => effectivePrice(b) - effectivePrice(a) || byName(a, b),
    name: byName,
    newest: (a, b) => Number(b.isNew) - Number(a.isNew) ||
      String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) || byName(a, b)
  };
  return filtered.sort(comparators[sort] || comparators.newest);
}

export function catalogOptions(source) {
  const active = source.filter(product => product.active);
  const unique = values => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG'];
  return {
    categories: unique(active.map(product => product.category)),
    colors: unique(active.flatMap(product => product.colors)),
    sizes: unique(active.flatMap(product => product.sizes)).sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b))
  };
}
