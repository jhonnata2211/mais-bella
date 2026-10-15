import { dashboardMetrics, stockSummary, stockRows, filterProducts, money, slugFromName, productWithStatus, productPayload, draftChanged } from './admin-model.mjs';

const $ = selector => document.querySelector(selector);
const field = (form, name) => form.elements.namedItem(name);
const productForm = $('#product-form');
const categoryForm = $('#category-form');
const categoryDialog = $('#category-dialog');
const confirmDialog = $('#confirm-dialog');
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
const entries = form => [...new FormData(form).entries()];
let csrf = '', products = [], categories = [], editing = null, editingCategory = null;
let currentView = 'home', returnView = 'products', busy = false, epoch = 0;
let productBaseline = null, categoryBaseline = null, productSlugCustom = false, categorySlugCustom = false;
let resumeView = null, resumeCategory = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function action(label, handler, className = 'secondary-button', accessibleLabel = label) {
  const button = element('button', className, label);
  button.type = 'button'; button.setAttribute('aria-label', accessibleLabel);
  button.addEventListener('click', handler);
  return button;
}
function badge(text, state) { return element('span', 'badge badge-' + state, text); }
function feedback(message = '', error = false, focus = true) {
  const node = $('#feedback'); node.textContent = message;
  node.dataset.error = String(error); node.setAttribute('role', error ? 'alert' : 'status');
  if (message && focus) node.focus();
}
function report(error, focus = true) {
  if (categoryDialog.open) {
    $('#category-feedback').textContent = error.message;
    if (focus) $('#category-feedback').focus();
  } else feedback(error.message, true, focus);
}
function setBusy(value, label = '') {
  busy = value;
  $('#main').setAttribute('aria-busy', String(value));
  $('#loading').hidden = !value;
  if (value) $('#loading-text').textContent = label;
  $('#workspace').inert = value; $('#admin-nav').inert = value;
  $('#login').inert = value; categoryForm.inert = value;
  $('#login-submit').disabled = value; $('#logout').disabled = value;
  for (const [form, text] of [[productForm, 'Salvar produto'], [categoryForm, 'Salvar categoria']]) {
    form.setAttribute('aria-busy', String(value));
    const button = form.querySelector('[type=submit]');
    button.disabled = value; button.textContent = value && label.startsWith('Salvando') ? 'Salvando…' : text;
  }
  $('#close-category').disabled = value;
}
async function task(label, handler) {
  if (busy) return false;
  setBusy(true, label);
  try { await handler(); return true; }
  catch (error) { report(error); return false; }
  finally { setBusy(false); }
}
const productDirty = () => productBaseline !== null && draftChanged(productBaseline, entries(productForm));
const categoryDirty = () => categoryBaseline !== null && draftChanged(categoryBaseline, entries(categoryForm));
const anyDirty = () => productDirty() || categoryDirty();
function updateDirty() { $('#draft-indicator').hidden = !productDirty(); }
function confirmAction(title, description, accept = 'Continuar') {
  if (confirmDialog.open) return Promise.resolve(false);
  $('#confirm-title').textContent = title; $('#confirm-description').textContent = description;
  $('#confirm-accept').textContent = accept; confirmDialog.returnValue = 'cancel';
  return new Promise(resolve => {
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'accept'), { once: true });
    confirmDialog.showModal();
  });
}
async function allowDiscard() {
  return !anyDirty() || await confirmAction('Descartar alterações?', 'Você fez alterações que ainda não foram salvas. Ao sair desta edição, elas serão descartadas.', 'Descartar');
}
function setView(view, focus = true) {
  currentView = view;
  for (const panel of document.querySelectorAll('[data-view]')) panel.hidden = panel.dataset.view !== view;
  for (const button of $('#admin-nav').querySelectorAll('[data-go]')) {
    if (button.dataset.go === (view === 'editor' ? 'products' : view)) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (focus) { $('#view-' + view).querySelector('h1').focus(); window.scrollTo({ top: 0, behavior: 'auto' }); }
}
async function navigate(view) {
  if (busy || !csrf) return false;
  if (view === currentView) return true;
  if (!await allowDiscard()) return false;
  productBaseline = null; categoryBaseline = null; editing = null;
  feedback(); setView(view); return true;
}
function showLogin(expired = false) {
  const keepDraft = expired && anyDirty();
  resumeView = keepDraft ? currentView : null;
  resumeCategory = keepDraft && categoryDialog.open && categoryDirty();
  if (confirmDialog.open) confirmDialog.close('cancel');
  if (categoryDialog.open) categoryDialog.close();
  csrf = ''; epoch++; products = []; categories = [];
  $('#workspace').hidden = true; $('#admin-nav').hidden = true; $('#logout').hidden = true; $('#login-panel').hidden = false;
  for (const id of ['product-list', 'stock-list', 'category-list', 'metrics']) $('#' + id).replaceChildren();
  if (!keepDraft) {
    editing = null; editingCategory = null; productBaseline = null; categoryBaseline = null;
    productForm.reset(); categoryForm.reset(); $('#variations').replaceChildren();
  }
  if (expired) {
    feedback(keepDraft ? 'Sua sessão expirou. Entre novamente para continuar a edição. Suas alterações continuam aqui, ainda sem salvar.' : 'Sua sessão expirou. Entre novamente para continuar.', true, false);
    $('#username').focus();
  }
}
async function api(path, method = 'GET', body) {
  const requestEpoch = epoch;
  let response;
  try {
    response = await fetch('/api/admin' + path, {
      method, credentials: 'same-origin',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch { throw Error('Não foi possível conectar à loja. Confira sua conexão e tente novamente.'); }
  if (requestEpoch !== epoch) throw Error('Seu acesso mudou. Entre novamente para continuar.');
  if (response.status === 401 && path !== '/login') {
    showLogin(true);
    throw Error($('#feedback').textContent);
  }
  let data;
  try { data = await response.json(); } catch { throw Error('A loja não respondeu como esperado. Tente novamente.'); }
  if (!response.ok) {
    if (response.status === 403) throw Error('Não foi possível autorizar esta ação. Confira seu acesso e tente entrar novamente.');
    if (response.status === 413) throw Error('Este cadastro ficou muito grande. Reduza o texto ou o número de variações e tente novamente.');
    throw Error(data.error || 'Não foi possível concluir. Tente novamente.');
  }
  return data;
}
function categoryFor(product) { return categories.find(c => c.id === product.categoryId); }
function emptyState(id, title, description, button) {
  const node = $(id); node.replaceChildren(element('h2', '', title), element('p', '', description));
  if (button) node.append(button);
}
function renderDashboard() {
  const m = dashboardMetrics(products, categories);
  const metrics = [
    ['Produtos cadastrados', m.total, 'products', {}], ['Produtos ativos', m.active, 'products', { status: 'active' }],
    ['Produtos inativos', m.inactive, 'products', { status: 'inactive' }], ['Variações esgotadas', m.empty, 'stock', { status: 'empty' }],
    ['Variações com estoque baixo', m.low, 'stock', { status: 'low' }], ['Categorias', m.categories, 'categories', {}]
  ];
  $('#metrics').replaceChildren(...metrics.map(([label, count, view, filters]) => {
    const button = action('', async () => {
      if (!await navigate(view)) return;
      if (view === 'products') { $('#product-search').value = ''; $('#product-category').value = ''; $('#product-status').value = filters.status || 'all'; renderProducts(); }
      if (view === 'stock') { $('#stock-search').value = ''; $('#stock-status').value = filters.status; $('#stock-inactive').checked = false; renderStock(); }
    }, 'metric' + (view === 'stock' && count > 0 ? ' metric-attention' : ''), `${label}: ${count}. Ver ${view === 'stock' ? 'estoque' : view === 'products' ? 'produtos' : 'categorias'}`);
    button.append(element('strong', '', String(count)), element('span', '', label)); return button;
  }));
  $('#demo-summary').hidden = !m.demo;
  $('#demo-summary').textContent = `${m.demo} ${m.demo === 1 ? 'produto demonstrativo incluído' : 'produtos demonstrativos incluídos'} nas contagens. Eles continuam identificados nos cadastros.`;
}
function renderProducts() {
  const list = filterProducts(products, { search: $('#product-search').value, status: $('#product-status').value, categoryId: $('#product-category').value });
  $('#product-count').textContent = `${list.length} de ${products.length} produtos`;
  $('#products-empty').hidden = list.length > 0;
  emptyState('#products-empty', products.length ? 'Nenhuma peça por aqui' : 'Sua coleção começa aqui', products.length ? 'Tente outro nome ou limpe os filtros para ver mais peças.' : 'Cadastre a primeira peça e organize suas cores e tamanhos.', products.length ? action('Limpar filtros', clearProductFilters) : action('+ Novo produto', () => openProduct()));
  $('#product-list').replaceChildren(...list.map(p => {
    const item = element('li', 'item-card'), top = element('div', 'item-top'), copy = element('div', 'item-copy');
    const category = categoryFor(p);
    copy.append(element('h2', '', p.name), element('p', '', category?.name || p.category));
    // h2 de linha usa o mesmo tamanho compacto das peças.
    copy.querySelector('h2').className = 'item-title';
    if (p.demo) copy.append(element('p', '', 'Demonstração'));
    if (category && !category.active) copy.append(element('p', '', 'Categoria inativa · oculto na vitrine'));
    top.append(copy, badge(p.active ? 'Ativo' : 'Inativo', p.active ? 'active' : 'inactive'));
    const prices = element('div', 'product-price');
    if (p.promotionalPriceCents != null) {
      const oldPrice = element('s', '', money(p.priceCents)); oldPrice.setAttribute('aria-label', 'Preço original ' + money(p.priceCents));
      const promotional = element('strong', '', money(p.promotionalPriceCents)); promotional.setAttribute('aria-label', 'Preço promocional ' + money(p.promotionalPriceCents)); prices.append(oldPrice, promotional);
    } else prices.append(element('strong', '', money(p.priceCents)));
    const stock = stockSummary(p), summary = element('p', 'stock-summary');
    summary.textContent = stock.variations ? `${stock.units} un. em ${stock.variations} variações ativas` : 'Nenhuma variação ativa';
    if (stock.empty || stock.low) summary.append(element('span', 'attention', ` · ${stock.empty} esgotadas · ${stock.low} com estoque baixo`));
    const actions = element('div', 'item-actions');
    actions.append(action('Editar', () => openProduct(p.id), 'secondary-button', 'Editar ' + p.name), action(p.active ? 'Desativar' : 'Ativar', () => toggleProduct(p), 'quiet-button', (p.active ? 'Desativar ' : 'Ativar ') + p.name));
    item.append(top, prices, summary, actions); return item;
  }));
}
function clearProductFilters() { $('#product-search').value = ''; $('#product-status').value = 'all'; $('#product-category').value = ''; renderProducts(); }
function renderStock() {
  const rows = stockRows(products, { search: $('#stock-search').value, status: $('#stock-status').value, includeInactive: $('#stock-inactive').checked });
  $('#stock-count').textContent = `${rows.length} ${rows.length === 1 ? 'variação encontrada' : 'variações encontradas'}`;
  $('#stock-empty').hidden = rows.length > 0;
  emptyState('#stock-empty', 'Nenhuma variação encontrada', products.length ? 'Ajuste a busca, a situação ou a opção de variações inativas.' : 'As cores, tamanhos e quantidades aparecerão aqui depois do primeiro cadastro.');
  const groups = new Map();
  for (const row of rows) { if (!groups.has(row.product.id)) groups.set(row.product.id, []); groups.get(row.product.id).push(row); }
  $('#stock-list').replaceChildren(...[...groups.values()].map(group => {
    const p = group[0].product, section = element('section', 'stock-group'), header = element('header');
    const title = element('h2', '', p.name); title.id = 'stock-heading-' + newId(); section.setAttribute('aria-labelledby', title.id);
    header.append(title, action('Editar estoque', () => openProduct(p.id, 'stock', true), 'quiet-button', 'Editar estoque de ' + p.name));
    const note = element('p', 'caption', [p.demo ? 'Demonstração' : '', !p.active ? 'Produto inativo' : '', categoryFor(p)?.active === false ? 'Categoria inativa' : ''].filter(Boolean).join(' · '));
    const table = element('table', 'stock-table');
    table.append(element('caption', 'sr-only', 'Variações de ' + p.name));
    const thead = element('thead'), headings = element('tr');
    for (const label of ['Cor / tamanho', 'Quantidade']) { const th = element('th', '', label); th.scope = 'col'; headings.append(th); } thead.append(headings);
    const tbody = element('tbody');
    for (const { variation: v, state } of group) {
      const tr = element('tr'), th = element('th', '', v.color); th.scope = 'row'; th.append(element('small', '', 'Tamanho ' + v.size));
      if (!v.active) th.append(badge('Variação inativa', 'inactive'));
      const td = element('td'); td.append(element('strong', '', `${v.stock} un.`), badge(state.label, state.key)); tr.append(th, td); tbody.append(tr);
    }
    table.append(thead, tbody); section.append(header); if (note.textContent) section.append(note); section.append(table); return section;
  }));
}
function renderCategories() {
  $('#category-count').textContent = `${categories.length} ${categories.length === 1 ? 'categoria' : 'categorias'}`;
  $('#categories-empty').hidden = categories.length > 0;
  emptyState('#categories-empty', 'Dê um lugar para cada peça', 'Crie sua primeira categoria, como vestidos ou blusas.', action('+ Nova categoria', () => openCategory()));
  $('#category-list').replaceChildren(...categories.map(c => {
    const li = element('li', 'item-card'), top = element('div', 'item-top'), copy = element('div', 'item-copy');
    const count = products.filter(p => p.categoryId === c.id).length;
    copy.append(element('h2', 'item-title', c.name), element('p', '', `${count} ${count === 1 ? 'produto vinculado' : 'produtos vinculados'}`));
    top.append(copy, badge(c.active ? 'Ativa' : 'Inativa', c.active ? 'active' : 'inactive'));
    const actions = element('div', 'item-actions'); actions.append(action('Editar', () => openCategory(c), 'secondary-button', 'Editar categoria ' + c.name), action(c.active ? 'Desativar' : 'Ativar', () => toggleCategory(c), 'quiet-button', (c.active ? 'Desativar categoria ' : 'Ativar categoria ') + c.name));
    li.append(top, actions); return li;
  }));
}
function fillCategories() {
  for (const [select, filter] of [[field(productForm, 'categoryId'), false], [$('#product-category'), true]]) {
    const previous = select.value;
    const options = categories.map(c => { const option = element('option', '', c.name + (c.active ? '' : ' (inativa)')); option.value = c.id; return option; });
    if (filter) { const all = element('option', '', 'Todas as categorias'); all.value = ''; options.unshift(all); }
    select.replaceChildren(...options);
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
  }
  $('#no-categories').hidden = categories.length > 0;
}
function renderAll() { fillCategories(); renderDashboard(); renderProducts(); renderStock(); renderCategories(); }
async function loadData() {
  const data = await Promise.all([api('/products'), api('/categories')]);
  products = data[0].products; categories = data[1].categories; renderAll();
}
async function enterWorkspace(data, announce = false) {
  csrf = data.csrfToken;
  await loadData();
  $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#admin-nav').hidden = false; $('#logout').hidden = false;
  const resumed = resumeView;
  setView(resumed || 'home', false);
  if (resumeCategory) categoryDialog.showModal();
  resumeView = null; resumeCategory = false;
  if (announce) feedback(resumed ? 'Acesso restabelecido. Sua edição continua disponível; revise e salve quando terminar.' : 'Bem-vinda! Sua coleção está pronta para organizar.');
}
function addVariation(v = {}) {
  const id = v.id || newId(), row = element('fieldset', 'admin-variation'); row.dataset.id = id;
  row.append(element('legend', '', 'Variação ' + ($('#variations').children.length + 1)));
  for (const [key, label, type, value] of [['color', 'Cor', 'text', v.color || ''], ['size', 'Tamanho', 'text', v.size || ''], ['stock', 'Quantidade', 'number', v.stock ?? 0], ['active', 'Variação ativa', 'checkbox', v.active ?? true]]) {
    const wrapper = element('label', type === 'checkbox' ? 'check-label' : '', label), input = element('input');
    input.dataset.field = key; input.name = key + '-' + id; input.type = type;
    if (type === 'checkbox') { input.checked = value; wrapper.prepend(input); }
    else { input.value = value; input.required = true; wrapper.append(input); }
    if (type === 'number') { input.min = 0; input.max = 1000000; input.step = 1; input.inputMode = 'numeric'; }
    if (key === 'color') input.maxLength = 80;
    if (key === 'size') input.maxLength = 30;
    row.append(wrapper);
  }
  row.append(action('Remover variação', async () => {
    if (!await confirmAction('Remover esta variação?', 'A combinação de cor e tamanho será removida ao salvar o produto. Você pode cancelar a edição para manter o cadastro anterior.', 'Remover')) return;
    row.remove();
    [...$('#variations').children].forEach((r, i) => { r.querySelector('legend').textContent = 'Variação ' + (i + 1); });
    updateDirty(); $('#add-variation').focus();
  }, 'quiet-button remove-variation'));
  $('#variations').append(row);
  return row;
}
async function openProduct(id, from = 'products', stock = false) {
  if (busy || !await allowDiscard()) return;
  await task(id ? 'Abrindo a peça…' : 'Preparando o cadastro…', async () => {
    // Consulta completa antes da edição; contém inclusive variações inativas.
    const p = id ? (await api('/products/' + encodeURIComponent(id))).product : null;
    editing = p; productBaseline = null; categoryBaseline = null; productSlugCustom = Boolean(p); returnView = from;
    productForm.reset(); $('#variations').replaceChildren();
    for (const detail of productForm.querySelectorAll('details')) detail.open = detail.id === 'section-info';
    if (p) {
      for (const key of ['name', 'slug', 'shortDescription', 'description', 'categoryId']) field(productForm, key).value = p[key];
      for (const key of ['active', 'featured', 'isNew', 'bestSeller']) field(productForm, key).checked = p[key];
      field(productForm, 'price').value = (p.priceCents / 100).toFixed(2).replace('.', ',');
      field(productForm, 'promotion').value = p.promotionalPriceCents == null ? '' : (p.promotionalPriceCents / 100).toFixed(2).replace('.', ',');
      p.variations.forEach(addVariation);
    } else {
      const firstActive = categories.find(c => c.active);
      if (firstActive) field(productForm, 'categoryId').value = firstActive.id;
      addVariation();
    }
    field(productForm, 'image').disabled = Boolean(p);
    $('#photo-options').hidden = Boolean(p); $('#photo-note').textContent = p ? 'A galeria atual será preservada. Alterações de fotos serão tratadas em uma próxima etapa.' : 'Sem fotografia por enquanto? A peça usará uma ilustração provisória. Fotos reais serão tratadas em uma próxima etapa.';
    $('#editor-title').textContent = p ? 'Editar produto' : 'Novo produto'; $('#demo-note').hidden = !p?.demo;
    productBaseline = JSON.stringify(entries(productForm)); updateDirty(); feedback(); setView('editor', false);
    if (stock) { $('#section-variations').open = true; $('#section-info').open = false; }
  });
  if (currentView === 'editor' && csrf) {
    if (stock) { $('#section-variations').querySelector('summary').focus(); $('#section-variations').scrollIntoView({ block: 'start' }); }
    else { $('#editor-title').focus(); window.scrollTo({ top: 0, behavior: 'auto' }); }
  }
}
async function openCategory(c = null) {
  if (busy || !await allowDiscard()) return;
  editingCategory = c; categoryBaseline = null; categorySlugCustom = Boolean(c); categoryForm.reset(); $('#category-feedback').textContent = '';
  for (const detail of categoryForm.querySelectorAll('details')) detail.open = false;
  if (c) { for (const key of ['name', 'slug', 'sortOrder']) field(categoryForm, key).value = c[key]; field(categoryForm, 'active').checked = c.active; }
  $('#category-editor-title').textContent = c ? 'Editar categoria' : 'Nova categoria';
  categoryBaseline = JSON.stringify(entries(categoryForm)); categoryDialog.showModal(); $('#category-name').focus();
}
async function closeCategory() {
  if (busy || !await allowDiscard()) return;
  categoryBaseline = null; editingCategory = null; categoryDialog.close(); $('#new-category').focus();
}
function updateProduct(p) { const index = products.findIndex(item => item.id === p.id); if (index < 0) products.push(p); else products[index] = p; products.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')); }
function updateCategory(c) { const index = categories.findIndex(item => item.id === c.id); if (index < 0) categories.push(c); else categories[index] = c; categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR')); }
async function toggleProduct(p) {
  if (busy || !await confirmAction(p.active ? 'Desativar esta peça?' : 'Ativar esta peça?', p.active ? `${p.name} deixará de aparecer na vitrine. O cadastro e o estoque serão preservados.` : `${p.name} voltará a aparecer na vitrine se sua categoria estiver ativa.`, p.active ? 'Desativar' : 'Ativar')) return;
  await task('Atualizando o produto…', async () => {
    const latest = (await api('/products/' + encodeURIComponent(p.id))).product;
    const saved = await api('/products/' + encodeURIComponent(p.id), 'PUT', productWithStatus(latest, !p.active));
    updateProduct(saved.product); renderAll(); feedback(p.active ? 'Produto desativado. Cadastro e estoque preservados.' : 'Produto ativado. Confira se a categoria também está ativa.');
  });
}
async function toggleCategory(c) {
  const count = products.filter(p => p.categoryId === c.id).length;
  if (busy || !await confirmAction(c.active ? 'Desativar esta categoria?' : 'Ativar esta categoria?', c.active ? `${c.name} tem ${count} produtos vinculados. Eles ficarão ocultos na vitrine. Nenhum cadastro será excluído.` : `${c.name} ficará disponível na loja. Seus produtos ativos poderão aparecer novamente.`, c.active ? 'Desativar' : 'Ativar')) return;
  await task('Atualizando a categoria…', async () => {
    const latest = (await api('/categories')).categories.find(item => item.id === c.id);
    if (!latest) throw Error('Esta categoria não está mais disponível. Atualize o painel.');
    const saved = await api('/categories/' + encodeURIComponent(c.id), 'PUT', { ...latest, active: !c.active });
    updateCategory(saved.category); renderAll(); feedback(c.active ? 'Categoria desativada. Os cadastros foram preservados.' : 'Categoria ativada.');
  });
}
function submit(form, label, handler) {
  form.addEventListener('submit', async event => { event.preventDefault(); await task(label, handler); });
  // Controles obrigatórios dentro de details fechados precisam ficar visíveis para receber foco.
  form.addEventListener('invalid', event => {
    let parent = event.target.parentElement;
    while (parent && parent !== form) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }, true);
}
submit($('#login'), 'Entrando na sua loja…', async () => {
  try { const data = await api('/login', 'POST', { username: $('#username').value, password: $('#password').value }); await enterWorkspace(data, true); }
  finally { $('#password').value = ''; }
});
submit(productForm, 'Salvando sua peça…', async () => {
  const values = {};
  for (const key of ['name', 'slug', 'shortDescription', 'description', 'categoryId', 'price', 'promotion', 'image']) values[key] = field(productForm, key).value;
  for (const key of ['active', 'featured', 'isNew', 'bestSeller']) values[key] = field(productForm, key).checked;
  const variations = [...$('#variations').children].map(row => {
    const v = { id: row.dataset.id };
    for (const input of row.querySelectorAll('input')) v[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
    return v;
  });
  if (!variations.length) { $('#section-variations').open = true; throw Error('Adicione pelo menos uma variação de cor e tamanho antes de salvar.'); }
  const payload = productPayload(values, variations, editing, newId());
  const saved = await api('/products' + (editing ? '/' + encodeURIComponent(editing.id) : ''), editing ? 'PUT' : 'POST', payload);
  // Usa a resposta confirmada do servidor; falha em uma leitura posterior não induz cadastro duplicado.
  updateProduct(saved.product); productBaseline = null; editing = null; renderAll(); setView(returnView, false); feedback('Produto salvo. As informações da loja foram atualizadas.');
});
submit(categoryForm, 'Salvando a categoria…', async () => {
  const payload = { id: editingCategory?.id || newId(), name: field(categoryForm, 'name').value, slug: field(categoryForm, 'slug').value, sortOrder: Number(field(categoryForm, 'sortOrder').value), active: field(categoryForm, 'active').checked };
  const saved = await api('/categories' + (editingCategory ? '/' + encodeURIComponent(editingCategory.id) : ''), editingCategory ? 'PUT' : 'POST', payload);
  updateCategory(saved.category); categoryBaseline = null; editingCategory = null; categoryDialog.close(); renderAll(); feedback('Categoria salva. Sua coleção está organizada.');
});
for (const button of document.querySelectorAll('[data-go]')) button.addEventListener('click', () => navigate(button.dataset.go));
for (const button of document.querySelectorAll('[data-new-product]')) button.addEventListener('click', () => openProduct());
for (const id of ['product-search', 'product-status', 'product-category']) $('#' + id).addEventListener(id === 'product-search' ? 'input' : 'change', renderProducts);
for (const id of ['stock-search', 'stock-status', 'stock-inactive']) $('#' + id).addEventListener(id === 'stock-search' ? 'input' : 'change', renderStock);
$('#clear-products').addEventListener('click', clearProductFilters);
$('#cancel-product').addEventListener('click', () => navigate(returnView));
$('#back-products').addEventListener('click', () => navigate(returnView));
$('#add-variation').addEventListener('click', () => { const row = addVariation(); updateDirty(); row.querySelector('input').focus(); });
$('#new-category').addEventListener('click', () => openCategory());
$('#close-category').addEventListener('click', closeCategory); $('#cancel-category').addEventListener('click', closeCategory);
categoryDialog.addEventListener('cancel', event => { event.preventDefault(); closeCategory(); });
productForm.addEventListener('input', updateDirty); productForm.addEventListener('change', updateDirty);
$('#product-name').addEventListener('input', () => { if (!productSlugCustom) field(productForm, 'slug').value = slugFromName($('#product-name').value); updateDirty(); });
$('#product-slug').addEventListener('input', () => { productSlugCustom = true; });
$('#category-name').addEventListener('input', () => { if (!categorySlugCustom) field(categoryForm, 'slug').value = slugFromName($('#category-name').value); });
$('#category-slug').addEventListener('input', () => { categorySlugCustom = true; });
$('#logout').addEventListener('click', async () => {
  if (busy || !await allowDiscard()) return;
  await task('Encerrando seu acesso…', async () => { await api('/logout', 'POST', {}); showLogin(); feedback('Você saiu do painel com segurança.'); $('#password').focus(); });
});
window.addEventListener('beforeunload', event => { if (anyDirty()) { event.preventDefault(); event.returnValue = ''; } });
// Verifica expiração sem estender a duração absoluta da sessão.
async function checkSession() {
  if (csrf && !busy) { try { const data = await api('/session'); csrf = data.csrfToken; } catch (error) { report(error, false); } }
}
window.addEventListener('pageshow', event => { if (event.persisted) checkSession(); });
setInterval(checkSession, 60000);
setBusy(true, 'Conferindo seu acesso…');
try { const data = await api('/session'); await enterWorkspace(data); }
catch (error) { const initial = error.message.startsWith('Sua sessão expirou'); showLogin(); feedback(initial ? '' : error.message, !initial, false); }
finally { setBusy(false); }
