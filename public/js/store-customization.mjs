import { DEFAULT_CUSTOMIZATION, CATEGORY_SLOTS, categoryFilterName, validateCustomization } from './customization-model.mjs';

export function createCustomizationRenderer(root, categories = []) {
  const document = root.ownerDocument || root;
  const title = root.querySelector('#hero-title');
  const description = root.querySelector('[data-hero-description]');
  const art = root.querySelector('[data-hero-image]');
  const originals = new Map([title, description, art].map(node => [node, node.cloneNode(true)]));
  const originalCategoryArt = new Map(CATEGORY_SLOTS.map(slot => {
    const node = root.querySelector(`[data-store-category="${slot.id}"] .category-art`); return [node, node.cloneNode(true)];
  }));
  const restore = (node, original) => node.replaceChildren(...[...original.childNodes].map(child => child.cloneNode(true)));
  function image(node, value, original, hero = false) {
    restore(node, original); node.classList.toggle('has-store-image', Boolean(value));
    if (hero) node.setAttribute('aria-label', value ? value.alt : original.getAttribute('aria-label'));
    if (!value) return;
    const img = document.createElement('img'); img.src = value.src; img.alt = hero ? '' : value.alt;
    img.loading = hero ? 'eager' : 'lazy'; img.decoding = 'async';
    img.addEventListener('error', () => {
      if (node.firstChild !== img) return;
      restore(node, original); node.classList.remove('has-store-image');
      if (hero) node.setAttribute('aria-label', original.getAttribute('aria-label'));
    }, { once: true });
    node.replaceChildren(img);
  }
  return input => {
    const value = validateCustomization(input); // rejeita URLs inesperadas antes de alterar o DOM
    root.querySelector('[data-hero-collection]').textContent = value.hero.collection;
    for (const [node, text, standard] of [[title, value.hero.title, DEFAULT_CUSTOMIZATION.hero.title], [description, value.hero.description, DEFAULT_CUSTOMIZATION.hero.description]]) {
      if (text === standard) restore(node, originals.get(node)); else node.textContent = text;
      node.classList.toggle('custom-store-copy', text !== standard);
    }
    const button = root.querySelector('[data-hero-button]');
    button.setAttribute('href', value.hero.buttonHref);
    button.firstChild.nodeValue = value.hero.buttonText + ' ';
    image(art, value.hero.image, originals.get(art), true);
    for (const slot of CATEGORY_SLOTS) {
      const card = root.querySelector(`[data-store-category="${slot.id}"]`);
      const caption = card.querySelector('[data-category-caption]');
      caption.firstChild.nodeValue = value.categories[slot.id].label + ' ';
      card.dataset.category = categoryFilterName(slot, categories); // independente do rótulo personalizado
      const node = card.querySelector('.category-art'); image(node, value.categories[slot.id].image, originalCategoryArt.get(node));
    }
  };
}
export async function loadCustomization({ root = document, categories = [], fetcher = globalThis.fetch } = {}) {
  const response = await fetcher('/api/store-customization', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error('Personalização indisponível');
  const data = await response.json(); createCustomizationRenderer(root, categories)(data.customization);
}
