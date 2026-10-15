# Mais Bella

Loja de moda feminina com identidade de boutique: blush, rosa queimado, nude e off-white, títulos serifados e textos modernos.

**MAISBELLA-001 — concluído:** primeira versão visual responsiva da Home, com navegação, hero ilustrado, categorias, novidades, banner da marca, mais vendidos, benefícios, newsletter e rodapé.

**MAISBELLA-002 — catálogo estruturado:** fonte local com 12 produtos fictícios, cards reutilizáveis, catálogo com filtros combináveis e ordenação, busca em nome/categoria/descrições e favoritos por ID persistidos no navegador. A identidade e as seções da Home foram preservadas. Nenhum banco de dados ou framework frontend foi adicionado.

**MAISBELLA-003 — página individual e sacola local:** produto por slug ou ID, galeria local com miniaturas, cores/tamanhos derivados dos dados, estoque fictício por variação, quantidade limitada e guia de medidas demonstrativo em modal. A sacola persiste localmente, tem painel no header e página de revisão, sem checkout. Home e catálogo continuam com sua identidade original.

**MAISBELLA-004 — sacola e pedido pelo WhatsApp:** revisão com aumento/diminuição de quantidades, formulário temporário de atendimento, entrega/retirada e mensagem estruturada. O número comercial público está centralizado em `public/js/config.mjs`; a configuração existente foi preservada. Os casos sem número continuam bloqueados com uma explicação.

**MAISBELLA-005 — backend e SQLite:** banco como fonte operacional do catálogo, migrations, seed idempotente e API pública de leitura. Home, catálogo, produto e sacola carregam os dados pela API antes das interações. Sem mudança de layout, autenticação ou rotas administrativas.

**MAISBELLA-006 — implementação para revisão:** autenticação administrativa, sessões, operações protegidas e painel responsivo em `/admin.html`. Consulte a configuração e as limitações abaixo. Nenhum administrador é criado automaticamente.

**MAISBELLA-007 — painel mobile para validação:** navegação por áreas, resumo do catálogo, filtros e edição em seções, preservando a segurança da etapa 006.

**MAISBELLA-008 — fotos para validação:** seleção pela galeria do celular, prévias, principal e remoção, com upload protegido e armazenamento local. Consulte a seção de fotos ao final.

**MAISBELLA-009 — fluxo WhatsApp para validação:** revisão atualizada de estoque/preço, dados básicos e mensagem organizada, distinguindo produtos reais dos demonstrativos.

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

A seção MAISBELLA-006 abaixo documenta o painel que agora utiliza os validadores e tabelas existentes. Upload e baixa transacional de vendas continuam fora do escopo.

## Limitações desta etapa

Os produtos do seed continuam fictícios e identificados por `demo=true`. Cadastros operacionais do painel usam `demo=false`. Antes de uso comercial, desative os demonstrativos e revise as informações reais da loja; o fechamento ocorre pelo WhatsApp, sem pagamento ou reserva automática no site.

Favoritos guardam apenas IDs na chave `maisbella:favorites:v1` do `localStorage`, com sincronização entre abas da mesma origem e fallback em memória. Não há conta ou sincronização entre dispositivos. A sacola guarda apenas itens demonstrativos na chave `maisbella:cart:v1` do mesmo armazenamento; quando o armazenamento estiver bloqueado, há feedback e fallback em memória apenas na página atual.

A página individual usa `/produto.html?slug=slug` e também aceita `?id=id`. O destino fica centralizado em `productURL`. URLs antigas com `/catalogo.html?produto=slug` redirecionam para a nova página pelo JavaScript. Produto inexistente ou inativo mostra “Produto não encontrado” e retorno ao catálogo.

Há SQLite, autenticação e painel administrativo. Ainda não há persistência de pedidos, pagamento, checkout, cálculo de frete ou coleta de e-mails. Upload de fotos está documentado na etapa 008. WhatsApp utiliza apenas o link público oficial, sem API ou envio automático. JavaScript é necessário para renderizar vitrines, filtros, produto e sacola. A sacola consulta o catálogo atualizado antes de abrir o WhatsApp; não há reserva nem confirmação transacional de venda no servidor. Google Fonts é opcional: fontes de fallback mantêm o layout funcional sem conexão; as ilustrações não dependem de imagens externas. A preferência por movimento reduzido é respeitada.

A vitrine não exige credenciais; o painel exige configuração explícita. `.env` e `node_modules` estão ignorados pelo Git.

## Autenticação e painel — MAISBELLA-006

Acesse **http://localhost:3000/admin.html**. O painel tem login, consulta de todos os produtos (inclusive inativos e demonstrativos), criação/edição, promoção, status, categorias e variações com cor, tamanho, estoque e status próprios. A vitrine pública e o fluxo de favoritos/sacola/WhatsApp permanecem com o mesmo contrato. As escritas na API pública continuam indisponíveis; preços e estoques vêm do SQLite, nunca do corpo enviado pela sacola.

### Configuração local e primeiro administrador

No Termux, com Node.js 24.15 ou superior:

```sh
npm install
# Somente se ainda não houver .env:
cp .env.example .env
chmod 600 .env
npm run admin:configure
npm start
```

O comando interativo solicita usuário e senha duas vezes, sem ecoar a senha, sem argumentos sensíveis no histórico e sem imprimir hash/segredo. Use uma senha exclusiva de **15 a 256 caracteres**, preferencialmente gerada por um gerenciador. O comando grava somente usuário, hash scrypt com sal aleatório e segredo criptográfico no `.env` privado. Não existe senha padrão, rota de cadastro ou credencial no frontend. Não execute o comando por pipe. Ele recusa arquivo que já contenha credenciais; não gera nem altera produtos. Sem credenciais, a vitrine funciona e a API administrativa responde 503. Configuração parcial/inválida impede iniciar o servidor.

A senha usa `scrypt` nativo do Node, N=32768, r=8, p=3, sal aleatório de 16 bytes, saída de 64 bytes e comparação de tempo constante. O banco não recebe credenciais. Não copie o `.env` para Git, mensagens, capturas ou diretórios públicos. Trate o hash como credencial sensível. O `.env.example` contém somente nomes de variáveis e configuração local sem credenciais.

| Variável | Configuração |
| --- | --- |
| `ADMIN_USER` | Identidade do único administrador autorizado nesta versão |
| `ADMIN_PASSWORD_HASH` | Hash no formato fixo gerado pelo comando; no `.env`, entre aspas simples |
| `SESSION_SECRET` | Pelo menos 32 bytes aleatórios em hexadecimal; o comando gera 32 bytes |
| `APP_ORIGIN` | Origem exata, incluindo protocolo/porta e sem barra final; local: `http://localhost:3000` |
| `NODE_ENV` | Use `production` no deploy para exigir as proteções de produção |
| `SEED_DEMO` | `false` em produção; novos bancos operacionais devem iniciar vazios |
| `TRUST_PROXY` | Ausente por padrão. Aceita somente `loopback`, se houver proxy HTTPS confiável na mesma máquina |
| `PORT`, `DB_PATH` | Mantêm as regras da etapa anterior; nunca ponha o banco em `public` |

Para acessar pelo IP na rede local, ajuste `APP_ORIGIN` para o endereço exato usado no navegador e reinicie. Não transmita credenciais por HTTP em redes não confiáveis. Para mudar a porta, ajuste também `APP_ORIGIN`. Não configure `TRUST_PROXY` sem o proxy descrito acima.

Para trocar credenciais: pare a aplicação, remova **somente** as três linhas de credenciais do `.env` privado, execute novamente `npm run admin:configure` e reinicie. Nunca coloque hash/senha em comandos do shell. Reiniciar invalida todas as sessões. Não há cadastro de múltiplos usuários, recuperação de senha ou níveis adicionais de acesso; a identidade configurada tem autorização para todo o catálogo.

### Sessões, CSRF e tentativas de login

Sessões opacas e tokens CSRF usam 32 bytes aleatórios independentes. O servidor mantém apenas a chave HMAC do identificador em memória; a sessão vence em **30 minutos absolutos**, sem renovação por atividade. Todo login válido gera um identificador novo e invalida o cookie anterior. Logout remove a sessão no servidor e expira o cookie. Cookies são `HttpOnly`, `SameSite=Strict`, `Path=/`, sem `Domain` e com expiração; em produção recebem `Secure` e nome `__Host-mb_admin`.

Todas as escritas administrativas exigem JSON e `Origin` exatamente igual a `APP_ORIGIN`. Login verifica a origem; as demais escritas exigem também sessão e header `X-CSRF-Token`, obtido no login ou na consulta de sessão. O frontend mantém o token somente em memória. Sessão ausente/expirada/encerrada retorna 401 e o painel volta ao login. Token/origem inválidos retornam 403. A API administrativa usa `Cache-Control: no-store`.

Há limite de **5 verificações de login por IP em janela de 15 minutos**, incluindo logins válidos, e de duas verificações de senha simultâneas por processo. Ao exceder retorna 429 com `Retry-After: 900`; o bloqueio pode durar até o fim da janela. Usuário e senha incorretos recebem a mesma resposta genérica. `X-Forwarded-For` não é confiado por padrão. Mapas têm limpeza por expiração e limites de tamanho.

**Esta versão exige um único processo servidor.** Sessões e limites ficam em memória: reinícios encerram sessões e reiniciam o controle de tentativas. Não use cluster/réplicas sem substituir esses armazenamentos por um serviço compartilhado e adicionar proteção de tentativas no proxy. Um invasor distribuído pode contornar limite por IP; aplique também limites no ingresso HTTPS. Não há MFA, auditoria persistente de alterações ou recuperação de conta nesta versão.

### Rotas administrativas

Todas estão sob `/api/admin`. Exceção à autenticação: somente `POST /login`. Não há registro público de administrador.

| Método e rota | Uso |
| --- | --- |
| `POST /login` | JSON `{ username, password }`; responde `{ authenticated, csrfToken, expiresAt }` e cookie |
| `GET /session` | Consulta sessão e token CSRF; não estende o prazo |
| `POST /logout` | Invalida sessão e remove cookie; enviar `{}` |
| `GET /products` | `{ products }`, inclui inativos e todas as variações |
| `GET /products/:id` | `{ product }` por ID estável, inclusive inativo |
| `POST /products` | Criação validada; responde 201 `{ product }` |
| `PUT /products/:id` | Substituição dos campos editáveis e das listas de imagens/variações; ativa/desativa com `active` |
| `GET /categories` | `{ categories }`, inclui inativas |
| `POST /categories` | Criação; responde 201 `{ category }` |
| `PUT /categories/:id` | Edita nome, slug, ordem e status; ID imutável |

Produtos usam `id`, `slug`, `name`, `shortDescription`, `description`, `categoryId`, `priceCents`, `promotionalPriceCents` (inteiro ou null), `active`, `featured`, `isNew`, `bestSeller`, `images` e `variations`. Categorias usam `id`, `slug`, `name`, `sortOrder`, `active`. O painel gera IDs aleatórios; IDs não mudam na edição. Variações usam `id` opcional, `color`, `size`, `stock` inteiro entre 0 e 1.000.000, `active` e `order` opcionais. Cores/tamanhos são gerenciados nessas variações, sem novas tabelas desnecessárias.

Valores monetários recebidos pelo servidor são **centavos inteiros**, até 2.147.483.647; a promoção deve ser inferior ao preço base. A UI converte reais com até duas casas decimais para centavos. As validações já existentes de imagens, unicidade e integridade foram preservadas. Alterações de produto/imagens/variações e categorias usam transações. Conflitos retornam 400 sem detalhes SQL, e erros inesperados retornam 500 genérico. `createdAt` e a marca `demo` são preservados na edição; produtos novos são operacionais (`demo=false`). Não transforme os produtos demonstrativos em reais: crie cadastros com informações verificadas.

A edição de produto substitui as listas de filhos atomicamente e mantém seu ID e data de criação; a interface preserva a galeria existente. Não há upload: para usar uma fotografia local em novos produtos, publique previamente uma imagem autorizada em `public/assets` e informe seu caminho, por exemplo `/assets/foto.webp`. A interface da etapa 007 também permite cadastrar com ilustração provisória, sem informar caminho de foto. O validador restringe referências locais. Não há exclusão física; desative produtos/categorias ou remova variações na edição. Categoria inativa oculta seus produtos da API pública. Edições simultâneas usam a última gravação; não há controle de versões nesta etapa.

### Produção e validação

Produção recusa ausência de credenciais/segredo válidos, origem sem HTTPS e `SEED_DEMO=true`. As rotas administrativas recusam transporte HTTP. Helmet ativa HSTS e upgrade de HTTPS em produção. Como o servidor Node atual serve HTTP, termine TLS num proxy **confiável em loopback**, configure `TRUST_PROXY=loopback`, repasse os headers corretos e bloqueie acesso externo direto à porta do Node. Não confie em headers de proxies arbitrários. Mantenha HTTPS de ponta a ponta até o navegador.

```sh
npm test
node --check server.js
find src scripts public/js tests -type f \( -name '*.js' -o -name '*.mjs' \) -exec node --check {} \;
git diff --check
git status --short
```

São **84 testes**, incluindo os 70 anteriores. Os novos usam hashes gerados durante o teste, bancos temporários próprios e HTTP real em portas efêmeras, sem ler `.env` ou modificar o banco da loja. Cobrem login válido/inválido, fixação, expiração/logout, rotas protegidas, tentativas excessivas e expiração do limite, CSRF/origem, categorias, centavos/promoção/estoque inválidos, persistência após reabertura, rollback de edição, inativos, proteção da API pública, configuração de produção/cookies/HSTS e erros sem detalhes sensíveis.

Antes de liberar a loja, faça a validação visual e de acessibilidade em navegador real: `/admin.html` em 320, 375, 768 e 1440 px; teclado/labels/foco; login inválido/válido; criação de categoria; cadastro com fotografia real; edição de cor/tamanho/estoque; desativação; atualização da vitrine; logout e expiração em outra aba. Os testes automatizados não substituem essa inspeção visual. O ambiente desta execução não disponibiliza navegador automatizado.

Prepare banco vazio com `SEED_DEMO=false` para dados reais, confira cada informação comercial e fotografia, remova referências demonstrativas da apresentação comercial, configure HTTPS/proxy, proteja `.env` e SQLite com permissões do sistema e valide backup/restauração com a aplicação parada. Adote monitoramento e proteção de login no proxy antes de expor o painel à internet. Sacola/WhatsApp continuam sem reserva, baixa ou confirmação de pedido no servidor; o atendimento deve conferir disponibilidade e valores. Nenhum teste envia mensagem ao WhatsApp.

## Painel mobile — MAISBELLA-007

O painel continua em **`/admin.html`**, com a autenticação e as rotas da etapa 006. Esta etapa altera somente a interface administrativa, acrescenta lógica de apresentação testável e não modifica backend, banco, migrations, credenciais ou páginas públicas. Não há nova dependência.

Após entrar, **Início** mostra seis contagens obtidas da API administrativa: produtos cadastrados, ativos, inativos, variações esgotadas, variações com estoque baixo e categorias. Os produtos demonstrativos são identificados separadamente e continuam incluídos nos totais; nenhuma informação financeira ou de pedidos é estimada. Ativo/inativo considera o status do produto. Uma categoria inativa ainda impede sua exibição pública, como antes.

A navegação tem quatro áreas, acessíveis por botões com indicação da área atual: **Início, Produtos, Estoque e Categorias**. No celular, fica na parte inferior, respeitando a área segura do dispositivo. No desktop, aparece abaixo do cabeçalho. O botão **Sair** fica no cabeçalho. A edição abre uma tela própria; “Voltar” ou “Cancelar edição” retorna à origem, preservando os filtros da listagem.

### Produtos e cadastro

A lista mostra nome, categoria, preço original/promoção, status, unidades em variações ativas e quantas estão esgotadas/com estoque baixo. Busca por nome ignora caixa e acentos e aceita várias palavras; combina com filtros por status e categoria. Há estados vazios e opção de limpar filtros.

“Editar” consulta o produto completo na API antes de abrir o formulário. “Ativar/Desativar” pede confirmação, consulta a versão atual e envia o mesmo PUT administrativo existente, preservando preços, imagens e todas as variações, inclusive inativas. Não cria endpoint novo. A desativação preserva o cadastro e o estoque.

O formulário é dividido em quatro seções recolhíveis: **Informações, Preços, Vitrine, Variações e estoque**. Ao detectar um campo obrigatório inválido, a seção correspondente abre para permitir o foco. O endereço (slug) é sugerido a partir do nome em cadastros novos; pode ser personalizado. Renomear um cadastro existente não muda seu endereço automaticamente.

O formulário mostra “Alterações não salvas”. Trocar de área, cancelar, abrir outra edição ou sair pede confirmação se houver mudanças. Fechar/recarregar a página usa a confirmação nativa do navegador quando disponível. Remover uma variação também pede confirmação; a remoção só persiste ao salvar. Erros de validação ou conexão mantêm os campos preenchidos. Durante operações, controles ficam temporariamente indisponíveis para evitar envios duplicados, com indicação de carregamento.

Se a sessão expirar com edição pendente, o painel solicita login e mantém o rascunho **somente na memória da página**, para continuar após autenticar. Não grava dados administrativos ou tokens em localStorage. Fechar/recarregar a página perde esse rascunho após a confirmação disponível no navegador; ele não é backup nem persistência offline. O logout confirmado limpa os dados do painel. As sessões continuam com prazo absoluto, sem renovação automática.

**Fotos:** o cadastro novo pode ser salvo sem conhecer caminhos de arquivos: usa uma ilustração explicitamente provisória, sem fingir que é fotografia do produto. Se a equipe já tiver preparado uma foto local, o campo opcional em Vitrine mantém a possibilidade de informá-la. Na edição, a galeria existente é preservada. Nenhum produto é criado automaticamente; os dados comerciais devem ser preenchidos pela proprietária. Upload e gerenciamento completo de fotos permanecem para outra etapa.

### Estoque e categorias

**Estoque baixo significa de 1 a 3 unidades por variação.** Zero é **Esgotado**; a partir de 4 é **Disponível**. O estoque é o mesmo SQLite já existente. Contagens e resumos consideram somente variações ativas, inclusive as de produtos inativos. A visualização de estoque permite incluir explicitamente as variações inativas; elas recebem identificação própria e não entram nos indicadores iniciais.

A tela mostra produto, cor, tamanho e quantidade, com busca e filtro por situação. “Editar estoque” abre diretamente a seção de variações do produto, onde a quantidade pode ser alterada e salva pela API protegida. Não há edição rápida paralela, nova regra de estoque, reserva de venda ou baixa automática por WhatsApp. O servidor continua validando os valores finais.

**Categorias** mostra status e quantidade de produtos vinculados, permite criar/editar em diálogo e ativar/desativar com confirmação. O aviso informa o efeito de ocultar produtos ao desativar uma categoria. Não há exclusão destrutiva. Os endereços de categorias novas também são sugeridos automaticamente; ordem e endereço ficam numa seção secundária.

### Verificação e validação manual no Termux

```sh
npm test
node --check server.js
find src scripts public/js tests -type f \( -name '*.js' -o -name '*.mjs' \) -exec node --check {} \;
git diff --check
git status --short
npm start
```

Use as credenciais privadas já configuradas na etapa 006. Não recrie `.env` nem credenciais existentes. Para outro dispositivo na rede local, mantenha `APP_ORIGIN` consistente com o endereço exato usado, conforme a configuração da etapa anterior. Em produção, continuam obrigatórios HTTPS e as demais proteções documentadas.

A suíte passa a ter **97 testes**: os 84 anteriores permanecem, mais 13 de apresentação administrativa, cobrindo contagens, limites do estoque baixo, filtros combinados, variações inativas, ausência de mutações, sugestões de slug, conversão monetária, contratos de cadastro/edição com os validadores reais, preservação de galeria/estoque na troca de status e detecção de alterações. Os testes anteriores continuam verificando login/logout, sessões, CSRF, rate limiting, autorização, persistência SQLite, API pública, sacola, favoritos e WhatsApp.

Validação manual pendente em navegador real, prioritariamente **360, 390 e 412 px**, além do desktop (por exemplo, 1280 px):

1. Entre com senha incorreta/correta, confira o carregamento e os indicadores; compare com os cadastros existentes, inclusive demonstrativos.
2. Navegue pelas quatro áreas. Confira navegação inferior no celular, ações de toque, foco visível com Tab/Shift+Tab e ausência de rolagem horizontal. No console do navegador, confira `document.documentElement.scrollWidth <= window.innerWidth`.
3. Em Produtos, combine nome, status e categoria; teste busca sem resultado e limpar filtros. Confira preço promocional e aviso de categoria inativa.
4. Abra uma edição, altere nome/quantidade e tente sair: cancele o descarte e confira os valores; depois confirme o descarte. Tente fechar/recarregar com mudanças e confira a proteção nativa.
5. Em banco separado de desenvolvimento, cadastre categoria e produto sem fotografia; confira a ilustração provisória, os campos obrigatórios em seções fechadas e a mensagem de sucesso. Edite, recarregue e confira persistência. Não faça experimentos no catálogo operacional.
6. Em Estoque, confira quantidades 0, 1, 3 e 4, filtre situações e inclua inativas. “Editar estoque” deve abrir a seção correta. Salve e confira a listagem.
7. Abra categorias pelo teclado; teste cancelar, Escape, mudanças pendentes, salvar e ativar/desativar. Confira avisos e preservação dos produtos.
8. Confira logout; em outra aba, teste sessão encerrada. Para expiração natural, mantenha uma edição pendente por 30 minutos: faça login novamente e confira a retomada sem gravação automática.
9. Teste falha de rede ao salvar (campos devem permanecer) e navegue pela vitrine, produto, favoritos, sacola e mensagem de WhatsApp. Nenhum teste automatizado envia mensagens.

Este ambiente não oferece navegador automatizado; os testes de lógica não comprovam layout, teclado virtual ou comportamento de leitores de tela. A conferência acima deve ocorrer antes de aprovar a etapa. Permanecem as limitações da etapa 006: processo único com sessões/limites em memória, última gravação em edições concorrentes, sem MFA, upload ou auditoria persistente. Não foram acrescentados pagamentos, checkout, pedidos, ERP ou integrações externas.

## Fotos dos produtos — MAISBELLA-008

A seção **Fotos** do cadastro/edição permite selecionar várias imagens da galeria do celular, conferir miniaturas, preencher uma descrição opcional, definir a principal e remover imagens. Não é necessário digitar caminhos. O painel mantém o visual e a navegação da etapa 007. As imagens anteriores, inclusive ilustrações demonstrativas, são preservadas ao adicionar fotos; escolha explicitamente a foto principal desejada. Não há reordenação por arraste: a ordem segue a galeria, com a principal apresentada primeiro na vitrine/página do produto.

As mudanças nas fotos participam da confirmação de alterações não salvas. Selecionar ou remover uma foto altera somente o rascunho até **Salvar produto**. A seleção gera prévias locais `blob:`, sem enviar os arquivos de imediato. Ao salvar, o painel envia uma foto de cada vez, mostra “Enviando foto X de Y” e só depois envia o cadastro completo. Falhas mantêm o formulário e a seleção em memória para tentar novamente. Cancelar/fechar a página descarta esse rascunho; os arquivos não são guardados em localStorage. Quando não há imagens, a ilustração provisória continua disponível. Galeria, catálogo, sacola e favoritos consomem o mesmo contrato anterior, agora aceitando também URLs geradas pelo upload.

### Formatos, limites e segurança

- **JPEG (`image/jpeg`), PNG (`image/png`) e WebP (`image/webp`) estáticos.** JPEG comum/progressivo de 8 bits é aceito. SVG, HTML, JavaScript, GIF, HEIC e animações não são recebidos. Exporte uma foto estática num formato aceito quando necessário.
- **5 MiB por arquivo** (5.242.880 bytes), **20 imagens por produto**, incluindo imagens existentes e ilustrações. Máximo de **40 megapixels**, com até **10.000 pixels por lado**. A validação final está no servidor; o navegador apenas antecipa mensagens simples.
- O servidor verifica assinatura, coerência do MIME e estrutura: chunks/CRC e encerramento PNG; marcadores, dimensões e encerramento JPEG; contêiner RIFF/chunks/dimensões WebP. Não confia no nome ou extensão enviados pelo cliente.
- Os nomes são gerados por `crypto.randomBytes(16)`, com extensão determinada pelo formato validado. Escritas usam criação exclusiva e referências estritas, sem caminhos fornecidos pelo usuário, sobrescrita de arquivos internos ou traversal.
- Upload exige sessão, origem exata e `X-CSRF-Token` antes de processar o corpo binário. A exceção ao formato JSON fica restrita ao endpoint de upload. As demais rotas mantêm JSON de até 16 KiB e as proteções existentes. Sem alteração de credenciais, expiração, cookies ou rate limiting de login.
- Há no máximo **duas requisições de upload simultâneas por processo** (excesso: 429) e **200 arquivos temporários pendentes** (excesso: 400 com orientação para liberar espaço). Com arquivos máximos, só os temporários podem ocupar cerca de 1 GiB; monitore capacidade do volume e configure limites de ingresso no proxy.
- Helmet e `nosniff` permanecem. A CSP acrescenta `blob:` apenas à diretiva de imagens, necessário às prévias locais; scripts, framing e demais restrições continuam iguais. Os arquivos publicados recebem MIME raster explícito.

**Não há nova dependência.** Cada `File` selecionado é enviado como corpo binário de uma requisição, com `Content-Type` correspondente. O `express.raw` já disponível trata o limite do corpo após a autenticação; não foi necessário introduzir multipart, Multer, addon nativo ou compilação no Termux.

### API e associação ao SQLite

| Método e rota | Comportamento |
| --- | --- |
| `POST /api/admin/images` | Autenticado; corpo binário de **uma foto**, sem multipart/base64. Headers `Origin`, `X-CSRF-Token` e `Content-Type` obrigatórios. Responde 201 `{ image: { id, type, src, alt } }` com referência temporária |
| `POST /api/admin/images?productId=ID` | Mesmo upload; na edição, verifica previamente se o produto existe (404 se não existir). Não associa nem publica a foto sozinho |
| `GET /uploads/products/:nome` | Leitura pública de raster publicado e ainda referenciado em `product_images`; temporários, diretórios e nomes fora do padrão retornam 404 |

A associação, remoção e troca da principal usam os **POST/PUT de produtos existentes**, com a lista final `images`. Não existe escrita pública nem endpoint separado para cadastrar administrador. A referência retornada pelo upload pode ser associada no cadastro novo ou na edição. O servidor recusa arquivos inexistentes/expirados, referências fabricadas, repetição da mesma foto e uso de arquivo já publicado por outro produto. O upload opcionalmente vinculado a um `productId` apenas verifica a existência; não constitui reserva exclusiva, pois esta versão tem uma única identidade administrativa autorizada.

Não houve migration: `product_images` já tem produto relacionado, ordem, `is_primary` e `alt`. O servidor exige uma principal e IDs únicos. O texto alternativo vem da descrição informada ou de “Foto de [nome da peça] — [número]”. Imagens antigas em `/assets/` e as ilustrações continuam compatíveis. A principal é retornada primeiro pelo repositório existente e usada nos cards; a página individual continua com miniaturas/controles para todas as imagens.

### Armazenamento, consistência e manutenção

Padrão local, fora de `public/`:

```text
data/uploads/
  .gitkeep       # única entrada versionada
  pending/       # fotos recebidas, ainda não publicadas
  products/      # fotos associadas/publicadas
```

Todo conteúdo de runtime desse diretório está ignorado pelo Git. `UPLOAD_DIR` é opcional: padrão `data/uploads`; outro caminho precisa ficar **fora do repositório**, por exemplo um volume persistente absoluto. Caminhos dentro de `public` e banco dentro do diretório de fotos são recusados. O servidor cria as subpastas quando necessário, com permissões restritas. `.env` real não foi modificado.

O salvamento valida o produto e, durante a transação SQLite existente, copia as fotos temporárias para os nomes finais com criação exclusiva. Se a preparação de alguma foto ou a gravação no banco falhar, desfaz as novas cópias e mantém os temporários para outra tentativa. Só depois do commit remove os temporários consumidos. A leitura pública verifica referência no banco, de forma que cópias órfãs de uma falha ou queda anterior ao commit não são servidas. Como disco e SQLite não formam uma transação distribuída, uma interrupção abrupta ainda pode deixar arquivos órfãos, sem publicação indevida.

Temporários expiram para associação após **24 horas**. Remover imagem da galeria elimina sua referência no commit; ela deixa de ser servida pela aplicação se nenhum produto a referenciar. A remoção física é posterior, por manutenção, evitando apagar arquivos antes da confirmação do banco. Cache do navegador de fotos já vistas pode permanecer por até uma hora.

Com a aplicação **parada**, consulte arquivos temporários/órfãos com mais de 24 horas:

```sh
npm run media:cleanup
# Depois de conferir o contador e com o servidor ainda parado:
npm run media:cleanup -- --apply
```

Sem `--apply`, o comando apenas conta candidatos. Com `--apply`, remove somente nomes gerados pelo sistema, antigos e não referenciados (ou temporários expirados). Nunca remove fotos publicadas ainda referenciadas. Essa manutenção não é executada automaticamente no startup nem nesta tarefa. Arquivos pendentes abandonados contam para a quota até serem limpos. Faça **backup conjunto do SQLite e de UPLOAD_DIR**, com a aplicação e comandos de escrita parados; confira uma restauração antes do uso comercial.

### Testes e conferência no celular

```sh
npm test
node --check server.js
find src scripts public/js tests -type f \( -name '*.js' -o -name '*.mjs' \) -exec node --check {} \;
git diff --check
git status --short
npm start
```

Reinicie o servidor para carregar as novas rotas e a CSP. Use as credenciais existentes, sem recriar `.env`. A suíte tem **120 testes aprovados**: os 97 anteriores e 23 novos, com banco e arquivos temporários próprios, removidos ao final. Cobre upload sem sessão/CSRF/origem correta, formatos/assinaturas inválidos, corrupção/truncamento, tamanho e resolução, JPEG/PNG/WebP aceitos, nomes seguros, publicação somente após associação, produto inexistente, várias imagens, principal, remoção, limite de quantidade, referências falsas, rollback de banco/arquivos, expiração, quota e limpeza segura. A lógica do navegador cobre seleção, limites, preservação das anteriores, principal/remoção, texto alternativo, contrato e alterações no rascunho. Nenhum teste lê o banco da loja ou envia WhatsApp.

Validação manual pendente em Android, mantendo o roteiro responsivo anterior:

1. Entre em `/admin.html` e abra um cadastro novo. Em **Fotos → Adicionar fotos**, selecione dois JPEG/PNG/WebP pela galeria. Confira miniaturas, principal e descrição opcional; salve num banco de desenvolvimento e recarregue.
2. Confira a imagem principal nos cards e todas as fotos na página do produto. Adicione à sacola e confira a revisão/WhatsApp sem enviar a mensagem.
3. Edite o mesmo produto, adicione outra foto e confirme que as anteriores permanecem. Troque a principal, remova uma foto e salve; confira persistência após recarregar.
4. Cancele uma edição com mudanças na galeria: confira a confirmação e que a galeria anterior permanece no produto.
5. Tente formato não aceito, foto maior que 5 MiB e quantidade superior a 20; confira mensagens legíveis. Simule falha de rede ao salvar e confira que a seleção/edição permanece na página.
6. Confira celular em 320–430 px, botões, labels, foco, ausência de overflow e expiração/logout. O ambiente desta execução não tem navegador automatizado; testes de lógica não substituem a seleção nativa e a revisão visual real.

### Limitações para hospedagem futura

A primeira implantação exige **processo único e disco persistente**. Hospedagem com filesystem efêmero perderá as fotos em reinícios/deploys; réplicas sem volume compartilhado também não atendem esta arquitetura. Nenhum serviço externo foi integrado. Ao escolher a hospedagem, provisione um volume com backup ou migre `MediaService` para armazenamento de objetos, mantendo/adaptando as referências e a leitura pública.

Esta versão valida assinatura/estrutura, mas **não faz decodificação completa, reencode, redução automática, thumbnails físicos, antivírus nem remoção de EXIF/metadados**. Não equivale a uma inspeção completa dos pixels; imagens exóticas ou corrompidas além dos cabeçalhos ainda podem falhar na exibição. Arquivos originais e suas dimensões/metadados são preservados. A otimização e normalização poderão ser tratadas depois conforme necessidade real e compatibilidade do runtime. As limitações de concorrência/última gravação da etapa 006 permanecem. Sem pagamentos, frete, pedidos persistentes ou gerenciador complexo de mídia.

## Compra pelo WhatsApp — MAISBELLA-009

Fluxo atual: **vitrine → produto → cor/tamanho em estoque → quantidade → adicionar à sacola → revisar sacola → dados básicos → Finalizar pelo WhatsApp**. A conversa abre com a mensagem pronta; a cliente ainda precisa revisar e enviar dentro do WhatsApp. A loja não registra pedido, pagamento, reserva ou baixa de estoque automaticamente. Painel administrativo, SQLite, autenticação, CSRF e upload permanecem sem alterações nesta etapa.

### Produto e sacola

A galeria mantém a foto principal retornada primeiro pela API e as demais fotos com miniaturas. A página mostra preço original/promoção, descrição e estoque da combinação de cor/tamanho. Características com **uma única opção em estoque** são preenchidas automaticamente; havendo mais de uma opção válida, a cliente escolhe. Variações inativas ou esgotadas não podem ser adicionadas; a mensagem de esgotamento é “Essa opção está esgotada.” Quantidade e adições repetidas respeitam o estoque disponível para aquela combinação, incluindo o que já está na sacola.

Depois de adicionar, **Revisar sacola e finalizar** leva diretamente à página da sacola. A sacola lateral do cabeçalho continua disponível. A revisão mostra foto, nome, cor, tamanho, quantidade, preço unitário e subtotal por item, com aumento/diminuição, remoção e link para continuar comprando. O resumo mostra **Subtotal dos produtos**; não calcula frete. Entrega, retirada e pagamento serão combinados pelo WhatsApp.

O subtotal soma centavos. IDs, preços, imagens e variações são recompostos a partir do catálogo, sem confiar em preços ou imagens adulterados no localStorage. A chave `maisbella:cart:v1` e os favoritos existentes foram preservados. Se o armazenamento estiver indisponível, a sacola usa memória durante a visita.

### Conferência antes de abrir a conversa

Com os dados obrigatórios válidos, o botão consulta novamente **GET `/api/products` e GET `/api/categories`**, sem cache e sem enviar dados pessoais. A sacola é então reconciliada com o catálogo atualizado:

- quantidade acima do estoque é ajustada ao limite e comunicada;
- itens desativados, removidos ou sem aquela variação disponível são retirados com aviso;
- preços alterados são atualizados e comunicados;
- alterações de quantidade detectadas em outra aba também pedem revisão.

Quando há ajuste, **o WhatsApp não abre nessa tentativa**. A cliente vê o aviso, revisa a sacola e toca novamente para confirmar. Se a API falhar, a conversa também não abre e a sacola é mantida para tentar depois. Durante a conferência, há indicação de carregamento e prevenção de envio duplicado. Nenhuma chamada de escrita é feita ao backend para finalizar a compra.

Essa conferência **não é reserva nem garantia de concorrência**: outra venda pode ocorrer depois da leitura. A proprietária deve confirmar disponibilidade, condições, entrega e pagamento no atendimento. Mensagens preparadas fora da loja também podem ser editadas pela cliente; o atendimento precisa conferir seus valores antes de concluir a venda.

### Dados e mensagem

Campos obrigatórios: **nome, WhatsApp/telefone com DDD, cidade, bairro e entrega/retirada**. A observação de entrega já existente continua opcional e é removida ao escolher retirada. Não são pedidos CPF, cartão ou endereço completo.

A mensagem contém **MEU PEDIDO**, itens numerados com cor/tamanho/quantidade/valor unitário/subtotal, subtotal dos produtos, **DADOS**, **RECEBIMENTO** e a solicitação de confirmação. O link usa `encodeURIComponent`, preservando acentos, símbolos e quebras de linha. O único número comercial permanece em **`public/js/config.mjs`**; ele não foi alterado nem duplicado. Se a configuração estiver vazia/inválida, finalização e atalhos continuam bloqueados com explicação.

Dados do formulário ficam somente na memória/campos desta visita. Não vão ao SQLite, API, localStorage ou logs. Ao abrir o WhatsApp, passam a integrar a URL/mensagem solicitada pela cliente. O formulário é limpo ao sair da página, inclusive com BFCache; uma conferência pendente não provoca navegação automática ao retornar. A sacola não é esvaziada ao abrir a conversa, pois a aplicação não sabe se a mensagem foi enviada.

### Produtos reais e demonstração

O campo confiável é **`demo` do SQLite/API**, não nome, fotografia, ID ou informação salva na sacola. Produtos criados pelo painel são operacionais (`demo=false`); o seed mantém seus produtos com `demo=true`. O indicador de demonstração existente é preservado na edição.

Para produtos reais, cards/página/sacola/mensagem não apresentam preços fictícios, rótulo “demo”, promessa de fotos futuras ou parcelamento inventado. Pagamento é combinado no WhatsApp. Sem medidas oficiais cadastradas, o produto real oferece consultar medidas pelo WhatsApp, sem apresentar a tabela fictícia como referência comercial. Uma ilustração provisória continua identificada como ilustração quando ainda não há foto, independentemente de o produto ser real.

Produtos `demo=true` continuam claramente marcados nos cards, página, sacola e mensagem. Um catálogo misto mostra aviso geral e distingue os itens; um pedido só com produtos reais não é chamado de demonstrativo. Os avisos globais de demonstração ficam ocultos quando não há produtos demonstrativos ativos. Os seeds não foram apagados nem executados no banco da loja nesta etapa.

**Antes de produção:** no painel, desative individualmente os produtos identificados como **Demonstração**, sem desativar categorias compartilhadas com produtos reais. Confira que eles sumiram da API/vitrine. Configure `NODE_ENV=production` e `SEED_DEMO=false`; isso impede seed automático, mas **não remove nem desativa os produtos já gravados**. Para uma implantação nova, use banco operacional vazio e cadastre informações/fotos verificadas. Revise preços, estoque, condições de atendimento e demais textos comerciais antes de liberar a loja. Não converta os produtos fictícios em reais apenas trocando fotografia ou nome.

### Testes e validação manual

```sh
npm test
node --check server.js
find src scripts public/js tests -type f \( -name '*.js' -o -name '*.mjs' \) -exec node --check {} \;
git diff --check
git status --short
npm start
```

São **135 testes**: os 120 anteriores, com expectativas de mensagem ajustadas ao novo texto e fixture explicitamente demonstrativa, mais 15 novos casos. Os novos cobrem produto real/misto, opção única, esgotamento/inativos, estoque e preço alterados, indisponibilidade da API, fallback em memória, mudanças entre abas, avisos de demonstração e fluxo HTTP/SQLite real até a mensagem. A integração confirma que as consultas não enviam dados pessoais nem reservam estoque. Testes usam dados sintéticos e SQLite em memória/arquivos temporários próprios; não leem o banco operacional nem contatam o WhatsApp.

A validação visual em navegador real permanece necessária. Confira em Android, especialmente **360, 390 e 412 px**:

1. Produto real com fotos: principal, miniaturas, promoção, descrição, medidas por contato e ausência de avisos demonstrativos indevidos.
2. Uma única cor/tamanho em estoque deve ficar selecionada; várias opções exigem escolha. Esgotados devem ficar indisponíveis. Adicione até o limite e tente ultrapassá-lo.
3. Use “Revisar sacola e finalizar”. Confira fotos, preço unitário, subtotais, +/−, remoção, estado vazio e continuar comprando.
4. Tente finalizar sem nome/telefone/cidade/bairro/recebimento; confira mensagens acessíveis. Alterne entrega/retirada e confira a observação opcional.
5. Num banco de desenvolvimento, altere estoque ou preço pelo painel após adicionar à sacola. Na finalização, confira o aviso e que a conversa só pode abrir após nova revisão. Simule API offline e confirme o bloqueio sem perder a sacola.
6. Confira a mensagem com acentos/símbolos, dados e subtotal. Abrir a conversa é suficiente para validar; não é necessário enviar o pedido. Volte ao navegador e confirme que os campos pessoais foram limpos.
7. Role continuamente: o botão verde deve continuar fixo, sem piscar/desaparecer. Confira espaço das ações principais, teclado virtual, foco por Tab, conforto de toque e ausência de overflow horizontal (`document.documentElement.scrollWidth <= window.innerWidth`).
8. Em ambiente de teste isolado, confira o cenário sem número configurado. Não altere o contato oficial da loja para executar testes automatizados.

Nenhum novo endpoint, dependência, conta de cliente, checkout, gateway, Pix automático, frete automático ou painel/histórico de pedidos foi implementado. O navegador automatizado não está disponível neste ambiente; as conferências acima aguardam validação manual.
