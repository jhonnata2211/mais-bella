// Catálogo fictício. Preços em reais; estoques inteiros são exemplos, não disponibilidade real.
// Uma ilustração CSS pode futuramente ser substituída por { type: 'image', src, alt }.
const illustration = (name, tone, shape) => ({
  type: 'illustration', tone, shape, alt: `Ilustração demonstrativa: ${name}`
});
const variations = (colors, sizes) => colors.flatMap((color, colorIndex) =>
  sizes.map((size, sizeIndex) => ({ color, size, stock: (colorIndex + sizeIndex) % 3 === 0 ? 0 : 4 + sizeIndex }))
);

export const products = [
  {
    id: 'vestido', slug: 'vestido-midi-essencia', name: 'Vestido midi Essência',
    shortDescription: 'Silhueta fluida com delicados detalhes na cintura.',
    description: 'Modelo fictício de vestido midi com alças e caimento leve, pensado para composições elegantes. A descrição, as opções e os valores são apenas demonstrativos.',
    category: 'Vestidos', price: 229.90, promotionalPrice: 189.90,
    images: [illustration('Vestido midi Essência', 'rose', 'dress')],
    colors: ['Rosa queimado', 'Nude'], sizes: ['P', 'M', 'G'],
    variations: variations(['Rosa queimado', 'Nude'], ['P', 'M', 'G']),
    featured: true, isNew: true, bestSeller: true, active: true, createdAt: '2026-10-12'
  },
  {
    id: 'conjunto', slug: 'conjunto-linho-serena', name: 'Conjunto linho Serena',
    shortDescription: 'Duas peças de inspiração natural e corte suave.',
    description: 'Conjunto fictício de blusa e calça com textura inspirada em linho e proposta de alfaiataria leve. Não é um produto disponível para venda.',
    category: 'Conjuntos', price: 259.90,
    images: [illustration('Conjunto linho Serena', 'sand', 'set')],
    colors: ['Bege', 'Off-white'], sizes: ['P', 'M', 'G', 'GG'],
    variations: variations(['Bege', 'Off-white'], ['P', 'M', 'G', 'GG']),
    featured: true, isNew: true, bestSeller: true, active: true, createdAt: '2026-10-11'
  },
  {
    id: 'blusa', slug: 'blusa-fluida-aurora', name: 'Blusa fluida Aurora',
    shortDescription: 'Leveza e mangas suaves para o dia a dia.',
    description: 'Blusa fictícia de toque acetinado, mangas curtas e decote delicado. A proposta ilustra uma peça versátil para compor a coleção Mais Bella.',
    category: 'Blusas', price: 99.90,
    images: [illustration('Blusa fluida Aurora', 'cream', 'blouse')],
    colors: ['Nude', 'Off-white'], sizes: ['PP', 'P', 'M', 'G'],
    variations: variations(['Nude', 'Off-white'], ['PP', 'P', 'M', 'G']),
    featured: true, isNew: true, bestSeller: true, active: true, createdAt: '2026-10-10'
  },
  {
    id: 'calca', slug: 'calca-wide-leg-amelia', name: 'Calça wide leg Amélia',
    shortDescription: 'Cintura alta e linhas amplas em alfaiataria.',
    description: 'Calça fictícia de pernas amplas, pregas frontais e cintura alta. Um estudo de produto para a vitrine, sem estoque ou condições comerciais reais.',
    category: 'Calças', price: 219.90, promotionalPrice: 179.90,
    images: [illustration('Calça wide leg Amélia', 'clay', 'pants')],
    colors: ['Chumbo', 'Bege'], sizes: ['P', 'M', 'G', 'GG'],
    variations: variations(['Chumbo', 'Bege'], ['P', 'M', 'G', 'GG']),
    featured: true, isNew: true, bestSeller: true, active: true, createdAt: '2026-10-09'
  },
  {
    id: 'saia', slug: 'saia-midi-brisa', name: 'Saia midi Brisa',
    shortDescription: 'Movimento suave e comprimento midi.',
    description: 'Saia fictícia com cintura marcada e volume delicado, inspirada em momentos de leveza. Todos os atributos são exemplos para o catálogo.',
    category: 'Saias & Shorts', price: 139.90,
    images: [illustration('Saia midi Brisa', 'sand', 'skirt')],
    colors: ['Bege', 'Rosa queimado'], sizes: ['P', 'M', 'G'],
    variations: variations(['Bege', 'Rosa queimado'], ['P', 'M', 'G']),
    featured: false, isNew: true, bestSeller: false, active: true, createdAt: '2026-10-08'
  },
  {
    id: 'short', slug: 'short-alfaiataria-olivia', name: 'Short alfaiataria Olivia',
    shortDescription: 'Corte elegante para composições descontraídas.',
    description: 'Short fictício de alfaiataria com cintura alta e acabamento minimalista. Ilustra a categoria de saias e shorts; não há venda nesta etapa.',
    category: 'Saias & Shorts', price: 149.90, promotionalPrice: 119.90,
    images: [illustration('Short alfaiataria Olivia', 'rose', 'shorts')],
    colors: ['Rosa queimado', 'Chumbo'], sizes: ['PP', 'P', 'M', 'G'],
    variations: variations(['Rosa queimado', 'Chumbo'], ['PP', 'P', 'M', 'G']),
    featured: false, isNew: false, bestSeller: false, active: true, createdAt: '2026-10-07'
  },
  {
    id: 'vestido-luna', slug: 'vestido-longo-luna', name: 'Vestido longo Luna',
    shortDescription: 'Comprimento longo e uma elegância tranquila.',
    description: 'Vestido fictício de decote suave e saia longa, inspirado em encontros ao entardecer. As cores e medidas são opções demonstrativas.',
    category: 'Vestidos', price: 289.90,
    images: [illustration('Vestido longo Luna', 'cream', 'dress')],
    colors: ['Off-white', 'Nude'], sizes: ['PP', 'P', 'M'],
    variations: variations(['Off-white', 'Nude'], ['PP', 'P', 'M']),
    featured: false, isNew: false, bestSeller: false, active: true, createdAt: '2026-10-06'
  },
  {
    id: 'conjunto-clara', slug: 'conjunto-alfaiataria-clara', name: 'Conjunto alfaiataria Clara',
    shortDescription: 'Linhas limpas em um conjunto contemporâneo.',
    description: 'Conjunto fictício com blusa estruturada e calça reta para uma proposta urbana. A composição serve apenas como exemplo da coleção.',
    category: 'Conjuntos', price: 329.90, promotionalPrice: 299.90,
    images: [illustration('Conjunto alfaiataria Clara', 'clay', 'set')],
    colors: ['Chumbo', 'Bege'], sizes: ['M', 'G', 'GG'],
    variations: variations(['Chumbo', 'Bege'], ['M', 'G', 'GG']),
    featured: false, isNew: false, bestSeller: false, active: true, createdAt: '2026-10-05'
  },
  {
    id: 'blusa-cecilia', slug: 'blusa-mangas-cecilia', name: 'Blusa mangas Cecília',
    shortDescription: 'Mangas delicadas e textura de inspiração natural.',
    description: 'Blusa fictícia com mangas levemente amplas e textura inspirada em algodão. Um exemplo de peça confortável, sem disponibilidade comercial.',
    category: 'Blusas', price: 129.90,
    images: [illustration('Blusa mangas Cecília', 'rose', 'blouse')],
    colors: ['Rosa queimado', 'Off-white'], sizes: ['P', 'M', 'G', 'GG'],
    variations: variations(['Rosa queimado', 'Off-white'], ['P', 'M', 'G', 'GG']),
    featured: false, isNew: false, bestSeller: false, active: true, createdAt: '2026-10-04'
  },
  {
    id: 'calca-helena', slug: 'calca-reta-helena', name: 'Calça reta Helena',
    shortDescription: 'Um clássico de corte reto e caimento leve.',
    description: 'Calça fictícia de corte reto com cintura média e proposta minimalista. Descrições, preços e variações são dados de demonstração.',
    category: 'Calças', price: 169.90,
    images: [illustration('Calça reta Helena', 'sand', 'pants')],
    colors: ['Bege', 'Nude'], sizes: ['PP', 'P', 'M', 'G'],
    variations: variations(['Bege', 'Nude'], ['PP', 'P', 'M', 'G']),
    featured: false, isNew: false, bestSeller: false, active: true, createdAt: '2026-10-03'
  },
  {
    id: 'saia-mel', slug: 'saia-plissada-mel', name: 'Saia plissada Mel',
    shortDescription: 'Pregas leves que acompanham o movimento.',
    description: 'Saia fictícia de inspiração plissada em comprimento midi. Um estudo de silhueta para a boutique, sem vendas ou estoques reais.',
    category: 'Saias & Shorts', price: 199.90, promotionalPrice: 159.90,
    images: [illustration('Saia plissada Mel', 'rose', 'skirt')],
    colors: ['Rosa queimado', 'Nude'], sizes: ['M', 'G', 'GG'],
    variations: variations(['Rosa queimado', 'Nude'], ['M', 'G', 'GG']),
    featured: false, isNew: false, bestSeller: false, active: true, createdAt: '2026-10-02'
  },
  {
    id: 'short-livia', slug: 'short-linho-livia', name: 'Short linho Lívia',
    shortDescription: 'Textura natural e detalhes sutis na cintura.',
    description: 'Short fictício com textura inspirada em linho, bolsos laterais e caimento solto. Ilustra o modelo de dados para futuras etapas do projeto.',
    category: 'Saias & Shorts', price: 109.90,
    images: [illustration('Short linho Lívia', 'cream', 'shorts')],
    colors: ['Off-white', 'Bege'], sizes: ['PP', 'P', 'M'],
    variations: variations(['Off-white', 'Bege'], ['PP', 'P', 'M']),
    featured: false, isNew: false, bestSeller: false, active: true, createdAt: '2026-10-01'
  }
];
