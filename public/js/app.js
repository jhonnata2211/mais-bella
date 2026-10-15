'use strict';

// Inicializador leve. Dados, lógica, cards e interações ficam em módulos separados.
(async () => {
  try {
    const { loadCatalog } = await import('./data/products.mjs');
    const { categories } = await loadCatalog();
    // Categorias futuras vêm do banco; os cards editoriais da Home seguem preservados.
    const nav = document.querySelector('.nav-links');
    const promotion = nav.querySelector('[data-category="Promoções"]');
    nav.querySelectorAll('[data-category]').forEach(link => { if (link !== promotion) link.remove(); });
    for (const category of categories) {
      const link = document.createElement('a');
      link.textContent = category.name;
      link.dataset.category = category.name;
      link.href = document.body.dataset.page === 'home' ? '#novidades' : '/catalogo.html?categoria=' + encodeURIComponent(category.name) + '#catalogo';
      nav.insertBefore(link, promotion);
    }
    if (document.body.dataset.page === 'product') {
      const { initProductPage } = await import('./product-page.mjs');
      initProductPage();
    } else if (document.body.dataset.page === 'cart') {
      const { initCartPage } = await import('./cart-page.mjs');
      initCartPage();
    } else if (document.body.dataset.page === 'catalog') {
      const { initCatalog } = await import('./catalog-page.mjs');
      initCatalog();
    } else {
      const { initHome } = await import('./home.mjs');
      initHome();
    }
  } catch (error) {
    console.error('Não foi possível carregar o catálogo demonstrativo.', error);
    const toast = document.querySelector('#toast');
    toast.textContent = 'Não foi possível carregar as peças. Recarregue a página para tentar novamente.';
    toast.classList.add('visible');
  }
})();
