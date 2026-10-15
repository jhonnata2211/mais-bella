# Auditoria de conteúdo — MAISBELLA-010

Busca em todos os arquivos de texto versionados e novos desta revisão (incluindo comentários e nomes de classes); excluídos lockfile gerado, binários e dados privados. Termos: demo, demonstrativo, fictício, teste/test, localhost, fotografias oficiais, incluídas futuramente, dados de exemplo e stack trace. Não foram lidas credenciais. Linhas referem-se a esta revisão; classes como `demo-note` também entram na busca e não são, por si só, texto visível.

## A) Conteúdo interno necessário para desenvolvimento/testes

| Arquivo | Linhas com ocorrências |
| --- | --- |
| `scripts/production-cleanup.js` | 2, 5, 7, 9, 11 |
| `src/services/production-maintenance.js` | 14, 16, 20, 21, 24, 25, 72 |
| `tests/production.test.mjs` | 1, 8, 15, 19, 20, 21, 28, 49, 50, 51, 52, 56, 57, 61, 62, 63, 64, 65, 67, 71, 76, 87, 94, 100, 126, 131, 132, 133, 137, 139, 141, 143, 146, 149, 150, 159, 160, 186, 193, 197, 199 |
| `package.json` | 8 |
| `scripts/configure-admin.js` | 21, 27 |
| `scripts/seed.js` | 2, 7, 9 |
| `server.js` | 3, 12, 19 |
| `src/app.js` | 34 |
| `src/config.js` | 12, 18, 26, 28, 30, 33 |
| `src/db/database.js` | 24 |
| `src/db/migrations/001_catalog.sql` | 24, 56 |
| `src/repositories/catalog-repository.js` | 13, 16, 57 |
| `src/services/admin-service.js` | 19, 34 |
| `src/services/media-service.js` | 15, 55 |
| `src/services/password.js` | 5 |
| `src/services/validation.js` | 6, 11, 41, 52, 53 |
| `tests/admin-ui.test.mjs` | 1, 8, 17, 22, 25, 26, 27, 29, 35, 40, 49, 60, 65, 72, 77, 81, 83, 89, 93, 94, 96, 102 |
| `tests/admin.test.mjs` | 1, 13, 15, 32, 34, 35, 47, 52, 56, 62, 70, 73, 74, 86, 98, 104, 109, 110, 111, 116, 117, 121, 128, 130, 133 |
| `tests/backend.test.mjs` | 1, 7, 10, 18, 19, 23, 36, 43, 56, 58, 63, 71, 75, 80, 92, 97, 110, 121, 128, 140, 147, 155, 169, 180, 190, 199, 213, 223, 233, 249, 256, 259, 261, 262 |
| `tests/catalog-api-client.test.mjs` | 1, 12, 20, 25, 42, 55, 65 |
| `tests/catalog.test.mjs` | 1, 10, 30, 35, 43, 50, 56, 64, 73, 80, 90, 99, 106, 111, 126, 131, 136 |
| `tests/commerce-flow.test.mjs` | 1, 5, 18, 19, 22, 34, 37, 38, 41, 49, 54, 58, 59, 60, 61, 62, 63, 65, 67, 68, 69, 71, 76, 82, 88, 95, 100, 105, 111, 119, 125, 137, 148, 150, 151, 152, 153, 157 |
| `tests/gallery.test.mjs` | 1, 14, 23, 28, 34, 40, 46, 51 |
| `tests/helpers/catalog-fixture.mjs` | 1, 2, 4 |
| `tests/helpers/image-fixture.mjs` | 6 |
| `tests/media.test.mjs` | 1, 16, 21, 30, 38, 44, 47, 56, 64, 73, 83, 89, 103, 116, 123, 130, 137, 141, 147, 153, 165, 171 |
| `tests/product-cart.test.mjs` | 1, 9, 12, 20, 26, 35, 41, 53, 64, 72, 81, 92, 104, 117, 121, 137, 156 |
| `tests/whatsapp-floating.test.mjs` | 1, 43, 58, 62 |
| `tests/whatsapp-order.test.mjs` | 1, 10, 13, 19, 25, 30, 33, 38, 49, 55, 67, 74, 79, 91, 100, 101, 102, 104, 107, 111, 123, 137 |

## B) Conteúdo que pode aparecer na interface ou participa de sua renderização

| Arquivo | Linhas com ocorrências |
| --- | --- |
| `public/admin.html` | 47, 71 |
| `public/catalogo.html` | 35, 54 |
| `public/css/style.css` | 4, 29, 79, 204 |
| `public/index.html` | 42, 44, 46 |
| `public/js/admin-model.mjs` | 26, 46 |
| `public/js/admin.mjs` | 174, 175, 188, 216, 350 |
| `public/js/app.js` | 13, 14 |
| `public/js/cart-page.mjs` | 2, 48 |
| `public/js/cart-panel.mjs` | 2, 15, 21, 34, 36, 46 |
| `public/js/catalog.mjs` | 1 |
| `public/js/commerce.mjs` | 2, 3, 4, 5, 6 |
| `public/js/product-page.mjs` | 1, 25, 26, 42, 44, 65, 110, 153 |
| `public/js/products.mjs` | 1, 17, 26, 34, 39, 40 |
| `public/js/whatsapp.mjs` | 1, 10, 19, 64, 66, 69 |
| `public/produto.html` | 39, 46, 57, 64, 65 |
| `public/sacola.html` | 31, 36 |

## C) Seed e dados demonstrativos

| Arquivo | Linhas com ocorrências |
| --- | --- |
| `src/db/seed-products.mjs` | 1, 4, 14, 24, 34, 44, 54, 64, 74, 84, 94, 104, 114, 124 |
| `src/db/seed.js` | 4, 6, 24, 26, 34 |

## D) Documentação

| Arquivo | Linhas com ocorrências |
| --- | --- |
| `.env.example` | 4, 6, 8, 13, 20 |
| `README.md` | 7, 9, 21, 29, 33, 34, 35, 36, 44, 85, 89, 90, 91, 92, 93, 94, 95, 116, 118, 120, 127, 130, 142, 143, 147, 151, 159, 161, 163, 165, 170, 174, 175, 176, 204, 210, 216, 218, 221, 224, 240, 243, 255, 256, 263, 264, 267, 272, 273, 289, 290, 291, 292, 293, 306, 308, 310, 316, 318, 328, 352, 354, 392, 398, 401, 408, 410, 412, 416, 418, 447, 457, 461, 463, 467, 468, 469, 471, 475, 530, 533, 541, 550, 591, 593, 595, 597, 599, 601, 604, 612, 616, 623, 629, 635, 643, 653, 654, 657, 663, 672, 676, 717, 722, 734, 745 |

## Decisões e verificação

- A: fixtures e senhas sintéticas de testes permanecem. localhost só documenta execução local, testes e configuração de desenvolvimento. Não há logs de payload, senha, hash, cookie, token CSRF ou dados pessoais. Logs inesperados usam campos limitados de operação/categoria de erro.
- B: avisos, preços e estoque fictícios dependem da marca booleana demo do catálogo. Produtos reais não recebem esses textos. O guia fictício não é aberto para produto real; no lugar, o contato pede medidas pelo WhatsApp. Ilustração provisória de produto real é identificada honestamente, sem promessa de fotografia futura.
- B: a newsletter não tem serviço de inscrição e era uma funcionalidade demonstrativa visível em toda visita. Agora começa oculta e só aparece fora de produção. Falha ao consultar configuração mantém o bloco oculto. O design dos demais blocos é preservado.
- B: catálogo e home vazios mostram “Novidades chegando em breve ♡”; busca/categoria sem resultados mantêm orientação para alterar filtros. Produto inexistente e sacola vazia já têm estados próprios. Cards editoriais e ilustrações decorativas da marca não são produtos e foram preservados.
- C: src/db/seed-products.mjs é a fonte única do seed/testes; não é servida pelo Express. Dados atuais não foram removidos. Seed exige SEED_DEMO=true explícito e é recusado em produção, inclusive pelo comando db:seed.
- C: o banco local foi inspecionado somente em modo readOnly: 12 produtos demo ativos, 13 ilustrações e 2 referências de fotos. A limpeza real não foi executada. Categorias não têm marca demo: o cleanup as preserva e elas podem ser desativadas no painel.
- D: o README mantém histórico das etapas; instruções operacionais atuais são as da seção MAISBELLA-010. Referências anteriores a seed automático foram corrigidas.
- Segurança: o HTML público do login não contém dados administrativos; APIs exigem sessão. Nenhuma rota pública de escrita foi criada. Recursos internos, banco e .env não são servidos.

A auditoria não substitui conferir o conteúdo editorial real antes da entrega. Antes de publicar, rode o dry-run, revise os produtos marcados e os avisos; não reaproveite um cadastro demo como produto real (cadastre uma peça nova no painel).
