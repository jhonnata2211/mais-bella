// Cache da API desta visita. Não há catálogo estático nem fallback de estoque no navegador.
// As referências dos arrays permanecem estáveis para filtros, favoritos e sacola.
export const products = [];
export const categories = [];

export function replaceCatalog(nextProducts, nextCategories) {
  if (!Array.isArray(nextProducts) || !Array.isArray(nextCategories) ||
      nextProducts.some(product => !product || typeof product.id !== 'string' || typeof product.slug !== 'string' || typeof product.name !== 'string' ||
        !Number.isFinite(product.price) || product.price < 0 || product.active !== true ||
        !Array.isArray(product.images) || !Array.isArray(product.variations) || !Array.isArray(product.colors) || !Array.isArray(product.sizes)) ||
      nextCategories.some(category => !category || typeof category.id !== 'string' || typeof category.slug !== 'string' || typeof category.name !== 'string')) {
    throw new Error('Resposta de catálogo inválida');
  }
  products.splice(0, products.length, ...nextProducts);
  categories.splice(0, categories.length, ...nextCategories);
}

export async function loadCatalog(fetcher = globalThis.fetch) {
  const responses = await Promise.all(['/api/products', '/api/categories'].map(url => fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })));
  if (responses.some(response => !response.ok)) throw new Error('Catálogo indisponível');
  const [productData, categoryData] = await Promise.all(responses.map(response => response.json()));
  replaceCatalog(productData.products, categoryData.categories);
  return { products, categories };
}
