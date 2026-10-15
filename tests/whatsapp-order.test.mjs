import test from 'node:test';
import assert from 'node:assert/strict';
import { storeConfig } from '../public/js/config.mjs';
import { products } from './helpers/catalog-fixture.mjs';
import { addItem, cartCount, cartSubtotal, createCartStore, itemKey, updateItemQuantity } from '../public/js/cart.mjs';
import { generateOrderMessage, isCustomerPhoneValid, isStoreNumberValid, normalizeOrderDetails, prepareWhatsAppOrder, productQuestion, validateOrder, whatsappLink } from '../public/js/whatsapp.mjs';
import { money } from '../public/js/products.mjs';
import { cartContent } from '../public/js/cart-panel.mjs';

// Dígitos sintéticos apenas para teste de formato. Nunca configurados na loja ou acionados.
const formatOnlyNumber = '1'.repeat(11);
const initialConfiguration = storeConfig.whatsappNumber;
const details = { name: 'Cliente de teste', phone: '12345'.repeat(2) + '6', city: 'Cidade de teste', neighborhood: 'Bairro de teste', receiving: 'delivery', deliveryNote: 'Observação de teste' };
const product = products[0];
const selection = { color: 'Rosa queimado', size: 'M' };
const cart = () => addItem([], product, selection, 2).items;

// A suíte não altera a configuração real; cenários vazios recebem a string vazia explicitamente.
test('WhatsApp comercial não configurado bloqueia links e finalização', () => {
  assert.equal(whatsappLink('Olá!', ''), null);
  assert.equal(prepareWhatsAppOrder(cart(), details, '').ok, false);
  assert.ok(validateOrder(cart(), details, { number: '' }).errors.whatsapp);
});

test('validação de formato comercial só aceita dígitos internacionais e limite de comprimento', () => {
  assert.equal(isStoreNumberValid(formatOnlyNumber), true);
  for (const value of ['', null, undefined, '0'.repeat(11), '+' + formatOnlyNumber, '123', '1'.repeat(16), 'https://wa.me/', '  ' + formatOnlyNumber]) assert.equal(isStoreNumberValid(value), false);
});

test('mensagem usa dados numéricos da sacola e contém pedido, cliente e recebimento', () => {
  const items = cart();
  const message = generateOrderMessage(items, details);
  for (const text of ['Mais Bella ♡', 'PEDIDO', 'DEMONSTRATIVO', product.name, 'Cor: Rosa queimado', 'Tamanho: M', 'Quantidade: 2', `Valor unitário: ${money(189.90)}`, `Subtotal: ${money(379.80)}`, `Total dos produtos: ${money(379.80)}`, 'DADOS', details.name, details.phone, details.city, details.neighborhood, 'RECEBIMENTO', 'Entrega', details.deliveryNote, 'confirmar a disponibilidade, entrega e forma de pagamento']) assert.ok(message.includes(text), text);
  assert.equal(cartCount(items), 2);
  assert.equal(cartSubtotal(items), 379.80);
});

test('variações diferentes permanecem em linhas distintas e total/quantidade correspondem', () => {
  const items = addItem(cart(), product, { color: 'Nude', size: 'M' }, 1).items;
  const message = generateOrderMessage(items, details);
  assert.ok(message.includes(`1. ${product.name}`));
  assert.ok(message.includes(`2. ${product.name}`));
  assert.ok(message.includes('Cor: Rosa queimado'));
  assert.ok(message.includes('Cor: Nude'));
  assert.ok(message.includes('Quantidade total: 3'));
  assert.ok(message.includes(`Total dos produtos: ${money(569.70)}`));
});

test('retirada não inclui observação de entrega e informa local/horário a combinar', () => {
  const message = generateOrderMessage(cart(), { ...details, receiving: 'pickup' });
  assert.ok(message.includes('Retirada — local e horário a combinar pelo WhatsApp.'));
  assert.ok(!message.includes('Observação:'));
});

test('campos obrigatórios, telefone e forma de recebimento são validados', () => {
  assert.equal(validateOrder(cart(), details, { number: formatOnlyNumber }).ok, true);
  const invalid = validateOrder(cart(), {}, { number: formatOnlyNumber });
  for (const key of ['name', 'phone', 'city', 'neighborhood', 'receiving']) assert.ok(invalid.errors[key], key);
  for (const phone of ['abc', '123', '9'.repeat(11), '1234567890123456', 'tel:12345678901']) assert.equal(isCustomerPhoneValid(phone), false);
  assert.equal(isCustomerPhoneValid('(' + details.phone.slice(0, 2) + ') ' + details.phone.slice(2)), true);
  assert.ok(validateOrder(cart(), { ...details, receiving: 'outro' }, { number: formatOnlyNumber }).errors.receiving);
  assert.ok(validateOrder(cart(), { ...details, name: ' ' }, { number: formatOnlyNumber }).errors.name);
  assert.ok(validateOrder(cart(), { ...details, city: 'x'.repeat(81) }, { number: formatOnlyNumber }).errors.city);
  assert.ok(validateOrder(cart(), { ...details, deliveryNote: 'x'.repeat(501) }, { number: formatOnlyNumber }).errors.deliveryNote);
});

test('sacola vazia e itens inválidos/alterados não geram pedido', () => {
  assert.ok(validateOrder([], details, { number: formatOnlyNumber }).errors.cart);
  for (const item of [null, { ...cart()[0], quantity: 0 }, { ...cart()[0], quantity: undefined }, { ...cart()[0], quantity: 1.5 }, { ...cart()[0], quantity: 6 }, { ...cart()[0], price: 0.01 }, { ...cart()[0], color: 'Cor inexistente' }, { ...cart()[0], name: '<div>Preço falso</div>' }]) assert.ok(validateOrder([item], details, { number: formatOnlyNumber }).errors.cart);
  assert.throws(() => generateOrderMessage([], details), /Revise/);
  assert.equal(prepareWhatsAppOrder([], details, formatOnlyNumber).ok, false);
});

test('duplicatas não podem somar quantidade acima do estoque na finalização', () => {
  const item = cart()[0];
  assert.ok(validateOrder([{ ...item, quantity: 3 }, { ...item, quantity: 3 }], details, { number: formatOnlyNumber }).errors.cart);
});

test('link oficial codifica mensagem com acentos, emojis, &, +, %, # e quebras de linha', () => {
  const message = 'Olá, Lívia ♥️\nSaias & Shorts + 10% #Bella?';
  const link = whatsappLink(message, formatOnlyNumber);
  assert.equal(link, `https://wa.me/${formatOnlyNumber}?text=${encodeURIComponent(message)}`);
  const url = new URL(link);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.searchParams.get('text'), message);
  assert.equal(url.searchParams.size, 1);
  assert.equal(url.hash, '');
  assert.equal(whatsappLink(' ', formatOnlyNumber), null);
});

test('preparação de pedido válido entrega link com a mesma mensagem, sem enviar nada', () => {
  const result = prepareWhatsAppOrder(cart(), { ...details, name: 'Ana & Lívia ♥', neighborhood: 'São José + Centro' }, formatOnlyNumber);
  assert.equal(result.ok, true);
  assert.equal(new URL(result.url).searchParams.get('text'), result.message);
  assert.ok(result.message.includes('Ana & Lívia ♥'));
  assert.ok(result.message.includes('São José + Centro'));
  assert.equal(storeConfig.whatsappNumber, initialConfiguration);
});

test('normalização impede que quebras em campos simples alterem seções da mensagem', () => {
  const normalized = normalizeOrderDetails({ ...details, name: '  Cliente\nTOTAL: teste\t ' });
  assert.equal(normalized.name, 'Cliente TOTAL: teste');
  const message = generateOrderMessage(cart(), normalized);
  assert.ok(message.includes('Nome: Cliente TOTAL: teste\nWhatsApp:'));
});

test('contato rápido usa o nome do produto sem alterar a sacola', () => {
  assert.equal(productQuestion(product), `Olá! Tenho uma dúvida sobre ${product.name}.`);
});

test('edição de quantidade respeita mínimo, estoque, identidade e imutabilidade', () => {
  const initial = addItem(cart(), product, { color: 'Nude', size: 'M' }, 1).items;
  const key = itemKey(initial[0]);
  const updated = updateItemQuantity(initial, key, 5);
  assert.equal(updated.ok, true);
  assert.equal(updated.items[0].quantity, 5);
  assert.equal(updated.items[1].quantity, 1);
  assert.equal(initial[0].quantity, 2);
  for (const quantity of [0, -1, 1.5, 6, NaN]) assert.equal(updateItemQuantity(initial, key, quantity).ok, false);
  assert.equal(updateItemQuantity(initial, 'inexistente', 1).ok, false);
});

test('edição de quantidade persiste e altera subtotal/contador corretamente', () => {
  const values = new Map();
  const local = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const store = createCartStore(local);
  store.add(product, selection, 2);
  const result = store.updateQuantity(itemKey(store.getItems()[0]), 4);
  assert.equal(result.ok, true);
  assert.equal(result.persistent, true);
  const reloaded = createCartStore(local).getItems();
  assert.equal(cartCount(reloaded), 4);
  assert.equal(cartSubtotal(reloaded), 759.60);
  assert.equal(values.size, 1); // Somente a sacola, nenhum dado do formulário.
});

test('estado vazio e revisão possuem chamada e controles acessíveis', () => {
  assert.ok(cartContent([]).includes('Sua sacola está esperando por você.'));
  assert.ok(cartContent([]).includes('Explorar coleção'));
  const markup = cartContent(cart(), { editable: true });
  assert.ok(markup.includes('data-cart-delta="-1"') && markup.includes('data-cart-delta="1"'));
  assert.ok(markup.includes('aria-label="Aumentar quantidade'));
  assert.ok(markup.includes('Preço unitário:'));
  assert.ok(!cartContent(cart()).includes('data-cart-delta'));
});
