// Fonte única de padrões e limites. Módulo síncrono compartilhado com Node 24+.
const freeze = value => { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); };
export const CATEGORY_SLOTS = freeze([
  { id: 'vestidos', label: 'Vestidos' }, { id: 'conjuntos', label: 'Conjuntos' },
  { id: 'blusas', label: 'Blusas' }, { id: 'calcas', label: 'Calças' }
]);
export const BUTTON_DESTINATIONS = freeze([
  { href: '#novidades', label: 'Novidades na página inicial' },
  { href: '#mais-vendidos', label: 'Mais vendidos na página inicial' },
  { href: '/catalogo.html', label: 'Catálogo completo' },
  { href: '/catalogo.html?novidades=1#catalogo', label: 'Novidades no catálogo' },
  { href: '/catalogo.html?promocoes=1#catalogo', label: 'Promoções no catálogo' },
  { href: '/sacola.html', label: 'Sacola' }
]);
export const DEFAULT_CUSTOMIZATION = freeze({
  hero: {
    collection: 'NOVA COLEÇÃO · ESSÊNCIA', title: 'Vista o que te faz\nmais Bella.',
    description: 'Leveza nos detalhes. Elegância em cada escolha.\nPeças que acompanham a sua melhor versão.',
    buttonText: 'Conhecer coleção', buttonHref: '#novidades', image: null
  },
  categories: Object.fromEntries(CATEGORY_SLOTS.map(slot => [slot.id, { label: slot.label, image: null }]))
});
export const defaultCustomization = () => JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(value, key))) throw Error('Confira os campos da personalização.');
}
function text(value, max, label, multiline = false) {
  if (typeof value !== 'string') throw Error(`Informe ${label}.`);
  const clean = value.replace(/\r\n?/g, '\n').trim();
  if (!clean || clean.length > max || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(clean) || !multiline && clean.includes('\n')) throw Error(`Use de 1 a ${max} caracteres para ${label}.`);
  return clean;
}
function image(value) {
  if (value === null) return null;
  keys(value, ['src', 'alt']);
  if (typeof value.src !== 'string' || !/^\/uploads\/products\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(value.src)) throw Error('Escolha uma imagem enviada pelo painel.');
  return { src: value.src, alt: text(value.alt, 160, 'a descrição da imagem') };
}
export function validateCustomization(value) {
  keys(value, ['hero', 'categories']);
  keys(value.hero, ['collection', 'title', 'description', 'buttonText', 'buttonHref', 'image']);
  keys(value.categories, CATEGORY_SLOTS.map(slot => slot.id));
  if (!BUTTON_DESTINATIONS.some(target => target.href === value.hero.buttonHref)) throw Error('Escolha um destino disponível para o botão.');
  const hero = {
    collection: text(value.hero.collection, 60, 'o nome da coleção'),
    title: text(value.hero.title, 120, 'o título', true),
    description: text(value.hero.description, 400, 'a descrição', true),
    buttonText: text(value.hero.buttonText, 40, 'o texto do botão'),
    buttonHref: value.hero.buttonHref, image: image(value.hero.image)
  };
  const categories = Object.fromEntries(CATEGORY_SLOTS.map(slot => {
    keys(value.categories[slot.id], ['label', 'image']);
    return [slot.id, { label: text(value.categories[slot.id].label, 40, 'o nome exibido da categoria'), image: image(value.categories[slot.id].image) }];
  }));
  return { hero, categories };
}
export function customizationImages(value) {
  return [['hero', value.hero], ...CATEGORY_SLOTS.map(slot => [slot.id, value.categories[slot.id]])]
    .filter(([, section]) => section.image).map(([slot, section]) => ({ slot, type: 'image', ...section.image }));
}
export function categoryFilterName(slot, categories) {
  return categories.find(category => category.id === slot.id)?.name || categories.find(category => category.slug === slot.id)?.name || slot.label;
}
