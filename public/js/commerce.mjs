// Identificação vem do SQLite/API; nunca inferir por nome, imagem ou dados da sacola.
export const isDemoProduct = product => product?.demo === true;
export const hasDemoItems = (items, source) => items.some(item => isDemoProduct(source.find(product => product.id === item.productId)));
export const hasDemoProducts = source => source.some(product => product.active && isDemoProduct(product));
export function applyDemoNotices(source, root = document) {
  root.querySelectorAll('[data-demo-catalog]').forEach(node => { node.hidden = !hasDemoProducts(source); });
}

export function emptyCollectionMessage(source, filteredMessage) {
  return source.some(product => product.active) ? filteredMessage : 'Novidades chegando em breve ♡';
}
