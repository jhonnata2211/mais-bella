import { products } from './data/products.mjs';

export function findProduct({ slug, id } = {}, source = products) {
  return source.find(product => product.active && (slug ? product.slug === slug : id && product.id === id)) || null;
}

export function getVariation(product, { color = '', size = '' } = {}) {
  if (!product?.active) return null;
  if (product.colors.length && !product.colors.includes(color)) return null;
  if (product.sizes.length && !product.sizes.includes(size)) return null;
  if (product.variations?.length) {
    return product.variations.find(variation => variation.active !== false && variation.color === color && variation.size === size) || null;
  }
  // Produtos sem opções podem futuramente usar um estoque simples; nunca inventar estoque.
  if (!product.colors.length && !product.sizes.length && !color && !size && Number.isInteger(product.stock)) {
    return { color: '', size: '', stock: product.stock };
  }
  return null;
}

export function validateSelection(product, selection = {}, quantity = 1) {
  if (!product?.active) return { ok: false, message: 'Produto não encontrado.' };
  if (product.colors.length && !selection.color) return { ok: false, message: 'Selecione uma cor.' };
  if (product.sizes.length && !selection.size) return { ok: false, message: 'Selecione um tamanho.' };
  const variation = getVariation(product, selection);
  if (!variation) return { ok: false, message: 'Esta combinação de cor e tamanho não existe.' };
  if (!Number.isInteger(variation.stock) || variation.stock <= 0) {
    return { ok: false, variation, message: 'Essa opção está esgotada.' };
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, variation, message: 'Informe uma quantidade inteira a partir de 1.' };
  if (quantity > variation.stock) return { ok: false, variation, message: `Limite de ${variation.stock} unidade(s) disponíveis para esta opção.` };
  return { ok: true, variation, stock: variation.stock };
}

// Seleciona automaticamente apenas características com uma única opção em estoque.
export function simplifySelection(product, previous = {}) {
  const available = (product.variations || []).filter(v => v.active !== false && v.stock > 0);
  const colors = product.colors.filter(color => available.some(v => v.color === color));
  const color = colors.includes(previous.color) ? previous.color : colors.length === 1 ? colors[0] : '';
  const sizes = product.sizes.filter(size => available.some(v => v.size === size && (!product.colors.length || v.color === color)));
  const size = sizes.includes(previous.size) ? previous.size : sizes.length === 1 ? sizes[0] : '';
  return { color, size };
}
