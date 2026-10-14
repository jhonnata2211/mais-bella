# Mais Bella

Loja de moda feminina com identidade de boutique: blush, rosa queimado, nude e off-white, títulos serifados e textos modernos.

**MAISBELLA-001 — concluído:** primeira versão visual responsiva da Home, com navegação, hero ilustrado, categorias, novidades, banner da marca, mais vendidos, benefícios, newsletter e rodapé.

**MAISBELLA-002 — catálogo estruturado:** fonte local com 12 produtos fictícios, cards reutilizáveis, catálogo com filtros combináveis e ordenação, busca em nome/categoria/descrições e favoritos por ID persistidos no navegador. A identidade e as seções da Home foram preservadas. Nenhum banco de dados ou framework frontend foi adicionado.

## Instalar e executar

Pré-requisito: Node.js 20 ou superior e npm. Use um navegador moderno com suporte a módulos JavaScript.

```sh
npm install
npm start
```

- Home: **http://localhost:3000/**
- Catálogo: **http://localhost:3000/catalogo.html**

Para outra porta:

```sh
PORT=4000 npm start
```

O servidor Express serve apenas `public` e usa `process.env.PORT || 3000`. Abra as páginas pelo servidor, evitando `file://`, pois elas carregam módulos JavaScript.

## Arquivos principais

```text
public/
  index.html               # Home original consumindo o catálogo compartilhado
  catalogo.html            # Coleção, filtros e resultados acessíveis
  css/style.css            # Identidade original e estilos adicionais do catálogo
  js/
    app.js                 # Inicializador da página
    data/products.mjs      # Fonte única dos 12 produtos fictícios
    catalog.mjs            # Busca, filtros, ordenação e opções (lógica pura)
    products.mjs           # Card reutilizável e destino de seleção por slug
    storefront.mjs         # Menu, pesquisa, favoritos, sacola e newsletter
    home.mjs               # Vitrines de novidades e mais vendidos
    catalog-page.mjs       # Interface e estado dos filtros do catálogo
  assets/                  # Reservado para futuras imagens locais
src/
  routes/                  # Reservado para etapas futuras
  controllers/
  services/
data/
tests/
  catalog.test.mjs          # Testes com node:test e assert, sem dependências extras
server.js
package.json
```

## Modelo de produto

Os nomes dos campos usam inglês no código, com conteúdo em português:

| Campo | Finalidade |
| --- | --- |
| `id`, `slug` | Identificador estável e referência para futura página individual |
| `name` | Nome |
| `shortDescription`, `description` | Descrição curta e completa |
| `category` | Categoria |
| `price` | Preço base numérico em reais |
| `promotionalPrice` | Preço promocional opcional, numérico e inferior ao base |
| `images` | Lista com descrição alternativa; ilustração CSS local ou futura imagem em `/assets/` |
| `colors`, `sizes` | Opções de cor e tamanho |
| `variations` | Combinações de `color`, `size`, `stock` (estoque inteiro não negativo) |
| `featured`, `isNew`, `bestSeller`, `active` | Destaque, novidade, mais vendido e ativo |
| `createdAt` | Data fictícia de inclusão para ordenação por novidades |

A fonte é `public/js/data/products.mjs`, compartilhada pela Home e catálogo. Atualize esse arquivo para editar os dados demonstrativos. IDs antigos foram preservados. As ilustrações usam as formas CSS existentes; o card também suporta uma imagem local com `{ type: 'image', src: '/assets/arquivo.webp', alt: 'Descrição' }`.

Filtros combinam categoria, tamanho, cor, faixa de preço e busca. Quando tamanho e cor são selecionados, a combinação deve existir nas variações. O estoque não determina disponibilidade comercial nesta demonstração. Produtos inativos são excluídos das vitrines e das opções de filtros.

A busca ignora caixa e acentos e pesquisa nome, categoria e ambas as descrições. Cada palavra digitada deve aparecer no conteúdo do produto. Preços e parcelamento consideram a promoção válida, quando presente. A ordem “Novidades” prioriza `isNew`, depois `createdAt`; as outras opções são menor preço, maior preço e nome. Nenhuma consulta altera a fonte original.

## Como testar

```sh
npm test
```

A suíte nativa do Node cobre categoria, tamanho, cor e combinação de variações, busca em todos os campos, preço promocional, faixa inclusiva, ordenação, inativos, integridade dos dados, favoritos/persistência e renderização dos cards. Não requer infraestrutura adicional.

Para conferir sintaxe (shell Unix/Termux):

```sh
node --check server.js
node --check public/js/app.js
find public/js tests -name '*.mjs' -exec node --check {} \;
```

## Validação manual no navegador

1. Inicie `npm start` e visite a Home e `/catalogo.html`. Confira as vitrines originais e o link “Explorar catálogo”. O catálogo sem filtros deve exibir **12 de 12 produtos demonstrativos**.
2. Teste ambas as páginas em **320, 375, 768 e 1440 px** nas ferramentas de desenvolvimento. Confira legibilidade, menu mobile, filtros, cards e ausência de rolagem horizontal. Uma checagem no console é `document.documentElement.scrollWidth <= window.innerWidth`.
3. No catálogo, combine **Calças + GG + Chumbo**: deve restar a calça Amélia. Limpe os filtros. Use mínimo **179,90** e máximo **189,90**: devem aparecer Amélia e Essência. Inverta a faixa para conferir a mensagem de erro.
4. Busque **AMELIA**, **calça**, **entardecer**, **mangas delicadas** e um termo inexistente. A busca do header também consulta as descrições na Home e no catálogo. Verifique o estado vazio.
5. Alterne entre novidades, menor preço, maior preço e nome. Ao ordenar por preço, Aurora deve ser a primeira na ordem crescente e Clara a primeira na decrescente.
6. Favorite uma peça na Home, confira a sincronização entre vitrines, visite o catálogo e recarregue a página. O favorito deve permanecer. Teste também o filtro de favoritos e a remoção da última peça favoritada. Se o armazenamento estiver bloqueado, os favoritos continuam em memória.
7. Os filtros ficam na URL; recarregue uma URL filtrada e confira a restauração. Clique na imagem ou nome de um produto: o catálogo registra seu slug e informa que a página individual será criada futuramente, sem gerar uma rota inexistente.
8. Adicione uma peça à sacola e confira o contador demonstrativo. Ele é zerado ao recarregar ou navegar para outra página; não há carrinho real.
9. Use Tab/Enter para acessar links, favoritos e filtros. Confira foco visível, labels e link “Pular para o conteúdo”. `Esc` fecha menu/pesquisa e devolve o foco ao botão.
10. Envie um e-mail válido na newsletter e confirme a mensagem demonstrativa; nenhum e-mail é armazenado ou enviado.

Para abrir em outro dispositivo na mesma rede, use `http://IP-DO-SERVIDOR:3000`, com a porta acessível na rede local.

## Limitações desta etapa

Produtos, preços, parcelamento, promoções, datas, estoques e a seleção de mais vendidos são fictícios. Benefícios e pagamentos são apresentação visual do serviço previsto. Não há produtos disponíveis para compra.

Favoritos guardam apenas IDs na chave `maisbella:favorites:v1` do `localStorage`, com sincronização entre abas da mesma origem e fallback em memória. Não há conta ou sincronização entre dispositivos. A sacola permanece somente um contador temporário.

A seleção de produto usa `/catalogo.html?produto=slug#catalogo`. O destino fica centralizado em `productURL` para futura substituição; nenhuma página individual completa foi criada.

Não há banco de dados, autenticação, painel administrativo, pagamento, checkout, coleta de e-mails ou integração social. JavaScript é necessário para renderizar as vitrines e os filtros. Google Fonts é opcional: fontes de fallback mantêm o layout funcional sem conexão; as ilustrações não dependem de imagens externas. A preferência por movimento reduzido é respeitada.

Nenhuma credencial é necessária. `.env` e `node_modules` estão ignorados pelo Git.
