import { products } from './data/products.mjs';
import { queryProducts } from './catalog.mjs';
import { renderProductGrid } from './products.mjs';
import { initStorefront } from './storefront.mjs';

export function initHome() {
  let filters = {};
  let showEverything = false;
  const store = initStorefront({
    onSearch(search) { resetFilters(); filters.search = search; document.querySelector("#search").value = search; showEverything = true; render(); },
    onCategory(category) {
      resetFilters();
      if (category === 'Promoções') filters.promotionsOnly = true;
      else filters.category = category;
      showEverything = true;
      render();
    },
    onFavorites({ enabled }) {
      if (enabled !== undefined) { resetFilters(); filters.favoritesOnly = enabled; store.setFavoritesMode(enabled); showEverything = true; }
      if (enabled !== undefined || filters.favoritesOnly) render();
    }
  });
  function resetFilters() {
    filters = {};
    document.querySelector('#search').value = '';
    store.setFavoritesMode(false);
  }
  function render() {
    const visible = queryProducts(products, { ...filters, favorites: store.favorites, newOnly: !showEverything });
    renderProductGrid(document.querySelector('#new-products'), showEverything ? visible : visible.slice(0, 4), store.favorites);
    renderProductGrid(document.querySelector('#best-products'), queryProducts(products, { bestOnly: true }).slice(0, 4), store.favorites);
    document.querySelector('#empty-state').hidden = visible.length > 0;
    const status = document.querySelector('#filter-status');
    const labels = [filters.category, filters.promotionsOnly && 'Promoções', filters.search && `Busca: “${filters.search}”`, filters.favoritesOnly && 'Seus favoritos'].filter(Boolean);
    status.hidden = !labels.length;
    status.textContent = `${labels.join(' · ')} — ${visible.length} peça(s) demonstrativa(s)`;
  }
  document.querySelector('#show-all').addEventListener('click', () => { resetFilters(); showEverything = true; render(); });
  document.addEventListener('click', event => {
    if (event.target.closest('a[href="#novidades"]') && !event.target.closest('[data-category]')) {
      resetFilters(); showEverything = false; render();
    }
  });
  render();
}
