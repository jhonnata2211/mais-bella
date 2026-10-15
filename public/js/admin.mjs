const $ = selector => document.querySelector(selector);
const feedback = (message, error = false) => { const node = $('#feedback'); node.textContent = message; node.setAttribute('role', error ? 'alert' : 'status'); node.focus(); };
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2,'0')).join('');
let csrf = '', products = [], categories = [], editing = null, editingCategory = null;
function showLogin() {
  csrf = ''; products = []; categories = []; editing = null; editingCategory = null;
  $('#workspace').hidden = true; $('#logout').hidden = true; $('#login-panel').hidden = false;
  $('#product-list').replaceChildren(); $('#category-list').replaceChildren(); $('#product-form').reset(); $('#category-form').reset(); $('#variations').replaceChildren();
}
async function api(path, method = 'GET', body) {
  const response = await fetch('/api/admin' + path, { method, credentials: 'same-origin', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401 && path !== '/login') showLogin(); throw Error(data.error || 'Não foi possível concluir.'); }
  return data;
}
function action(text, fn) { const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.addEventListener('click', fn); return button; }
function field(form, name) { return form.elements.namedItem(name); }
function resetProduct() {
  editing = null; $('#product-form').reset(); $('#variations').replaceChildren(); $('#editor-title').textContent = 'Cadastrar produto'; $('#demo-note').hidden = true; field($('#product-form'),'image').required = true; addVariation();
}
function addVariation(v = {}) {
  const row = document.createElement('div'); row.className = 'admin-variation'; row.dataset.id = v.id || newId();
  for (const [key, label, type, value] of [['color','Cor','text',v.color || ''],['size','Tamanho','text',v.size || ''],['stock','Estoque','number',v.stock ?? 0],['active','Variação ativa','checkbox',v.active ?? true]]) {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const input = document.createElement('input'); input.dataset.field = key; input.type = type;
    if (type === 'checkbox') input.checked = value; else { input.value = value; input.required = true; }
    if (type === 'number') { input.min = 0; input.max = 1000000; input.step = 1; }
    if (key === 'color') input.maxLength = 80; if (key === 'size') input.maxLength = 30;
    wrapper.append(input); row.append(wrapper);
  }
  row.append(action('Remover variação', () => row.remove())); $('#variations').append(row);
}
function editProduct(p) {
  editing = p; const form = $('#product-form'); form.reset();
  for (const name of ['name','slug','shortDescription','description','categoryId']) field(form,name).value = p[name];
  for (const name of ['active','featured','isNew','bestSeller']) field(form,name).checked = p[name];
  field(form,'price').value = (p.priceCents / 100).toFixed(2); field(form,'promotion').value = p.promotionalPriceCents == null ? '' : (p.promotionalPriceCents / 100).toFixed(2);
  field(form,'image').required = false; $('#demo-note').hidden = !p.demo;
  $('#variations').replaceChildren(); p.variations.forEach(addVariation); $('#editor-title').textContent = 'Editar produto'; field(form,'name').focus();
}
function editCategory(c) { editingCategory = c; const form = $('#category-form'); for (const name of ['name','slug','sortOrder']) field(form,name).value = c[name]; field(form,'active').checked = c.active; field(form,'name').focus(); }
async function refresh() {
  const [p,c] = await Promise.all([api('/products'),api('/categories')]); products = p.products; categories = c.categories;
  $('#product-list').replaceChildren(...products.map(product => { const li = document.createElement('li'); const text = document.createElement('span'); text.textContent = `${product.name} · ${product.active ? 'Ativo' : 'Inativo'}${product.demo ? ' · Demonstração' : ''}`; li.append(text,action('Editar ' + product.name, () => editProduct(product))); return li; }));
  $('#category-list').replaceChildren(...categories.map(category => { const li = document.createElement('li'); const text = document.createElement('span'); text.textContent = `${category.name} · ${category.active ? 'Ativa' : 'Inativa'}`; li.append(text,action('Editar ' + category.name, () => editCategory(category))); return li; }));
  const select = field($('#product-form'),'categoryId'); const previous = select.value;
  select.replaceChildren(...categories.map(c => { const option = document.createElement('option'); option.value = c.id; option.textContent = c.name + (c.active ? '' : ' (inativa)'); return option; })); if (categories.some(c => c.id === previous)) select.value = previous;
}
function submit(form, handler) { form.addEventListener('submit', async event => { event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; try { await handler(); } catch (error) { feedback(error.message,true); } finally { button.disabled = false; } }); }
submit($('#login'), async () => { const form = $('#login'); try { const data = await api('/login','POST',{ username: field(form,'username').value, password: field(form,'password').value }); csrf = data.csrfToken; await refresh(); $('#workspace').hidden = false; $('#logout').hidden = false; $('#login-panel').hidden = true; resetProduct(); feedback('Acesso autorizado.'); } finally { field(form,'password').value = ''; } });
function cents(value) { if (!/^\d+([.,]\d{1,2})?$/.test(value)) throw Error('Preço inválido. Use até duas casas decimais.'); return Number(value.replace(',','.').split('.')[0]) * 100 + Number((value.replace(',','.').split('.')[1] || '').padEnd(2,'0')); }
submit($('#product-form'), async () => {
  const form = $('#product-form'), p = {}; for (const name of ['name','slug','shortDescription','description','categoryId']) p[name] = field(form,name).value;
  for (const name of ['active','featured','isNew','bestSeller']) p[name] = field(form,name).checked;
  p.id = editing?.id || newId(); p.priceCents = cents(field(form,'price').value); p.promotionalPriceCents = field(form,'promotion').value ? cents(field(form,'promotion').value) : null;
  p.images = editing ? editing.images : [{ type:'image', src:field(form,'image').value, alt:p.name }];
  p.variations = [...$('#variations').children].map(row => { const v = { id:row.dataset.id }; for (const input of row.querySelectorAll('input')) v[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value; return v; });
  await api('/products' + (editing ? '/' + encodeURIComponent(editing.id) : ''),editing ? 'PUT' : 'POST',p); await refresh(); resetProduct(); feedback('Produto salvo.');
});
submit($('#category-form'), async () => { const form = $('#category-form'); const c = { id:editingCategory?.id || newId(), name:field(form,'name').value, slug:field(form,'slug').value, sortOrder:Number(field(form,'sortOrder').value), active:field(form,'active').checked }; await api('/categories' + (editingCategory ? '/' + encodeURIComponent(editingCategory.id) : ''),editingCategory ? 'PUT' : 'POST',c); await refresh(); editingCategory = null; form.reset(); feedback('Categoria salva.'); });
$('#logout').addEventListener('click', async () => { try { await api('/logout','POST',{}); showLogin(); feedback('Sessão encerrada.'); } catch (e) { feedback(e.message,true); } });
$('#new-product').addEventListener('click', () => { resetProduct(); field($('#product-form'),'name').focus(); });
$('#cancel-product').addEventListener('click',resetProduct);
$('#cancel-category').addEventListener('click', () => { editingCategory = null; $('#category-form').reset(); });
$('#add-variation').addEventListener('click', () => addVariation());
try { const data = await api('/session'); csrf = data.csrfToken; await refresh(); $('#workspace').hidden = false; $('#logout').hidden = false; $('#login-panel').hidden = true; resetProduct(); } catch (error) { feedback(error.message,true); }
// Verifica expiração também durante a permanência no painel, sem renovar o prazo absoluto.
setInterval(async () => { if (csrf) { try { await api('/session'); } catch (e) { feedback(e.message,true); } } },60000);
