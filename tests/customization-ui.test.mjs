import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initCustomizationPanel } from '../public/js/admin-customization.mjs';
import { defaultCustomization, CATEGORY_SLOTS, validateCustomization } from '../public/js/customization-model.mjs';
import { createCustomizationRenderer, loadCustomization } from '../public/js/store-customization.mjs';
const require = createRequire(import.meta.url);
// DOM mínimo sem parser HTML: qualquer tentativa de usar innerHTML falha.
class Text {
  constructor(value) { this.nodeValue=value; }
  get textContent() { return this.nodeValue; }
  cloneNode() { return new Text(this.nodeValue); }
}
class Element {
  constructor(tag) {
    this.tagName=tag;this.childNodes=[];this.attributes=new Map();this.dataset={};this.selectors=new Map();this.listeners=new Map();
    const classes=new Set();this.classes=classes;
    this.classList={toggle(name,force){force?classes.add(name):classes.delete(name)},remove(name){classes.delete(name)},contains(name){return classes.has(name)}};
  }
  set innerHTML(value) { throw Error('HTML não deve ser interpretado'); }
  get firstChild() { return this.childNodes[0]; }
  get textContent() { return this.childNodes.map(child=>child.textContent).join(''); }
  set textContent(value) { this.childNodes=[new Text(String(value))]; }
  append(...children) { this.childNodes.push(...children); }
  prepend(...children) { this.childNodes.unshift(...children); }
  replaceChildren(...children) { this.childNodes=[...children]; }
  setAttribute(name,value) { this.attributes.set(name,value); }
  getAttribute(name) { return this.attributes.get(name)||null; }
  querySelector(selector) { return this.selectors.get(selector); }
  addEventListener(name,callback) { this.listeners.set(name,callback); }
  cloneNode(deep) {const copy=new Element(this.tagName);copy.attributes=new Map(this.attributes);for(const className of this.classes)copy.classes.add(className);if(deep)copy.childNodes=this.childNodes.map(child=>child.cloneNode(true));return copy;}
}
const element=(tag,text)=>{const node=new Element(tag);if(text!==undefined)node.textContent=text;return node};
function environment() {
  const root=new Element('document');root.createElement=tag=>new Element(tag);
  const title=element('h1');title.append(new Text('Vista o que te faz'),element('br'),new Text('mais '),element('em','Bella.'));
  const description=element('p');description.append(new Text('Leveza nos detalhes. Elegância em cada escolha.'),element('br'),new Text('Peças que acompanham a sua melhor versão.'));
  const art=element('div');art.setAttribute('aria-label','Ilustração original');art.append(element('div','Ilustração CSS original'));
  const button=element('a');button.setAttribute('href','#novidades');button.append(new Text('Conhecer coleção '),element('span','↗'));
  const collection=element('p','NOVA COLEÇÃO · ESSÊNCIA');
  for(const [selector,node]of[['#hero-title',title],['[data-hero-description]',description],['[data-hero-image]',art],['[data-hero-button]',button],['[data-hero-collection]',collection]])root.selectors.set(selector,node);
  const cards=new Map();
  for(const slot of CATEGORY_SLOTS){const card=element('a'),picture=element('div'),caption=element('span');picture.append(element('span','Ilustração '+slot.id));caption.append(new Text(slot.label+' '),element('span','↗'));card.dataset.category=slot.label;card.selectors.set('.category-art',picture);card.selectors.set('[data-category-caption]',caption);root.selectors.set(`[data-store-category="${slot.id}"]`,card);root.selectors.set(`[data-store-category="${slot.id}"] .category-art`,picture);cards.set(slot.id,{card,picture,caption});}
  return {root,title,description,art,button,collection,cards};
}
function snapshot(node) {return node instanceof Text?node.nodeValue:{tag:node.tagName,attributes:[...node.attributes],classes:[...node.classes],children:node.childNodes.map(snapshot)}}

test('padrões preservam a marcação de título/ênfase, quebras, ilustrações e setas da Home',()=>{
  const f=environment(),before=[f.title,f.description,f.art,f.button,...[...f.cards.values()].flatMap(item=>[item.picture,item.caption])].map(snapshot);
  createCustomizationRenderer(f.root)(defaultCustomization());
  assert.deepEqual([f.title,f.description,f.art,f.button,...[...f.cards.values()].flatMap(item=>[item.picture,item.caption])].map(snapshot),before);
});
test('textos com HTML são exibidos como texto; nomes visuais não alteram o filtro por categoria',()=>{
  const f=environment(),value=defaultCustomization();value.hero.title='<img src=x onerror=alert(1)>';value.hero.description='<script>evil()</script>';value.hero.collection='<b>Minha coleção</b>';value.hero.buttonText='<svg onload=evil()>';value.hero.buttonHref='/catalogo.html';value.categories.vestidos.label='Festa <b>leve</b>';
  createCustomizationRenderer(f.root,[{id:'vestidos',name:'Vestidos oficiais'}])(value);
  assert.equal(f.title.textContent,value.hero.title);assert.ok(f.title.firstChild instanceof Text);assert.equal(f.description.textContent,value.hero.description);
  assert.equal(f.button.getAttribute('href'),'/catalogo.html');assert.equal(f.button.firstChild.nodeValue,value.hero.buttonText+' ');assert.equal(f.button.childNodes[1].textContent,'↗');
  assert.equal(f.cards.get('vestidos').caption.firstChild.nodeValue,'Festa <b>leve</b> ');assert.equal(f.cards.get('vestidos').card.dataset.category,'Vestidos oficiais');
});
test('URLs de botão/imagem maliciosas são recusadas antes de modificar qualquer conteúdo',()=>{
  for(const change of [v=>v.hero.buttonHref='javascript:evil()',v=>v.hero.image={src:'https://malicioso.example/foto.png',alt:'Foto'},v=>v.categories.calcas.image={src:'/uploads/products/../server.js',alt:'Foto'}]){
    const f=environment(),before=snapshot(f.title),value=defaultCustomization();change(value);assert.throws(()=>createCustomizationRenderer(f.root)(value));assert.deepEqual(snapshot(f.title),before);
  }
});
test('imagem segura tem alt e fallback; restauração recupera ilustração/ênfase e ignora erro de imagem antiga',()=>{
  const f=environment(),apply=createCustomizationRenderer(f.root),value=defaultCustomization();const originalTitle=snapshot(f.title),originalArt=snapshot(f.art);
  value.hero.title='Nova coleção';value.hero.image={src:'/uploads/products/'+'a'.repeat(32)+'.png',alt:'Foto do banner'};value.categories.vestidos.image={src:'/uploads/products/'+'b'.repeat(32)+'.png',alt:'Vestidos da coleção'};
  apply(value);const first=f.art.firstChild;assert.equal(first.src,value.hero.image.src);assert.equal(f.art.getAttribute('aria-label'),'Foto do banner');assert.equal(f.cards.get('vestidos').picture.firstChild.alt,'Vestidos da coleção');
  value.hero.image={...value.hero.image,src:'/uploads/products/'+'c'.repeat(32)+'.png'};apply(value);const second=f.art.firstChild;first.listeners.get('error')();assert.equal(f.art.firstChild,second);
  second.listeners.get('error')();assert.deepEqual(snapshot(f.art),originalArt);
  apply(defaultCustomization());assert.deepEqual(snapshot(f.title),originalTitle);assert.deepEqual(snapshot(f.art),originalArt);
});
test('carregamento público usa leitura sem cache e não transmite informações administrativas',async()=>{
  const f=environment(),calls=[];
  await loadCustomization({root:f.root,fetcher:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({customization:defaultCustomization()})}}});
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/store-customization');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.body,undefined);
  const before=snapshot(f.title);await assert.rejects(loadCustomization({root:f.root,fetcher:async()=>({ok:false})}));assert.deepEqual(snapshot(f.title),before);
});
test('modelo compartilhado permanece síncrono e carregável pelo backend sem dependências adicionais',()=>{
  assert.deepEqual(require('../public/js/customization-model.mjs').defaultCustomization(),defaultCustomization());
});

function adminEnvironment(t) {
  const previousDocument=globalThis.document,createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL;
  const root=new Element('document');root.createElement=tag=>new Element(tag);globalThis.document=root;
  let blobCount=0;const revoked=[];URL.createObjectURL=()=> 'blob:preview-'+ ++blobCount;URL.revokeObjectURL=url=>revoked.push(url);
  t.after(()=>{globalThis.document=previousDocument;URL.createObjectURL=createURL;URL.revokeObjectURL=revokeURL});
  const form=new Element('form'),fields=new Map(),sections=new Map(),preview=new Element('div');
  const fieldNames=['hero-collection','hero-title','hero-description','hero-buttonText','hero-buttonHref',...['hero',...CATEGORY_SLOTS.map(slot=>slot.id)].map(slot=>slot+'-alt'),...CATEGORY_SLOTS.map(slot=>slot.id+'-label')];
  for(const name of fieldNames){const input=new Element('input');input.name=name;input.value='';fields.set(name,input);}
  form.elements={namedItem:name=>fields.get(name)};form.reportValidity=()=>true;form.reset=()=>{for(const field of fields.values())field.value=''};
  root.selectors.set('#customization-form',form);root.selectors.set('#customization-preview',preview);root.selectors.set('#customization-draft',new Element('span'));
  for(const name of ['restore-customization','reload-customization'])root.selectors.set('#'+name,new Element('button'));
  for(const slot of ['hero',...CATEGORY_SLOTS.map(slot=>slot.id)]){const section=new Element('div'),controls=new Element('div'),photo=new Element('div');section.selectors.set('[data-custom-controls]',controls);sections.set(slot,{section,controls,photo});root.selectors.set(`[data-custom-section="${slot}"]`,section);root.selectors.set(`[data-custom-photo="${slot}"]`,photo);}
  form.querySelectorAll=()=>[...sections.values()].map(item=>item.controls.firstChild).filter(Boolean);
  const confirmations=[],calls=[],errors=[],messages=[],tasks=[];
  let state={customization:defaultCustomization(),revision:0},imageCount=0,failSave=false;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const api=async(route,method='GET',body,mime)=>{
    calls.push({route,method,body,mime});
    if(route==='/images')return{image:{src:'/uploads/products/'+String(++imageCount).padStart(32,'0')+'.png',alt:'Foto enviada'}};
    if(method==='GET')return clone(state);
    if(failSave)throw Error('Falha simulada; tente novamente.');
    if(body.revision!==state.revision)throw Error('A personalização mudou em outro acesso.');
    state={revision:state.revision+1,customization:route.endsWith('/reset')?defaultCustomization():validateCustomization(body.customization)};return clone(state);
  };
  const task=(label,handler)=>{const promise=Promise.resolve().then(handler).catch(error=>{errors.push(error);return false});tasks.push(promise);return promise};
  const panel=initCustomizationPanel({api,task,confirm:async()=>confirmations.shift()??false,feedback:message=>messages.push(message)});
  const fire=async(target,type)=>{target.listeners.get(type)?.({preventDefault(){},target});if(tasks.length)await tasks.at(-1)};
  const set=(name,value)=>{fields.get(name).value=value;form.listeners.get('input')?.({target:fields.get(name)})};
  const choose=slot=>{const input=sections.get(slot).controls.firstChild;input.files=[{name:'foto.png',type:'image/png',size:100,lastModified:1}];input.listeners.get('change')();};
  return {root,form,fields,preview,panel,calls,errors,messages,confirmations,revoked,set,choose,fire,remote:value=>{state=value},fail:value=>{failSave=value},state:()=>clone(state)};
}

test('painel mantém prévia textual segura, confirma antes de salvar e revela campo inválido recolhido',async t=>{
  const h=adminEnvironment(t);await h.panel.load();assert.equal(h.panel.isDirty(),false);
  h.set('hero-title','<script>texto sem execução</script>');assert.ok(h.preview.textContent.includes('<script>texto sem execução</script>'));assert.equal(h.panel.isDirty(),true);
  await h.fire(h.form,'submit');assert.equal(h.calls.filter(call=>call.method==='PUT').length,0);assert.equal(h.panel.isDirty(),true);
  h.confirmations.push(true);await h.fire(h.form,'submit');assert.equal(h.state().customization.hero.title,'<script>texto sem execução</script>');assert.equal(h.panel.isDirty(),false);
  const details={tagName:'DETAILS',open:false,parentElement:h.form};h.form.listeners.get('invalid')({target:{parentElement:details}});assert.equal(details.open,true);assert.deepEqual(h.errors,[]);
});
test('painel faz prévia local sem upload antecipado e reaproveita pendente após falha/retorno de sessão',async t=>{
  const h=adminEnvironment(t);await h.panel.load();h.choose('hero');assert.equal(h.calls.filter(call=>call.route==='/images').length,0);assert.equal(h.panel.isDirty(),true);
  h.fail(true);h.confirmations.push(true);await h.fire(h.form,'submit');assert.equal(h.errors.length,1);assert.equal(h.panel.isDirty(),true);
  const reads=h.calls.filter(call=>call.method==='GET').length;await h.panel.load();assert.equal(h.calls.filter(call=>call.method==='GET').length,reads);
  h.fail(false);h.confirmations.push(true);await h.fire(h.form,'submit');assert.equal(h.calls.filter(call=>call.route==='/images').length,1);assert.equal(h.panel.isDirty(),false);assert.ok(h.revoked.includes('blob:preview-1'));
  assert.equal(h.calls.find(call=>call.route==='/images').mime,'image/png');
});
test('painel só restaura após confirmação, recupera padrões e descarta prévias sem chamar produtos',async t=>{
  const h=adminEnvironment(t);await h.panel.load();h.set('hero-collection','Coleção alterada');h.choose('hero');
  const restore=h.root.querySelector('#restore-customization');await h.fire(restore,'click');assert.equal(h.panel.isDirty(),true);assert.equal(h.calls.some(call=>call.route.endsWith('/reset')),false);
  h.confirmations.push(true);await h.fire(restore,'click');assert.deepEqual(h.state().customization,defaultCustomization());assert.equal(h.panel.isDirty(),false);assert.ok(h.revoked.includes('blob:preview-1'));
  assert.ok(h.calls.every(call=>!call.route.startsWith('/products')));h.panel.reset();assert.equal(h.preview.childNodes.length,0);assert.equal(h.panel.isDirty(),false);
});
test('conflito mantém rascunho e recarregar exige confirmação antes de usar versão mais recente',async t=>{
  const h=adminEnvironment(t);await h.panel.load();h.set('hero-title','Rascunho local');const remote=defaultCustomization();remote.hero.title='Versão de outro acesso';h.remote({revision:1,customization:remote});
  h.confirmations.push(true);await h.fire(h.form,'submit');assert.equal(h.errors.length,1);assert.equal(h.fields.get('hero-title').value,'Rascunho local');assert.equal(h.panel.isDirty(),true);
  const reload=h.root.querySelector('#reload-customization');await h.fire(reload,'click');assert.equal(h.fields.get('hero-title').value,'Rascunho local');
  h.confirmations.push(true);await h.fire(reload,'click');assert.equal(h.fields.get('hero-title').value,'Versão de outro acesso');assert.equal(h.panel.isDirty(),false);
});
