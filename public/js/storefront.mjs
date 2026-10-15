import { products } from './data/products.mjs';
import { CART_KEY, createCartStore } from './cart.mjs';
import { initCartPanel } from './cart-panel.mjs';
import { initFloatingWhatsApp } from './whatsapp-ui.mjs';

export const FAVORITES_KEY = 'maisbella:favorites:v1';
export function readFavorites(storage, source = products) {
  try {
    const saved = JSON.parse(storage?.getItem(FAVORITES_KEY) || '[]');
    const validIds = new Set(source.filter(product => product.active).map(product => product.id));
    return new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string' && validIds.has(id)) : []);
  } catch {
    return new Set();
  }
}

export function writeFavorites(storage, favorites) {
  try {
    storage?.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function initStorefront({ onSearch, onCategory, onFavorites, onCartChange } = {}) {
  let storage;
  try { storage = window.localStorage; } catch { /* Modo privado: favoritos em memória. */ }
  const favorites = readFavorites(storage);
  const cart = createCartStore(storage);
  let toastTimer;
  const favoritesToggle = document.querySelector('#favorites-toggle');
  const menuToggle = document.querySelector('.menu-toggle');
  const searchToggle = document.querySelector('#search-toggle');
  const searchPanel = document.querySelector('#search-panel');

  function notify(message) {
    const toast = document.querySelector('#toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 5500);
  }
  function setMenu(open) {
    document.querySelector('#menu-principal').classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }
  function syncFavorites() {
    document.querySelectorAll('[data-favorite]').forEach(button => {
      const product = products.find(item => item.id === button.dataset.favorite);
      if (!product) return;
      const selected = favorites.has(product.id);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? 'Remover dos' : 'Adicionar aos'} favoritos: ${product.name}`);
    });
    const count = document.querySelector('#favorite-count');
    count.textContent = favorites.size;
    count.hidden = favorites.size === 0;
    favoritesToggle.setAttribute('aria-label', `Mostrar favoritos, ${favorites.size} itens`);
  }
  function setFavoritesMode(enabled) {
    favoritesToggle.setAttribute('aria-pressed', String(enabled));
  }
  function scrollToProducts() {
    (document.querySelector('#catalogo') || document.querySelector('#novidades'))?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  }

  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', event => {
    const category = event.target.closest('[data-category]');
    if (category && onCategory) {
      event.preventDefault();
      onCategory(category.dataset.category);
      scrollToProducts();
    }
    if (event.target.closest('.nav-links a')) setMenu(false);
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) {
      const id = favorite.dataset.favorite;
      if (!products.some(product => product.active && product.id === id)) return;
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      const saved = writeFavorites(storage, favorites);
      syncFavorites();
      const focused = document.activeElement === favorite;
      onFavorites?.({ changed: true });
      if (focused && !favorite.isConnected) {
        const next = [...document.querySelectorAll('[data-favorite]')].find(button => button.dataset.favorite === id) ||
          document.querySelector('[data-favorite]') || document.querySelector('#clear-filters') || document.querySelector('#show-all');
        next?.focus({ preventScroll: true });
      }
      notify(`${favorites.has(id) ? 'Peça adicionada aos favoritos ♡' : 'Peça removida dos favoritos.'}${saved ? '' : ' Favoritos mantidos apenas nesta página.'}`);
    }
    const info = event.target.closest('[data-info]');
    if (info) notify(info.dataset.info);
  });
  favoritesToggle.addEventListener('click', () => {
    const enabled = favoritesToggle.getAttribute('aria-pressed') !== 'true';
    setFavoritesMode(enabled);
    if (onFavorites) onFavorites({ enabled });
    else window.location.href = '/catalogo.html?favoritos=1#catalogo';
    scrollToProducts();
  });
  searchToggle.addEventListener('click', () => {
    searchPanel.hidden = !searchPanel.hidden;
    searchToggle.setAttribute('aria-expanded', String(!searchPanel.hidden));
    if (!searchPanel.hidden) document.querySelector('#search').focus();
  });
  searchPanel.addEventListener('submit', event => {
    event.preventDefault();
    const query = document.querySelector('#search').value.trim();
    if (onSearch) onSearch(query);
    else window.location.href = `/catalogo.html?busca=${encodeURIComponent(query)}#catalogo`;
    scrollToProducts();
  });
  document.querySelector('#account-button').addEventListener('click', () => notify('Não é necessário criar conta. Escolha suas peças, revise a sacola e combine a compra pelo WhatsApp.'));
  document.querySelector('#newsletter-form')?.addEventListener('submit', event => {
    event.preventDefault();
    document.querySelector('#newsletter-status').textContent = 'Obrigada pelo interesse ♡ Este formulário não envia nem armazena e-mails.';
    event.target.reset();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    const menuOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    const searchOpen = !searchPanel.hidden;
    setMenu(false);
    searchPanel.hidden = true;
    searchToggle.setAttribute('aria-expanded', 'false');
    if (searchOpen) searchToggle.focus();
    else if (menuOpen) menuToggle.focus();
  });
  matchMedia('(min-width: 761px)').addEventListener('change', () => setMenu(false));
  window.addEventListener('storage', event => {
    if (event.key === CART_KEY || event.key === null) cart.refresh();
    if (event.key !== FAVORITES_KEY && event.key !== null) return;
    favorites.clear();
    readFavorites(storage).forEach(id => favorites.add(id));
    syncFavorites();
    onFavorites?.({ changed: true });
  });
  document.querySelector('#year').textContent = new Date().getFullYear();
  syncFavorites();
  const cartPanel = initCartPanel(cart, notify);
  cart.subscribe(() => onCartChange?.());
  initFloatingWhatsApp(notify);
  return { favorites, notify, syncFavorites, setFavoritesMode, cart, cartPanel };
}
