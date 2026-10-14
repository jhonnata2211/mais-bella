'use strict';

// Conteúdo fictício para validar a vitrine. Não há compra ou persistência de dados.
const products = [
  { id: 'vestido', name: 'Vestido midi Essência', category: 'Vestidos', price: 189.90, oldPrice: 229.90, tone: 'rose', shape: 'dress', label: 'Novo', best: true },
  { id: 'conjunto', name: 'Conjunto linho Serena', category: 'Conjuntos', price: 259.90, tone: 'sand', shape: 'set', label: 'Novo', best: true },
  { id: 'blusa', name: 'Blusa fluida Aurora', category: 'Blusas', price: 99.90, tone: 'cream', shape: 'blouse', label: 'Novo', best: true },
  { id: 'calca', name: 'Calça wide leg Amélia', category: 'Calças', price: 179.90, oldPrice: 219.90, tone: 'clay', shape: 'pants', label: 'Especial', best: true },
  { id: 'saia', name: 'Saia midi Brisa', category: 'Saias & Shorts', price: 139.90, tone: 'sand', shape: 'skirt', label: 'Novo' },
  { id: 'short', name: 'Short alfaiataria Olivia', category: 'Saias & Shorts', price: 119.90, oldPrice: 149.90, tone: 'rose', shape: 'shorts', label: 'Especial' }
];
const favorites = new Set();
let bagCount = 0;
let activeCategory = '';
let searchTerm = '';
let favoritesOnly = false;
let showEverything = false;
let toastTimer;
const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3 12C-3 5 7-1 12 6c5-7 15-1 9 6Z"/></svg>';

function notify(message) {
  const toast = document.querySelector('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 5500);
}

function productCard(product) {
  const selected = favorites.has(product.id);
  return `<article class="product-card">
    <div class="product-art tone-${product.tone}">
      <div class="garment garment-${product.shape}" role="img" aria-label="Ilustração demonstrativa: ${product.name}"></div>
      <span class="product-label">${product.label}</span>
      <button type="button" class="product-favorite" data-favorite="${product.id}" aria-pressed="${selected}" aria-label="${selected ? 'Remover dos' : 'Adicionar aos'} favoritos: ${product.name}">${heart}</button>
      <span class="placeholder-label">ILUSTRAÇÃO · MAIS BELLA</span>
    </div>
    <div class="product-info"><h3>${product.name}</h3><div class="price-row">${product.oldPrice ? `<s><span class="sr-price">De </span>${money(product.oldPrice)}</s>` : ''}<strong>${money(product.price)}</strong></div><p class="installment">3x de ${money(product.price / 3)} sem juros</p><button type="button" class="add-button" data-add="${product.id}">Adicionar à sacola <span aria-hidden="true">+</span></button></div>
  </article>`;
}

function renderProducts() {
  const filtered = products.filter(product =>
    (!activeCategory || (activeCategory === 'Promoções' ? product.oldPrice : product.category === activeCategory)) &&
    (!searchTerm || normalize(`${product.name} ${product.category}`).includes(normalize(searchTerm))) &&
    (!favoritesOnly || favorites.has(product.id))
  );
  const visible = showEverything || activeCategory || searchTerm || favoritesOnly ? filtered : filtered.slice(0, 4);
  document.querySelector('#new-products').innerHTML = visible.map(productCard).join('');
  document.querySelector('#best-products').innerHTML = products.filter(product => product.best).map(productCard).join('');
  document.querySelector('#empty-state').hidden = visible.length > 0;
  const status = document.querySelector('#filter-status');
  const filters = [activeCategory, searchTerm && `Busca: “${searchTerm}”`, favoritesOnly && 'Seus favoritos'].filter(Boolean);
  status.hidden = !filters.length;
  status.textContent = `${filters.join(' · ')} — ${visible.length} peça(s) demonstrativa(s)`;
}

function setMenu(open) {
  document.querySelector('#menu-principal').classList.toggle('is-open', open);
  const toggle = document.querySelector('.menu-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
}

function resetFilters() {
  activeCategory = '';
  searchTerm = '';
  favoritesOnly = false;
  document.querySelector('#search').value = '';
  document.querySelector('#favorites-toggle').setAttribute('aria-pressed', 'false');
}

function scrollToProducts() {
  document.querySelector('#novidades').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

document.querySelector('.menu-toggle').addEventListener('click', () => setMenu(document.querySelector('.menu-toggle').getAttribute('aria-expanded') !== 'true'));
document.addEventListener('click', event => {
  const category = event.target.closest('[data-category]');
  if (category) {
    resetFilters();
    activeCategory = category.dataset.category;
    renderProducts();
  } else if (event.target.closest('a[href="#novidades"]')) {
    resetFilters();
    renderProducts();
  }
  if (event.target.closest('.nav-links a')) setMenu(false);
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    const id = favorite.dataset.favorite;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    // Atualiza todas as cópias sem substituir o botão que tem foco.
    document.querySelectorAll('[data-favorite]').forEach(button => {
      const selected = favorites.has(button.dataset.favorite);
      const product = products.find(item => item.id === button.dataset.favorite);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? 'Remover dos' : 'Adicionar aos'} favoritos: ${product.name}`);
    });
    const count = document.querySelector('#favorite-count');
    count.textContent = favorites.size;
    count.hidden = favorites.size === 0;
    document.querySelector('#favorites-toggle').setAttribute('aria-label', `Mostrar favoritos, ${favorites.size} itens`);
    if (favoritesOnly) {
      renderProducts();
      const next = document.querySelector('#new-products [data-favorite]') || document.querySelector('#show-all');
      next.focus({ preventScroll: true });
    }
    notify(favorites.has(id) ? 'Peça adicionada aos favoritos ♡' : 'Peça removida dos favoritos.');
  }
  if (event.target.closest('[data-add]')) {
    bagCount += 1;
    document.querySelector('#bag-count').textContent = bagCount;
    document.querySelector('#bag-button').setAttribute('aria-label', `Sacola demonstrativa, ${bagCount} itens`);
    notify('Peça adicionada à sacola demonstrativa. Nenhuma compra foi realizada.');
  }
  const info = event.target.closest('[data-info]');
  if (info) notify(info.dataset.info);
});
document.querySelector('#show-all').addEventListener('click', () => { resetFilters(); showEverything = true; renderProducts(); });
document.querySelector('#favorites-toggle').addEventListener('click', () => {
  const enabled = !favoritesOnly;
  resetFilters();
  favoritesOnly = enabled;
  document.querySelector('#favorites-toggle').setAttribute('aria-pressed', String(enabled));
  renderProducts();
  scrollToProducts();
});
document.querySelector('#search-toggle').addEventListener('click', () => {
  const panel = document.querySelector('#search-panel');
  panel.hidden = !panel.hidden;
  document.querySelector('#search-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) document.querySelector('#search').focus();
});
document.querySelector('#search-panel').addEventListener('submit', event => {
  event.preventDefault();
  const query = document.querySelector('#search').value.trim();
  resetFilters();
  searchTerm = query;
  document.querySelector('#search').value = query;
  showEverything = true;
  renderProducts();
  scrollToProducts();
});
document.querySelector('#account-button').addEventListener('click', () => notify('A área de conta estará disponível em uma próxima etapa.'));
document.querySelector('#bag-button').addEventListener('click', () => notify(`Sua sacola demonstrativa tem ${bagCount} ${bagCount === 1 ? 'peça' : 'peças'}. Checkout indisponível nesta etapa.`));
document.querySelector('#newsletter-form').addEventListener('submit', event => {
  event.preventDefault();
  document.querySelector('#newsletter-status').textContent = 'Obrigada pelo interesse ♡ Esta é uma demonstração; seu e-mail não foi armazenado.';
  event.target.reset();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const menuOpen = document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'true';
    const searchOpen = !document.querySelector('#search-panel').hidden;
    setMenu(false);
    document.querySelector('#search-panel').hidden = true;
    document.querySelector('#search-toggle').setAttribute('aria-expanded', 'false');
    if (searchOpen) document.querySelector('#search-toggle').focus();
    else if (menuOpen) document.querySelector('.menu-toggle').focus();
  }
});
matchMedia('(min-width: 761px)').addEventListener('change', () => setMenu(false));
document.querySelector('#year').textContent = new Date().getFullYear();
renderProducts();
