# Mais Bella

Loja de moda feminina com identidade de boutique: blush, rosa queimado, nude e off-white, títulos serifados e textos modernos.

**MAISBELLA-001 — concluído:** primeira versão visual responsiva da home, com navegação, hero ilustrado, categorias, novidades, banner da marca, mais vendidos, benefícios, newsletter e rodapé.

## Instalar

Pré-requisito: Node.js 20 ou superior e npm.

```sh
npm install
```

## Executar

```sh
npm start
```

Abra **http://localhost:3000** no navegador. Para outra porta:

```sh
PORT=4000 npm start
```

O servidor Express serve apenas a pasta `public` e usa `process.env.PORT || 3000`.

## Estrutura

```text
public/
  index.html       # Estrutura semântica da home
  css/style.css    # Identidade visual, ilustrações e responsividade
  js/app.js        # Produtos fictícios e interações locais
  assets/         # Reservado para futuras fotografias e arquivos da marca
src/
  routes/         # Reservado para etapas futuras
  controllers/
  services/
data/
tests/
server.js
package.json
```

## Validar no navegador

- Experimente larguras de 320, 375, 430, 768, 1024 e 1440 px nas ferramentas de desenvolvimento. Confira ausência de rolagem horizontal e legibilidade dos cards.
- No celular, abra e feche o menu; selecione uma categoria. `Esc` fecha menu/pesquisa e devolve o foco ao botão.
- Pesquise por `vestido`, `calça` ou um termo inexistente. Use “Ver todas as peças” para limpar filtros.
- Adicione/remova favoritos nas duas vitrines; abra os favoritos no header e confira a sincronização.
- Adicione peças à sacola e confira o contador. O botão da sacola informa a quantidade demonstrativa.
- Envie um e-mail válido na newsletter e confirme a mensagem de demonstração; nenhum dado é armazenado ou enviado.
- Navegue com Tab e Enter para conferir os controles, o foco visível e o link “Pular para o conteúdo”.
- Para abrir em outro dispositivo na mesma rede, use `http://IP-DO-SERVIDOR:3000`, com a porta acessível na rede local.

## Limites desta etapa

Produtos, preços, parcelamento, promoções e a seleção de mais vendidos são fictícios. Os benefícios e as formas de pagamento são apresentação visual do serviço previsto. Sacola e favoritos permanecem apenas na memória da página e são zerados ao recarregar. Pesquisa e categorias filtram a vitrine de novidades.

Não há autenticação, banco de dados, pagamentos, checkout, coleta de e-mails ou integração social. Os controles institucionais exibem informações demonstrativas. As ilustrações são feitas em CSS e não dependem de imagens externas. Google Fonts é opcional: fontes locais de fallback mantêm a página funcional sem conexão. A preferência por movimento reduzido é respeitada.

Nenhuma credencial é necessária. `.env` e `node_modules` estão ignorados pelo Git.
