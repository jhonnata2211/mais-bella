import { products } from './data/products.mjs';
import { catalogOptions, queryProducts } from './catalog.mjs';
import { escapeHTML, renderProductGrid } from './products.mjs';
import { initStorefront } from './storefront.mjs';

export function initCatalog() {
  const form = document.querySelector('#catalog-filters');
  const params = new URLSearchParams(window.location.search);
  let favoritesOnly = params.get('favoritos') === '1';
  let promotionsOnly = params.get('promocoes') === '1';
  let newOnly = params.get('novidades') === '1';
  const store = initStorefront({
    onSearch(search) { document.querySelector('#catalog-search').value = search; render(); },
    onCategory(category) {
      form.reset();
      favoritesOnly = false; newOnly = false;
      store.setFavoritesMode(false);
      promotionsOnly = category === 'Promoções';
      document.querySelector('#filter-category').value = promotionsOnly ? '' : category;
      render();
    },
    onFavorites({ enabled }) {
      if (enabled !== undefined) favoritesOnly = enabled;
      if (enabled !== undefined || favoritesOnly) render();
    }
  });
  const options = catalogOptions(products);
  for (const [field, values] of [['category', options.categories], ['size', options.sizes], ['color', options.colors]]) {
    const select = document.querySelector(`#filter-${field}`);
    select.insertAdjacentHTML('beforeend', values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join(''));
  }
  for (const [name, key] of [['category', 'categoria'], ['size', 'tamanho'], ['color', 'cor'], ['minPrice', 'min'], ['maxPrice', 'max'], ['sort', 'ordem'], ['search', 'busca']]) {
    const input = form.elements.namedItem(name);
    if (params.has(key)) input.value = params.get(key);
  }
  if (!document.querySelector('#catalog-sort').value) document.querySelector('#catalog-sort').value = 'newest';
  store.setFavoritesMode(favoritesOnly);

  function render() {
    const values = Object.fromEntries(new FormData(form));
    const min = values.minPrice === '' ? 0 : Number(values.minPrice);
    const max = values.maxPrice === '' ? Infinity : Number(values.maxPrice);
    const validRange = min <= max;
    document.querySelector('#price-error').hidden = validRange;
    document.querySelector('#filter-max').setAttribute('aria-invalid', String(!validRange));
    document.querySelector('#search').value = values.search;
    const result = validRange ? queryProducts(products, { ...values, favoritesOnly, promotionsOnly, newOnly, favorites: store.favorites }) : [];
    renderProductGrid(document.querySelector('#catalog-products'), result, store.favorites);
    const total = products.filter(product => product.active).length;
    document.querySelector('#product-count').textContent = `${result.length} de ${total} produtos demonstrativos`;
    document.querySelector('#catalog-empty').hidden = result.length > 0 || !validRange;
    const active = [favoritesOnly && 'Seus favoritos', promotionsOnly && 'Promoções demonstrativas', newOnly && 'Novidades'].filter(Boolean);
    document.querySelector('#catalog-mode').textContent = active.join(' · ');
    document.querySelector('#catalog-mode').hidden = !active.length;
    const url = new URL(window.location.href);
    url.search = '';
    for (const [name, key] of [['category', 'categoria'], ['size', 'tamanho'], ['color', 'cor'], ['minPrice', 'min'], ['maxPrice', 'max'], ['sort', 'ordem'], ['search', 'busca']]) {
      if (values[name] && !(name === 'sort' && values[name] === 'newest')) url.searchParams.set(key, values[name]);
    }
    if (favoritesOnly) url.searchParams.set('favoritos', '1');
    if (promotionsOnly) url.searchParams.set('promocoes', '1');
    if (newOnly) url.searchParams.set('novidades', '1');
    if (params.has('produto')) url.searchParams.set('produto', params.get('produto'));
    window.history.replaceState(null, '', url);
  }
  form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) render(); });
  form.addEventListener('change', () => { if (form.reportValidity()) render(); });
  document.querySelector('#clear-filters').addEventListener('click', () => {
    form.reset(); favoritesOnly = false; promotionsOnly = false; newOnly = false;
    params.delete('produto');
    document.querySelector('#selected-product').hidden = true;
    store.setFavoritesMode(false);
    render();
  });
  const selected = products.find(product => product.active && product.slug === params.get('produto'));
  if (selected) {
    const notice = document.querySelector('#selected-product');
    notice.hidden = false;
    notice.textContent = `Você selecionou ${selected.name}. A página individual será disponibilizada em uma próxima etapa. Continue explorando o catálogo demonstrativo.`;
  }
  render();
}
