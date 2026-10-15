# Mais Bella

Loja de moda feminina com identidade de boutique: blush, rosa queimado, nude e off-white, títulos serifados e textos modernos.

**MAISBELLA-001 — concluído:** primeira versão visual responsiva da Home, com navegação, hero ilustrado, categorias, novidades, banner da marca, mais vendidos, benefícios, newsletter e rodapé.

**MAISBELLA-002 — catálogo estruturado:** fonte local com 12 produtos fictícios, cards reutilizáveis, catálogo com filtros combináveis e ordenação, busca em nome/categoria/descrições e favoritos por ID persistidos no navegador. A identidade e as seções da Home foram preservadas. Nenhum banco de dados ou framework frontend foi adicionado.

**MAISBELLA-003 — página individual e sacola local:** produto por slug ou ID, galeria local com miniaturas, cores/tamanhos derivados dos dados, estoque fictício por variação, quantidade limitada e guia de medidas demonstrativo em modal. A sacola persiste localmente, tem painel no header e página de revisão, sem checkout. Home e catálogo continuam com sua identidade original.

**MAISBELLA-004 — sacola e pedido pelo WhatsApp:** revisão com aumento/diminuição de quantidades, formulário temporário de atendimento, entrega/retirada e mensagem estruturada. O número comercial público está centralizado em `public/js/config.mjs`; a configuração existente foi preservada. Os casos sem número continuam bloqueados com uma explicação.

**MAISBELLA-005 — backend e SQLite:** banco como fonte operacional do catálogo, migrations, seed idempotente e API pública de leitura. Home, catálogo, produto e sacola carregam os dados pela API antes das interações. Sem mudança de layout, autenticação ou rotas administrativas.

## Instalar e executar

Pré-requisito: **Node.js 24.15 ou superior com `node:sqlite` disponível** e npm. Validado neste Android/Termux com Node.js 26.3.1 e SQLite 3.53.2. Use um navegador moderno com suporte a módulos JavaScript e ao elemento nativo `<dialog>`.

```sh
npm install
# Opcional: copie .env.example para .env e ajuste PORT/DB_PATH/SEED_DEMO.
npm start
```

- Home: **http://localhost:3000/**
- Catálogo: **http://localhost:3000/catalogo.html**
- Produto de exemplo: **http://localhost:3000/produto.html?slug=vestido-midi-essencia**
- Sacola local: **http://localhost:3000/sacola.html**

Para outra porta:

```sh
PORT=4000 npm start
```

O servidor inicializa SQLite/migrations antes de aceitar conexões. Em desenvolvimento, aplica automaticamente o seed idempotente; em produção, o padrão é não aplicar. Express serve somente `public` e a API, usando a porta configurada ou 3000. Abra as páginas pelo servidor, evitando `file://`, pois elas carregam módulos JavaScript.

## Arquivos principais

```text
public/
  index.html               # Home original consumindo o catálogo compartilhado
  catalogo.html            # Coleção, filtros e resultados acessíveis
  produto.html             # Estrutura da página de produto e guia de medidas
  sacola.html              # Revisão de quantidades e formulário para WhatsApp
  css/style.css            # Identidade original e estilos adicionais do catálogo
  js/
    app.js                 # Inicializador da página
    data/products.mjs      # Cache por visita, preenchido pela API, sem produtos hardcoded
    catalog.mjs            # Busca, filtros, ordenação e opções (lógica pura)
    products.mjs           # Cards, imagens compartilhadas e links por slug
    product-model.mjs      # Localização e validação pura de variações/estoque
    product-page.mjs       # Galeria, opções, quantidade e página individual
    cart.mjs               # Operações puras, persistência e estado da sacola
    cart-panel.mjs         # Drawer e renderização compartilhada dos itens
    cart-page.mjs          # Revisão, formulário temporário e validação acessível
    config.mjs             # Único local para o número comercial oficial
    whatsapp.mjs           # Validação, mensagem e link wa.me (lógica pura)
    whatsapp-ui.mjs        # Atalho flutuante e contatos rápidos seguros
    dialog.mjs             # Abertura/fechamento e retorno do foco dos modais
    storefront.mjs         # Menu, pesquisa, favoritos, sacola e newsletter
    home.mjs               # Vitrines de novidades e mais vendidos
    catalog-page.mjs       # Interface e estado dos filtros do catálogo
  assets/                  # Reservado para futuras imagens locais
src/
  app.js                   # Express, Helmet, API e tratamento de erros
  config.js                # Configuração de ambiente
  routes/                  # Rotas públicas somente de leitura
  controllers/             # Respostas HTTP
  services/                # Casos de uso e validação reutilizável
  repositories/            # Consultas parametrizadas e montagem dos produtos
  middleware/              # Erros HTTP sem detalhes internos
  db/
    database.js            # Conexão SQLite e migrations transacionais
    migrations/001_catalog.sql
    seed.js                # Seed de desenvolvimento, idempotente
    seed-products.mjs      # Única definição dos 12 produtos demonstrativos
scripts/seed.js             # Comando npm run db:seed
data/                      # SQLite local (ignorado pelo Git)
tests/
  backend.test.mjs          # Banco temporário, seed, integridade, segurança e API real
  catalog-api-client.test.mjs # Hidratação da vitrine e compatibilidade de dados locais
  helpers/catalog-fixture.mjs # Fixture explícita para os testes anteriores
  catalog.test.mjs          # Testes de catálogo com node:test e assert
  product-cart.test.mjs     # Produto, variações, estoque e sacola
  whatsapp-order.test.mjs   # Quantidades, validação e mensagem/link WhatsApp
  whatsapp-floating.test.mjs # Regressão de ocultação no scroll e contato seguro
server.js
package.json
```

## Modelo de produto

Os nomes dos campos usam inglês no código, com conteúdo em português:

| Campo | Finalidade |
| --- | --- |
| `id`, `slug` | Identificador estável e referência para a página individual |
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

A fonte operacional é o SQLite, acessado pela API. `public/js/data/products.mjs` mantém apenas o cache desta visita, compartilhado pela Home, catálogo, produto e sacola. Os dados de demonstração usados exclusivamente pelo seed/testes ficam em `src/db/seed-products.mjs`; editar esse arquivo não sobrescreve registros já persistidos. IDs antigos foram preservados. As ilustrações usam as formas CSS existentes; o card também suporta uma imagem local com `{ type: 'image', src: '/assets/arquivo.webp', alt: 'Descrição' }`.

Filtros combinam categoria, tamanho, cor, faixa de preço e busca. Quando tamanho e cor são selecionados, a combinação deve existir nas variações. O estoque não determina disponibilidade comercial nesta demonstração. Produtos inativos são excluídos das vitrines e das opções de filtros.

A busca ignora caixa e acentos e pesquisa nome, categoria e ambas as descrições. Cada palavra digitada deve aparecer no conteúdo do produto. Preços e parcelamento consideram a promoção válida, quando presente. A ordem “Novidades” prioriza `isNew`, depois `createdAt`; as outras opções são menor preço, maior preço e nome. Nenhuma consulta altera a fonte original.

## Como testar

```sh
npm test
```

A suíte nativa do Node cobre categoria, tamanho, cor e combinação de variações, busca em todos os campos, preço promocional, faixa inclusiva, ordenação, inativos, integridade dos dados, favoritos/persistência e renderização dos cards. Também cobre localizar produto por slug/ID, validar cor+tamanho, recusar esgotados e quantidades inválidas, adicionar/combinar/diferenciar/remover itens, subtotal em centavos, persistência, dados locais inválidos e fallback em memória. Os testes de WhatsApp cobrem mensagem, total, quantidade, variações separadas, dados obrigatórios, número não configurado, formato/codificação do link e caracteres especiais. Nenhum teste abre conversa, envia pedido ou altera a configuração da loja. Não requer infraestrutura adicional.

Para conferir sintaxe (shell Unix/Termux):

```sh
node --check server.js
node --check public/js/app.js
find src scripts public/js tests -type f \( -name '*.js' -o -name '*.mjs' \) -exec node --check {} \;
```

## Validação manual no navegador

1. Inicie `npm start` e visite a Home e `/catalogo.html`. Confira as vitrines originais e o link “Explorar catálogo”. O catálogo sem filtros deve exibir **12 de 12 produtos demonstrativos**.
2. Teste Home, catálogo, produto e sacola em **320, 375, 768 e 1440 px** nas ferramentas de desenvolvimento. Confira legibilidade, menu mobile, filtros, cards e ausência de rolagem horizontal. Uma checagem no console é `document.documentElement.scrollWidth <= window.innerWidth`.
3. No catálogo, combine **Calças + GG + Chumbo**: deve restar a calça Amélia. Limpe os filtros. Use mínimo **179,90** e máximo **189,90**: devem aparecer Amélia e Essência. Inverta a faixa para conferir a mensagem de erro.
4. Busque **AMELIA**, **calça**, **entardecer**, **mangas delicadas** e um termo inexistente. A busca do header também consulta as descrições na Home e no catálogo. Verifique o estado vazio.
5. Alterne entre novidades, menor preço, maior preço e nome. Ao ordenar por preço, Aurora deve ser a primeira na ordem crescente e Clara a primeira na decrescente.
6. Favorite uma peça na Home, confira a sincronização entre vitrines, visite o catálogo e recarregue a página. O favorito deve permanecer. Teste também o filtro de favoritos e a remoção da última peça favoritada. Se o armazenamento estiver bloqueado, os favoritos continuam em memória.
7. Os filtros ficam na URL; recarregue uma URL filtrada e confira a restauração. Clique na imagem, no nome ou em “Escolher opções”: deve abrir `/produto.html?slug=...`. Os favoritos continuam independentes do link.
8. Na página individual, escolha cor e tamanho, adicione uma peça e confira o contador. Abra o painel da sacola e “Ver sacola”, recarregue e remova o item. Os itens devem permanecer entre páginas e recarregamentos na mesma origem.
9. Use Tab/Enter para acessar links, favoritos e filtros. Confira foco visível, labels e link “Pular para o conteúdo”. `Esc` fecha menu/pesquisa e devolve o foco ao botão.
10. Envie um e-mail válido na newsletter e confirme a mensagem demonstrativa; nenhum e-mail é armazenado ou enviado.

Para abrir em outro dispositivo na mesma rede, use `http://IP-DO-SERVIDOR:3000`, com a porta acessível na rede local.

## Variações, estoque e sacola local — MAISBELLA-003

A página renderiza nome, categoria, descrições, novidade, preço vigente, desconto e parcelamento a partir da fonte compartilhada. A galeria usa todas as entradas de `images`, com miniaturas e controles anterior/próxima quando há mais de uma. Essência e Serena têm duas composições ilustrativas locais; fotografias futuras podem usar o mesmo modelo de imagem. Cores são escolhas independentes da imagem ilustrativa.

Não há seleção automática de cor ou tamanho. Escolha a cor primeiro; os tamanhos esgotados nessa cor ficam desabilitados e identificados. A combinação cor+tamanho precisa existir nos dados. A quantidade aceita inteiros a partir de 1 e respeita o estoque demonstrativo **incluindo a quantidade dessa mesma variação já na sacola**. Estoques da fonte não são reduzidos, reservados ou enviados a um servidor.

Os cards abrem “Escolher opções” na página individual em vez de adicionar uma variação indefinida. A sacola salva `productId`, `slug`, `name`, `price`, `color`, `size`, `quantity` e `image`. Itens são combinados somente por produto + cor + tamanho. O subtotal soma centavos para evitar erros de ponto flutuante. Ao ler dados locais, o catálogo é a fonte para preços, imagens e estoque: registros inválidos/inativos são ignorados, duplicatas normalizadas e quantidades limitadas ao estoque atual fictício.

O header de todas as páginas exibe a soma das quantidades e abre um painel com itens, variações, subtotal, remoção e link para `sacola.html`. Essa página permite editar quantidades dentro do estoque fictício, revisar/remover itens e preparar atendimento pelo WhatsApp. Alterações são refletidas em abas da mesma origem. A sacola é local, sem conta, sincronização entre dispositivos ou garantia de concorrência entre gravações simultâneas.

Guia de medidas e painel usam `<dialog>.showModal()`: foco contido pelo navegador, botão de fechamento, Escape, fundo inerte e retorno do foco ao controle que abriu o modal. A tabela de medidas é uma referência fictícia; substitua-a por medidas oficiais antes de qualquer uso comercial.

### Conferir a página individual

1. Abra `/produto.html?slug=vestido-midi-essencia`, compare as duas imagens pela miniatura e pelas setas. Confira preço base, promoção e descrições.
2. Escolha **Rosa queimado**: **P** deve ficar esgotado/desabilitado; **M** tem **5** unidades fictícias. Escolha M, tente ultrapassar 5 e confira o limite. Adicione 2: só mais 3 dessa combinação devem ser aceitas.
3. Adicione novamente a mesma combinação e confira que continua em uma linha com quantidade somada. Mude para **Nude + M**: deve gerar uma linha separada. Não altere o estoque da fonte.
4. Abra a sacola do header; confira variações, quantidades e subtotal. Use “Ver sacola”, remova um item e confira painel/contador. Recarregue a Home: a quantidade deve permanecer.
5. Favorite/desfavorite na página individual e confira Home/catálogo após navegar ou em outra aba.
6. Abra “Guia de medidas”, confira a identificação de referência fictícia e navegue com Tab/Shift+Tab. Escape e o botão de fechar devem devolver foco ao acionador. Repita no painel da sacola.
7. Teste `/produto.html?id=vestido`, `/produto.html?slug=inexistente` e a URL sem parâmetros. As duas últimas devem mostrar o estado de produto não encontrado.
8. Verifique em **320, 375, 768 e 1440 px**: galeria, nomes, preços, opções e modais legíveis, controles de toque confortáveis e sem overflow horizontal. A conferência visual em navegador real é necessária; testes de lógica não validam layout ou leitores de tela.

## Sacola e pedido pelo WhatsApp — MAISBELLA-004

Fluxo: Home/catálogo → produto → cor/tamanho → adicionar → revisar sacola → preencher os dados básicos → abrir a mensagem no WhatsApp. O envio final depende da confirmação da cliente dentro do WhatsApp; abrir o link não confirma disponibilidade, reserva, pagamento ou pedido.

### Configurar futuramente o número comercial

Edite **apenas `public/js/config.mjs`**, propriedade `storeConfig.whatsappNumber`. O número público existente já está configurado e não foi alterado nesta tarefa. Para um novo ambiente sem contato oficial, use o estado seguro vazio (exemplo sem número):

```js
export const storeConfig = Object.freeze({
  whatsappNumber: ''
});
```

Para configurar ou trocar o número oficial, substitua somente o valor da propriedade pelo número comercial completo, com código do país, DDD e número, usando apenas dígitos. Não inclua +, espaços, parênteses, hífens ou prefixo de discagem. Não é necessário editar outros arquivos. Recarregue as páginas após a alteração.

A validação local verifica formato (8–15 dígitos e início diferente de zero), mas não verifica se a conta WhatsApp existe nem se pertence à loja. O formato do link segue a [documentação oficial de clique para conversa do WhatsApp](https://faq.whatsapp.com/5913398998672934/?locale=pt_BR): `https://wa.me/` seguido do número e `?text=` com mensagem codificada por `encodeURIComponent`.

Enquanto a configuração estiver vazia ou inválida:

- “Finalizar pedido pelo WhatsApp” permanece desabilitado com explicação visível.
- Atalho flutuante, “Fale com a gente” e “Tenho uma dúvida” mostram a indisponibilidade; nenhum link externo é aberto.
- Sacola, edição de quantidades, favoritos e demais funções continuam disponíveis.

### Revisão e dados temporários

Cada linha da sacola mostra variação, preço unitário, quantidade e subtotal. Os botões +/− respeitam mínimo 1 e o estoque fictício de cada cor+tamanho. A alteração persiste no armazenamento local e atualiza painel, contador e subtotal. O estado vazio mostra “Sua sacola está esperando por você.” com “Explorar coleção”.

O formulário pede apenas nome, WhatsApp/telefone, cidade e bairro. Entrega e retirada são escolhas obrigatórias. Entrega permite uma observação opcional e informa que condições/frete serão confirmados no atendimento. Retirada informa que local/horário serão combinados pelo WhatsApp. Não há cálculo automático.

Esses dados ficam somente nos campos durante a visita: não são salvos em localStorage, enviados ao servidor nem registrados no console. O formulário é limpo ao sair da página, incluindo navegação com BFCache. Ao clicar para continuar com a configuração válida, os dados selecionados passam a compor o link/mensagem para o WhatsApp. Não há histórico de pedidos na loja.

A geração da mensagem é independente do HTML: usa dados numéricos da sacola, cálculo em centavos, validação contra o catálogo e seções de pedido, total sem frete, cliente e forma de recebimento. Produtos, valores e estoque permanecem identificados como demonstrativos. A sacola não é esvaziada ao abrir o WhatsApp, pois a loja não sabe se a cliente enviou a mensagem.

O atalho flutuante usa círculo verde e símbolo branco vetorial local, sem texto lateral. É filho direto do body, fixo na viewport, com z-index 1000, safe-area inferior/direita e alvo de toque de 56 px. Não há detecção de colisão ou mudanças de visibilidade durante scroll. O espaço inferior da página e scroll-margin dos controles permitem rolar os controles para fora da área do atalho; ao abrir um modal, o atalho fica oculto para preservar a prioridade do modal. Na página individual, “Tenho uma dúvida” prepara uma mensagem com o nome da peça, preservando “Adicionar à sacola”.

### Testar esta etapa

1. Execute `npm test` e `npm start`. Abra o produto Essência e adicione **Rosa queimado + M**. Na sacola, use +/−: mínimo 1, máximo 5 unidades fictícias. Confira subtotal, contador, persistência após recarregar e variações separadas.
2. Remova todas as peças: confira a mensagem de sacola vazia e o botão para o catálogo. Adicione novamente para visualizar o formulário.
3. Confira os atalhos com a configuração comercial atual. O cenário sem número é coberto por testes que não alteram a configuração da loja nem abrem conversas.
4. Alterne entrega/retirada e confira campo opcional, explicações e remoção da observação de entrega ao escolher retirada. Preencha dados temporários, recarregue e confira que o formulário foi limpo, mantendo a sacola.
5. Quando o número oficial estiver disponível e configurado, tente finalizar sem dados ou com telefone inválido: devem aparecer resumo de erros, mensagens junto aos campos e `aria-invalid`. Preencha os dados válidos e confira no WhatsApp os itens, variações, quantidades e total, antes de decidir enviar.
6. Teste nomes/cidades com acentos e & e observações com símbolos. Os testes automatizados conferem ida e volta da codificação sem contato externo.
7. Verifique em **320, 375, 768 e 1440 px**: formulário, controles de quantidade, subtotal, botões e atalho legíveis; sem overflow horizontal ou controles encobertos. Confira teclado e feedback acessível em navegador real. No Android/Chrome, role continuamente nas quatro páginas, passando por hero, cards, formulário e rodapé: o círculo deve permanecer fixo, sem piscar. Ao abrir/fechar um modal, confirme a ocultação intencional e o retorno do atalho.

Esta etapa não envia pedidos nem executa testes que contatem o número comercial. Disponibilidade, frete, entrega e pagamento dependem de confirmação humana no atendimento. A conferência visual em navegador real continua necessária.

## Backend e persistência — MAISBELLA-005

### Decisão técnica no Termux

O driver escolhido é **`node:sqlite` (`DatabaseSync`)**, incluído no próprio Node e testado no runtime deste Termux. Não foi instalado `better-sqlite3`, `sqlite3`, node-gyp ou outro addon nativo de npm; não há etapa de compilação nem binário de desktop a baixar. A versão mínima do projeto é Node.js 24.15. Se outra instalação não disponibilizar `node:sqlite`, atualize o Node do Termux antes de executar.

O módulo está documentado como release candidate na [documentação do Node 24](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html). Uma alternativa WASM avaliada foi [sql.js](https://github.com/sql-js/sql.js), mas seu modelo padrão usa o banco em memória com importação/exportação do arquivo inteiro. Neste ambiente, o driver já embutido permite SQLite em arquivo, transações, locks e WAL diretamente, sem criar uma camada própria de persistência. A API síncrona é adequada ao catálogo pequeno desta etapa; carga maior exigirá avaliar paginação e execução fora do event loop.

### Arquitetura e tabelas

Fluxo: `server.js → src/app.js → routes → controllers → services → repositories → SQLite`.

- `schema_migrations`: nome, checksum SHA-256 e momento da aplicação das migrations.
- `categories`: ID, slug/nome únicos, ordem, ativo e timestamps.
- `products`: IDs anteriores preservados; slug único, descrições, categoria por FK, preços inteiros em centavos, flags, marca demonstrativa e timestamps.
- `product_images`: ID, produto, referência local/ilustração, alt, ordem e imagem principal; índice parcial permite no máximo uma principal por produto. Não contém binários.
- `product_variations`: ID, produto, cor, tamanho, estoque inteiro, ativo e ordem; unicidade de produto + cor + tamanho.
- `seed_runs`: marca de aplicação do conjunto de demonstração, independente de edições futuras nos produtos.

As tabelas usam SQLite STRICT, foreign keys, CHECKs para estoque/preços/booleans, índices e consultas parametrizadas. Valores monetários persistem em `price_cents` e `promotional_price_cents`; a API também fornece `price`/`promotionalPrice` em reais para manter o contrato da vitrine. Criação/validação internas recebem `priceCents`/`promotionalPriceCents` inteiros. Não há rota de escrita disponível para clientes.

### Inicialização, configuração e seed

`npm start` carrega `.env`, se existir, sem exigir credenciais. As variáveis do shell têm precedência. Configurações de `.env.example`:

| Variável | Uso |
| --- | --- |
| `PORT` | Porta HTTP; padrão 3000 |
| `DB_PATH` | Caminho SQLite relativo à raiz ou absoluto; padrão `data/maisbella.sqlite` |
| `NODE_ENV` | Em `production`, seed automático fica desativado por padrão |
| `SEED_DEMO` | `true`/`false` para definir explicitamente o seed no startup |

Banco e diretório são criados se necessário. Migrations numeradas de `src/db/migrations` são executadas em transação e registradas com checksum. As já aplicadas não são reexecutadas. Não altere migrations aplicadas: adicione uma nova. Não há reset automático, DROP ou exclusão de dados no startup. Se um checksum divergir ou houver erro, a transação é revertida e a aplicação não inicia.

Para aplicar manualmente o seed de desenvolvimento:

```sh
npm run db:seed
npm run db:seed
```

Na primeira aplicação em um banco novo: `{"applied":true,"inserted":12}`. Na segunda: `{"applied":false,"inserted":0}`. IDs e slugs já ocupados são preservados; o seed não atualiza preços, estoque, nomes ou status existentes. A marca em `seed_runs` impede que uma execução posterior restaure produtos editados ou removidos. O seed explícito funciona mesmo com `SEED_DEMO=false`; não o execute num ambiente onde não deseja dados demonstrativos.

Para usar outro arquivo no Termux sem tocar no banco padrão:

```sh
DB_PATH=data/desenvolvimento.sqlite npm run db:seed
DB_PATH=data/desenvolvimento.sqlite SEED_DEMO=false npm start
```

Arquivos `*.sqlite`, `*.sqlite3`, `*.db` e auxiliares WAL/SHM/journal estão ignorados pelo Git. O banco não pode ser configurado dentro de `public`. Não mova um banco existente para a pasta pública. Não faça backup copiando apenas o arquivo principal enquanto há gravações em WAL: pare a aplicação e comandos de seed antes de copiar o conjunto de arquivos.

### API pública somente de leitura

| Endpoint | Resposta |
| --- | --- |
| `GET /api/products` | `{ "products": [...] }` |
| `GET /api/products/:slug` | `{ "product": {...} }` ou 404 `{ "error": "Produto não encontrado" }` |
| `GET /api/categories` | `{ "categories": [...] }` |

Filtros de produtos: `category` (slug da categoria), `search`, `featured`, `new`, `bestSeller`. Também são aceitos `categoria`, `busca`, `destaque`, `novidade`, `maisVendidos`. Booleans: `true`, `false`, `1`, `0`. A busca ignora caixa/acentos e consulta nome, categoria e ambas as descrições. Não há paginação nesta etapa.

```sh
curl http://localhost:3000/api/products
curl http://localhost:3000/api/products/vestido-midi-essencia
curl 'http://localhost:3000/api/products?category=vestidos&new=true'
curl 'http://localhost:3000/api/products?search=AMELIA'
curl http://localhost:3000/api/categories
```

Produtos inativos e produtos de categorias inativas não são retornados nem pelo slug. Variações inativas não são expostas; estoque zero permanece visível como esgotado. Categorias vêm do banco, inclusive novas categorias ativas sem produtos. A API não aceita escolher `active=false` para ver dados internos. Erros usam `{ "error": "mensagem" }`, sem SQL, stack, caminhos ou detalhes sensíveis: 400 para parâmetros/JSON inválidos, 413 para corpo acima de 16 KiB, 404 para inexistentes e 500 com mensagem genérica.

### Segurança e transição da vitrine

Helmet é a única dependência adicionada. Define CSP, nosniff, proteção contra framing e outros headers, mantendo scripts locais, ilustrações/SVGs e fontes Google existentes. A CSP permite estilos inline necessários aos seletores de cor; não permite JavaScript inline. Upgrade automático de HTTP e HSTS ficam desativados para o acesso local do Termux; configure HTTPS no deploy. Express serve exclusivamente `public`, bloqueia dotfiles e não serve banco, `.env`, `src` ou `node_modules`.

A inicialização do frontend aguarda produtos e categorias da API antes de abrir as interações. IDs/slugs, estrutura dos produtos, cores/tamanhos e preços em reais são compatíveis com as etapas anteriores. Menu e filtro de categorias recebem os dados persistidos; os cards editoriais da Home mantêm sua composição visual. Não há segundo catálogo estático ativo no navegador.

Se a API falhar ou responder com contrato inválido, a página exibe orientação para recarregar e não inicializa operações que poderiam regravar a sacola com dados ausentes. A vitrine agora precisa do servidor/API para carregar; não há fallback offline com preços/estoque antigos. A sacola e favoritos continuam locais, e pedidos/dados do formulário não são enviados a este backend. Número comercial e mensagem do WhatsApp foram preservados.

### Testes e futuro painel

`npm test` executa **70 testes**: os 47 anteriores permanecem, mais 20 de backend e 3 de integração do cache da vitrine. Os testes anteriores usam uma fixture explícita do mesmo arquivo do seed, sem banco de desenvolvimento. Testes do backend criam arquivos próprios com `mkdtemp` no tmp do Termux ou SQLite `:memory:`; não leem `.env` nem usam o `DB_PATH` da aplicação. Cada arquivo temporário pertence exclusivamente ao teste e é limpo ao final. A API é testada por HTTP real em porta efêmera.

Valida-se inicialização/reabertura, migrations, seed repetido, preservação de edições, slugs/variações únicos, FKs, centavos, imagens, ativos, estoque, filtros, JSON, segurança, erros e a compatibilidade da sacola/favoritos/WhatsApp com dados vindos do banco. Nenhum teste envia mensagens ao WhatsApp.

O futuro painel autenticado chamará os serviços/validadores existentes e usará as tabelas de catálogo para edição, imagens e variações. Ainda precisam ser implementados autenticação/autorização apropriadas, rotas privadas, atualização com timestamps, upload validado e UI administrativa. Não há login improvisado, senha no frontend ou endpoint administrativo público nesta etapa. Estoque no pedido continua apenas uma validação local demonstrativa, sem reserva ou baixa transacional de vendas.

## Limitações desta etapa

Produtos, preços, parcelamento, promoções, datas, estoques e a seleção de mais vendidos são fictícios. Benefícios e pagamentos são apresentação visual do serviço previsto. Não há produtos disponíveis para compra.

Favoritos guardam apenas IDs na chave `maisbella:favorites:v1` do `localStorage`, com sincronização entre abas da mesma origem e fallback em memória. Não há conta ou sincronização entre dispositivos. A sacola guarda apenas itens demonstrativos na chave `maisbella:cart:v1` do mesmo armazenamento; quando o armazenamento estiver bloqueado, há feedback e fallback em memória apenas na página atual.

A página individual usa `/produto.html?slug=slug` e também aceita `?id=id`. O destino fica centralizado em `productURL`. URLs antigas com `/catalogo.html?produto=slug` redirecionam para a nova página pelo JavaScript. Produto inexistente ou inativo mostra “Produto não encontrado” e retorno ao catálogo.

Há SQLite para catálogo, mas não há autenticação, painel administrativo, persistência de pedidos, upload, pagamento, checkout, cálculo de frete ou coleta de e-mails. WhatsApp utiliza apenas o link público oficial, sem API ou envio automático. JavaScript é necessário para renderizar vitrines, filtros, produto e sacola. O limite de estoque é uma validação local demonstrativa; não existe validação comercial no servidor. Google Fonts é opcional: fontes de fallback mantêm o layout funcional sem conexão; as ilustrações não dependem de imagens externas. A preferência por movimento reduzido é respeitada.

Nenhuma credencial é necessária. `.env` e `node_modules` estão ignorados pelo Git.
