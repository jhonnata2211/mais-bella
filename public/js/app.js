'use strict';

// Inicializador leve. Dados, lógica, cards e interações ficam em módulos separados.
(async () => {
  try {
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
