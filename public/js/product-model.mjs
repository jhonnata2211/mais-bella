import { products } from './data/products.mjs';

export function findProduct({ slug, id } = {}, source = products) {
  return source.find(product => product.active && (slug ? product.slug === slug : id && product.id === id)) || null;
}

export function getVariation(product, { color = '', size = '' } = {}) {
  if (!product?.active) return null;
  if (product.colors.length && !product.colors.includes(color)) return null;
  if (product.sizes.length && !product.sizes.includes(size)) return null;
  if (product.variations?.length) {
    return product.variations.find(variation => variation.color === color && variation.size === size) || null;
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
    return { ok: false, variation, message: 'Variação esgotada no estoque demonstrativo.' };
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, variation, message: 'Informe uma quantidade inteira a partir de 1.' };
  if (quantity > variation.stock) return { ok: false, variation, message: `Limite de ${variation.stock} unidade(s) no estoque demonstrativo.` };
  return { ok: true, variation, stock: variation.stock };
}
