import test from 'node:test';
import assert from 'node:assert/strict';
import { bindWhatsAppButton, initFloatingWhatsApp } from '../public/js/whatsapp-ui.mjs';

// DOM mínimo: testa a regressão de visibilidade por colisão sem dependência de navegador.
function element() {
  const attributes = new Map();
  const listeners = new Map();
  const classes = new Set();
  return {
    attributes, listeners, innerHTML: '', className: '', children: [],
    classList: { add: name => classes.add(name), contains: name => classes.has(name), toggle(name, value) { value ? classes.add(name) : classes.delete(name); } },
    setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (name, listener) => listeners.set(name, listener),
    contains(other) { return this === other || this.children.includes(other); },
    append(child) { this.children.push(child); child.parentElement = this; },
    // Controle no mesmo retângulo: a antiga rotina de colisão ocultava o botão aqui.
    getBoundingClientRect: () => ({ left: 248, right: 304, top: 500, bottom: 556, width: 56, height: 56 })
  };
}

function environment(t) {
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  const body = element();
  const control = element();
  const windowListeners = new Map();
  const navigations = [];
  globalThis.document = {
    body, activeElement: null, createElement: element,
    querySelectorAll: selector => selector === '[data-whatsapp-contact]' ? [] : [control],
    addEventListener() {}
  };
  globalThis.window = {
    location: { assign: url => navigations.push(url) },
    addEventListener: (name, listener) => windowListeners.set(name, listener),
    requestAnimationFrame: callback => callback()
  };
  t.after(() => { globalThis.document = oldDocument; globalThis.window = oldWindow; });
  return { body, windowListeners, navigations };
}

test('atalho permanece no body e não alterna visibilidade por colisões durante scroll', t => {
  const { body, windowListeners } = environment(t);
  initFloatingWhatsApp(() => {});
  const button = body.children[0];
  assert.equal(button.parentElement, body);
  assert.equal(button.type, 'button');
  assert.ok(button.attributes.get('aria-label'));
  assert.ok(button.innerHTML.includes('<svg') && button.innerHTML.includes('aria-hidden="true"'));
  assert.ok(!button.innerHTML.includes('<span') && !button.innerHTML.includes('<img'));
  assert.equal(windowListeners.has('scroll'), false);
  for (let position = 0; position < 100; position++) windowListeners.get('scroll')?.();
  assert.equal(button.classList.contains('is-obscured'), false);
  assert.equal(button.className, 'whatsapp-floating');
});

test('contato mantém bloqueio sem número e navegação preparada quando configurado', t => {
  const { navigations } = environment(t);
  const notifications = [];
  const blocked = element();
  bindWhatsAppButton(blocked, 'Mensagem de teste', message => notifications.push(message), '');
  blocked.listeners.get('click')();
  assert.equal(blocked.attributes.get('aria-disabled'), 'true');
  assert.equal(navigations.length, 0);
  assert.ok(notifications[0].includes('precisa ser configurado'));
  const configured = element();
  // Somente validação de formato em navegação mockada; não configura nem contata a loja.
  bindWhatsAppButton(configured, 'Dúvida & coleção ♥', () => {}, '1'.repeat(11));
  configured.listeners.get('click')();
  assert.equal(configured.attributes.get('aria-disabled'), 'false');
  assert.equal(navigations.length, 1);
  assert.equal(new URL(navigations[0]).origin, 'https://wa.me');
  assert.equal(new URL(navigations[0]).searchParams.get('text'), 'Dúvida & coleção ♥');
});
