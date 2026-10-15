# Mais Bella

Loja de moda feminina com identidade de boutique: blush, rosa queimado, nude e off-white, títulos serifados e textos modernos.

**MAISBELLA-001 — concluído:** primeira versão visual responsiva da Home, com navegação, hero ilustrado, categorias, novidades, banner da marca, mais vendidos, benefícios, newsletter e rodapé.

**MAISBELLA-002 — catálogo estruturado:** fonte local com 12 produtos fictícios, cards reutilizáveis, catálogo com filtros combináveis e ordenação, busca em nome/categoria/descrições e favoritos por ID persistidos no navegador. A identidade e as seções da Home foram preservadas. Nenhum banco de dados ou framework frontend foi adicionado.

**MAISBELLA-003 — página individual e sacola local:** produto por slug ou ID, galeria local com miniaturas, cores/tamanhos derivados dos dados, estoque fictício por variação, quantidade limitada e guia de medidas demonstrativo em modal. A sacola persiste localmente, tem painel no header e página de revisão, sem checkout. Home e catálogo continuam com sua identidade original.

**MAISBELLA-004 — sacola e pedido pelo WhatsApp:** revisão com aumento/diminuição de quantidades, formulário temporário de atendimento, entrega/retirada e mensagem estruturada. O número comercial ainda não foi informado: a configuração permanece vazia, a finalização fica desabilitada e atalhos de contato exibem uma explicação sem abrir conversa.

## Instalar e executar

Pré-requisito: Node.js 20 ou superior e npm. Use um navegador moderno com suporte a módulos JavaScript e ao elemento nativo `<dialog>`.

```sh
npm install
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

O servidor Express serve apenas `public` e usa `process.env.PORT || 3000`. Abra as páginas pelo servidor, evitando `file://`, pois elas carregam módulos JavaScript.

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
    data/products.mjs      # Fonte única dos 12 produtos fictícios
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
  routes/                  # Reservado para etapas futuras
  controllers/
  services/
data/
tests/
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

A fonte é `public/js/data/products.mjs`, compartilhada pela Home, catálogo, produto e sacola. Atualize esse arquivo para editar os dados demonstrativos. IDs antigos foram preservados. As ilustrações usam as formas CSS existentes; o card também suporta uma imagem local com `{ type: 'image', src: '/assets/arquivo.webp', alt: 'Descrição' }`.

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
find public/js tests -name '*.mjs' -exec node --check {} \;
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

Edite **apenas `public/js/config.mjs`**, propriedade `storeConfig.whatsappNumber`. O valor atual é intencionalmente vazio:

```js
export const storeConfig = Object.freeze({
  whatsappNumber: ''
});
```

Quando o número oficial da Mais Bella for confirmado, substitua a string vazia pelo número comercial completo, com código do país, DDD e número, usando apenas dígitos. Não inclua +, espaços, parênteses, hífens ou prefixo de discagem. Não é necessário editar outros arquivos. Recarregue as páginas após a alteração.

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
3. Com a configuração atual vazia, confirme que o botão de finalização está desabilitado e que os atalhos de WhatsApp nas quatro páginas não abrem conversa.
4. Alterne entrega/retirada e confira campo opcional, explicações e remoção da observação de entrega ao escolher retirada. Preencha dados temporários, recarregue e confira que o formulário foi limpo, mantendo a sacola.
5. Quando o número oficial estiver disponível e configurado, tente finalizar sem dados ou com telefone inválido: devem aparecer resumo de erros, mensagens junto aos campos e `aria-invalid`. Preencha os dados válidos e confira no WhatsApp os itens, variações, quantidades e total, antes de decidir enviar.
6. Teste nomes/cidades com acentos e & e observações com símbolos. Os testes automatizados conferem ida e volta da codificação sem contato externo.
7. Verifique em **320, 375, 768 e 1440 px**: formulário, controles de quantidade, subtotal, botões e atalho legíveis; sem overflow horizontal ou controles encobertos. Confira teclado e feedback acessível em navegador real. No Android/Chrome, role continuamente nas quatro páginas, passando por hero, cards, formulário e rodapé: o círculo deve permanecer fixo, sem piscar. Ao abrir/fechar um modal, confirme a ocultação intencional e o retorno do atalho.

O envio real não foi validado porque o número oficial ainda não foi fornecido. Disponibilidade, frete, entrega e pagamento dependem de confirmação humana no atendimento. A conferência visual em navegador real continua necessária.

## Limitações desta etapa

Produtos, preços, parcelamento, promoções, datas, estoques e a seleção de mais vendidos são fictícios. Benefícios e pagamentos são apresentação visual do serviço previsto. Não há produtos disponíveis para compra.

Favoritos guardam apenas IDs na chave `maisbella:favorites:v1` do `localStorage`, com sincronização entre abas da mesma origem e fallback em memória. Não há conta ou sincronização entre dispositivos. A sacola guarda apenas itens demonstrativos na chave `maisbella:cart:v1` do mesmo armazenamento; quando o armazenamento estiver bloqueado, há feedback e fallback em memória apenas na página atual.

A página individual usa `/produto.html?slug=slug` e também aceita `?id=id`. O destino fica centralizado em `productURL`. URLs antigas com `/catalogo.html?produto=slug` redirecionam para a nova página pelo JavaScript. Produto inexistente ou inativo mostra “Produto não encontrado” e retorno ao catálogo.

Não há banco de dados, autenticação, painel administrativo, pagamento, checkout, cálculo de frete ou coleta de e-mails. WhatsApp utiliza apenas o link público oficial, sem API ou envio automático. JavaScript é necessário para renderizar vitrines, filtros, produto e sacola. O limite de estoque é uma validação local demonstrativa; não existe validação comercial no servidor. Google Fonts é opcional: fontes de fallback mantêm o layout funcional sem conexão; as ilustrações não dependem de imagens externas. A preferência por movimento reduzido é respeitada.

Nenhuma credencial é necessária. `.env` e `node_modules` estão ignorados pelo Git.
