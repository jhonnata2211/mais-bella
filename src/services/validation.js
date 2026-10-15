class ValidationError extends Error {
  constructor(message = 'Dados inválidos') { super(message); this.status = 400; }
}
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function text(value, field, max = 120, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new ValidationError(`Campo inválido: ${field}`);
  return value.trim();
}
function slug(value) {
  text(value, 'slug', 120);
  if (!slugPattern.test(value)) throw new ValidationError('Slug inválido');
  return value;
}
function integer(value, field, max = 2147483647) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new ValidationError(`Campo inválido: ${field}`);
  return value;
}
function boolean(value, field) {
  if (typeof value !== 'boolean') throw new ValidationError(`Campo inválido: ${field}`);
  return value;
}
function toCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new ValidationError('Preço deve ter no máximo duas casas decimais');
  return integer(Math.round(value * 100), 'preço');
}
function validateCategory(input) {
  if (!input || typeof input !== 'object') throw new ValidationError();
  return {
    id: text(input.id, 'id'), slug: slug(input.slug), name: text(input.name, 'nome'),
    sortOrder: integer(input.sortOrder ?? 0, 'ordem'), active: boolean(input.active ?? true, 'ativo')
  };
}
function validateProduct(input) {
  if (!input || typeof input !== 'object') throw new ValidationError();
  const result = {
    id: text(input.id, 'id'), slug: slug(input.slug), name: text(input.name, 'nome', 160),
    shortDescription: text(input.shortDescription, 'descrição curta', 500), description: text(input.description, 'descrição', 10000),
    categoryId: text(input.categoryId, 'categoria'), priceCents: integer(input.priceCents, 'preço'),
    promotionalPriceCents: input.promotionalPriceCents == null ? null : integer(input.promotionalPriceCents, 'preço promocional'),
    active: boolean(input.active, 'ativo'), featured: boolean(input.featured, 'destaque'),
    isNew: boolean(input.isNew, 'novidade'), bestSeller: boolean(input.bestSeller, 'mais vendido'), demo: boolean(input.demo ?? false, 'demonstração'),
    createdAt: input.createdAt || new Date().toISOString()
  };
  if (result.promotionalPriceCents !== null && result.promotionalPriceCents >= result.priceCents) throw new ValidationError('Preço promocional deve ser inferior ao preço base');
  if (typeof result.createdAt !== 'string' || result.createdAt.length > 40 || !Number.isFinite(Date.parse(result.createdAt))) throw new ValidationError('Data inválida');
  if (!Array.isArray(input.images) || input.images.length < 1 || input.images.length > 20) throw new ValidationError('Use de 1 a 20 imagens por produto.');
  const tones = ['rose', 'sand', 'cream', 'clay'];
  const shapes = ['dress', 'set', 'blouse', 'pants', 'skirt', 'shorts'];
  result.images = input.images.map((image, index) => {
    if (!image || !['illustration', 'image'].includes(image.type)) throw new ValidationError('Tipo de imagem inválido');
    if (image.type === 'illustration' && (!tones.includes(image.tone) || !shapes.includes(image.shape))) throw new ValidationError('Ilustração inválida');
    const localImage = typeof image.src === 'string' && /^\/assets\/[a-zA-Z0-9_/-]+\.(?:png|jpg|jpeg|webp|avif|svg)$/.test(image.src) && !image.src.includes('..');
    const uploadedImage = typeof image.src === 'string' && /^\/uploads\/products\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(image.src);
    if (image.type === 'image' && !localImage && !uploadedImage) throw new ValidationError('Caminho de imagem inválido');
    return { ...image, id: text(image.id || `${result.id}-image-${index + 1}`, 'id da imagem'), alt: text(image.alt, 'alt', 500), order: integer(image.order ?? index, 'ordem'), primary: boolean(image.primary ?? index === 0, 'principal') };
  });
  if (new Set(result.images.map(image => image.id)).size !== result.images.length || result.images.filter(image => image.primary).length !== 1) throw new ValidationError('Defina uma imagem principal e IDs únicos');
  if (!Array.isArray(input.variations) || !input.variations.length || input.variations.length > 500) throw new ValidationError('Variações inválidas');
  result.variations = input.variations.map((variation, index) => {
    if (!variation || typeof variation !== 'object') throw new ValidationError('Variação inválida');
    return {
    id: text(variation.id || `${result.id}-variation-${index + 1}`, 'id da variação'),
    color: text(variation.color, 'cor', 80), size: text(variation.size, 'tamanho', 30),
    stock: integer(variation.stock, 'estoque', 1000000), active: boolean(variation.active ?? true, 'variação ativa'), order: integer(variation.order ?? index, 'ordem')
    };
  });
  if (new Set(result.variations.map(item => JSON.stringify([item.color, item.size]))).size !== result.variations.length || new Set(result.variations.map(item => item.id)).size !== result.variations.length) throw new ValidationError('Variação duplicada');
  return result;
}
function parseFilters(query) {
  const allowed = ['category', 'search', 'featured', 'new', 'bestSeller', 'categoria', 'busca', 'destaque', 'novidade', 'maisVendidos'];
  for (const [key, value] of Object.entries(query)) if (!allowed.includes(key) || typeof value !== 'string') throw new ValidationError('Parâmetro inválido');
  const result = {};
  for (const [name, alias] of [['category', 'categoria'], ['search', 'busca'], ['featured', 'destaque'], ['new', 'novidade'], ['bestSeller', 'maisVendidos']]) {
    if (query[name] !== undefined && query[alias] !== undefined) throw new ValidationError('Parâmetro duplicado');
    const value = query[name] ?? query[alias];
    if (value === undefined) continue;
    if (name === 'category') result.category = slug(value);
    else if (name === 'search') result.search = text(value, 'busca', 120, true);
    else { if (!['true', 'false', '1', '0'].includes(value)) throw new ValidationError('Filtro booleano inválido'); result[name] = ['true', '1'].includes(value); }
  }
  return result;
}
module.exports = { ValidationError, slug, toCents, validateProduct, validateCategory, parseFilters };
