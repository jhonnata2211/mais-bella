import { hasDemoItems, isDemoProduct } from './commerce.mjs';
import { storeConfig } from './config.mjs';
import { products } from './data/products.mjs';
import { cartCount, cartSubtotal, itemKey } from './cart.mjs';
import { effectivePrice } from './catalog.mjs';
import { findProduct, validateSelection } from './product-model.mjs';
import { money } from './products.mjs';

export const WHATSAPP_UNAVAILABLE = 'O WhatsApp comercial da Mais Bella precisa ser configurado. Nenhuma conversa será aberta por enquanto.';
export const isStoreNumberValid = number => typeof number === 'string' && /^[1-9]\d{7,14}$/.test(number);
const cleanLine = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
export function normalizeOrderDetails(details = {}) {
  return Object.fromEntries(['name', 'phone', 'city', 'neighborhood', 'receiving', 'deliveryNote'].map(key => [key, cleanLine(details[key])]));
}

export function isCustomerPhoneValid(value) {
  const phone = cleanLine(value);
  const digits = phone.replace(/\D/g, '');
  return phone.length <= 32 && /^\+?[\d\s().-]+$/.test(phone) && digits.length >= 10 && digits.length <= 15 && new Set(digits).size > 1;
}

export function validateOrder(items, details = {}, { number = storeConfig.whatsappNumber, requireStoreNumber = true, source = products } = {}) {
  const data = normalizeOrderDetails(details);
  const errors = {};
  if (!Array.isArray(items) || !items.length) errors.cart = 'Adicione uma peça à sacola para preparar seu pedido.';
  else {
    const quantities = new Map();
    for (const item of items) {
      if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        errors.cart = 'Revise as quantidades da sacola: use números inteiros a partir de 1.';
        break;
      }
      const product = findProduct({ id: item?.productId }, source);
      const validation = validateSelection(product, item, item?.quantity);
      if (!validation.ok || !Number.isFinite(item.price) || item.price !== effectivePrice(product) || item.slug !== product.slug || item.name !== product.name) {
        errors.cart = 'A disponibilidade, o preço ou uma variação mudou. Revise os itens da sacola antes de continuar.';
        break;
      }
      const key = itemKey(item);
      const quantity = (quantities.get(key) || 0) + item.quantity;
      quantities.set(key, quantity);
      if (quantity > validation.stock) {
        errors.cart = 'Uma variação ultrapassa o estoque disponível. Ajuste as quantidades da sacola.';
        break;
      }
    }
  }
  for (const [key, label] of [['name', 'nome'], ['city', 'cidade'], ['neighborhood', 'bairro']]) {
    if (!data[key]) errors[key] = `Informe seu ${label === 'cidade' ? 'município / cidade' : label}.`;
    else if (data[key].length > 80) errors[key] = `Use até 80 caracteres para ${label}.`;
  }
  if (!isCustomerPhoneValid(data.phone)) errors.phone = 'Informe um telefone com DDD, usando de 10 a 15 dígitos.';
  if (!['delivery', 'pickup'].includes(data.receiving)) errors.receiving = 'Escolha entrega ou retirada.';
  if (data.receiving === 'delivery' && data.deliveryNote.length > 500) errors.deliveryNote = 'Use até 500 caracteres na observação.';
  if (requireStoreNumber && !isStoreNumberValid(number)) errors.whatsapp = WHATSAPP_UNAVAILABLE;
  return { ok: Object.keys(errors).length === 0, errors, details: data };
}

export function generateOrderMessage(items, details) {
  const validation = validateOrder(items, details, { requireStoreNumber: false });
  if (!validation.ok) throw new Error('Revise os dados e os itens antes de gerar a mensagem.');
  const data = validation.details;
  const source = products;
  const demo = hasDemoItems(items, source);
  const lines = ['Olá! Quero fazer um pedido na Mais Bella ♡', '', 'MEU PEDIDO'];
  if (demo) lines.push('Atenção: itens marcados como DEMONSTRATIVO são fictícios e não estão à venda.');
  lines.push('');
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${cleanLine(item.name)}${isDemoProduct(findProduct({ id: item.productId }, source)) ? ' [DEMONSTRATIVO]' : ''}`, `Cor: ${cleanLine(item.color) || 'Sem variação de cor'}`, `Tamanho: ${cleanLine(item.size) || 'Sem variação de tamanho'}`,
      `Quantidade: ${item.quantity}`, `Valor unitário: ${money(item.price)}`,
      `Subtotal: ${money(Math.round(item.price * 100) * item.quantity / 100)}`, '');
  });
  lines.push(`Total dos produtos: ${money(cartSubtotal(items))}`, `Quantidade total: ${cartCount(items)}`, 'Frete não incluído; disponibilidade, entrega e pagamento a confirmar.', '',
    'DADOS', `Nome: ${data.name}`, `WhatsApp: ${data.phone}`, `Cidade: ${data.city}`, `Bairro: ${data.neighborhood}`, '',
    'RECEBIMENTO', data.receiving === 'delivery' ? 'Entrega — condições e frete a confirmar no atendimento.' : 'Retirada — local e horário a combinar pelo WhatsApp.');
  if (data.receiving === 'delivery' && data.deliveryNote) lines.push(`Observação: ${data.deliveryNote}`);
  lines.push('', 'Gostaria de confirmar a disponibilidade, entrega e forma de pagamento.');
  return lines.join('\n');
}

export function whatsappLink(message, number = storeConfig.whatsappNumber) {
  if (!isStoreNumberValid(number) || typeof message !== 'string' || !message.trim()) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function prepareWhatsAppOrder(items, details, number = storeConfig.whatsappNumber) {
  const validation = validateOrder(items, details, { number });
  if (!validation.ok) return validation;
  const message = generateOrderMessage(items, validation.details);
  return { ok: true, message, url: whatsappLink(message, number) };
}

export const productQuestion = product => `Olá! Tenho uma dúvida sobre ${product.name}.`;
