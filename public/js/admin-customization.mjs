import { CATEGORY_SLOTS, BUTTON_DESTINATIONS, validateCustomization } from './customization-model.mjs';
import { checkPhotoSelection, photoType } from './admin-gallery.mjs';

export function initCustomizationPanel({ api, task, confirm, feedback }) {
  const form = document.querySelector('#customization-form');
  const get = name => form.elements.namedItem(name);
  const locations = ['hero', ...CATEGORY_SLOTS.map(slot => slot.id)];
  let saved = null, revision = 0, baseline = null, images = {}, attachments = new Map();
  const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
  const clone = value => JSON.parse(JSON.stringify(value));
  const inputName = (slot, field) => slot + '-' + field;
  function clearFiles() { for (const item of attachments.values()) URL.revokeObjectURL(item.preview); attachments.clear(); for (const input of form.querySelectorAll('[type=file]')) input.value = ''; }
  function draft() {
    const hero = Object.fromEntries(['collection','title','description','buttonText','buttonHref'].map(key => [key, get('hero-' + key).value]));
    const image = slot => images[slot] ? { src: images[slot].src, alt: get(inputName(slot, 'alt')).value } : null;
    hero.image = image('hero');
    return { hero, categories: Object.fromEntries(CATEGORY_SLOTS.map(slot => [slot.id, { label: get(inputName(slot.id, 'label')).value, image: image(slot.id) }])) };
  }
  function fingerprint() { return JSON.stringify([draft(), [...attachments].map(([slot,item]) => [slot,item.file.name,item.file.size,item.file.lastModified])]); }
  const isDirty = () => baseline !== null && baseline !== fingerprint();
  function render() {
    if (!saved) return;
    const value = draft();
    document.querySelector('#customization-draft').hidden = !isDirty();
    const preview = document.querySelector('#customization-preview'); preview.replaceChildren();
    preview.append(node('p','eyebrow',value.hero.collection),node('h2','custom-preview-title',value.hero.title),node('p','custom-preview-copy',value.hero.description),node('span','custom-preview-button',value.hero.buttonText));
    preview.append(node('p','caption','Destino: ' + (BUTTON_DESTINATIONS.find(item => item.href === value.hero.buttonHref)?.label || 'Escolha um destino')));
    const cards = node('div','custom-preview-categories');
    for (const slot of locations) {
      const target = document.querySelector('[data-custom-photo="' + slot + '"]'); target.replaceChildren();
      const src = attachments.get(slot)?.preview || images[slot]?.src;
      const label = slot === 'hero' ? value.hero.collection : value.categories[slot].label;
      get(inputName(slot,'alt')).required = Boolean(src);
      const visual = () => {
        if (!src) return node('div','custom-default-art','Ilustração padrão');
        const img = node('img','custom-photo'); img.src = src; img.alt = get(inputName(slot,'alt')).value || label;
        return img;
      };
      target.append(visual());
      const box = node('div',slot === 'hero' ? 'custom-preview-hero' : 'custom-preview-category');
      box.append(visual()); if (slot !== 'hero') box.append(node('p','',label));
      if (slot === 'hero') preview.prepend(box); else cards.append(box);
    }
    preview.append(cards);
  }
  function populate(value) {
    clearFiles(); images = Object.fromEntries(locations.map(slot => [slot, slot === 'hero' ? value.hero.image : value.categories[slot].image]));
    for (const key of ['collection','title','description','buttonText','buttonHref']) get('hero-' + key).value = value.hero[key];
    for (const slot of CATEGORY_SLOTS) get(inputName(slot.id,'label')).value = value.categories[slot.id].label;
    for (const slot of locations) get(inputName(slot,'alt')).value = images[slot]?.alt || (slot === 'hero' ? 'Foto da coleção Mais Bella' : 'Coleção de ' + value.categories[slot].label);
    baseline = fingerprint(); render();
  }
  function receive(data) {
    if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw Error('Não foi possível ler a personalização. Tente novamente.');
    saved = validateCustomization(data.customization); revision = data.revision; populate(saved);
  }
  // Controles de imagem iguais para o banner e os quatro espaços editoriais.
  for (const slot of locations) {
    const section = document.querySelector('[data-custom-section="' + slot + '"]');
    const input = node('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true; input.setAttribute('aria-label','Escolher imagem para ' + (slot === 'hero' ? 'o banner principal' : CATEGORY_SLOTS.find(item => item.id === slot).label));
    const choose = node('button','secondary-button','Escolher imagem'); choose.type = 'button'; choose.addEventListener('click',() => input.click());
    const remove = node('button','text-button','Usar ilustração padrão'); remove.type = 'button';
    remove.addEventListener('click',() => { const old=attachments.get(slot); if(old) URL.revokeObjectURL(old.preview); attachments.delete(slot); images[slot]=null; input.value=''; render(); });
    input.addEventListener('change',() => {
      const file = input.files?.[0]; if (!file) return;
      try {
        checkPhotoSelection([file],0);
        const previous = attachments.get(slot); if (previous) URL.revokeObjectURL(previous.preview);
        attachments.set(slot,{file,preview:URL.createObjectURL(file)}); render(); feedback('',false,false);
      } catch(error) { feedback(error.message,true); }
      finally { input.value=''; }
    });
    section.querySelector('[data-custom-controls]').append(input,choose,remove);
  }
  for (const option of BUTTON_DESTINATIONS) { const element=node('option','',option.label); element.value=option.href; get('hero-buttonHref').append(element); }
  form.addEventListener('invalid', event => {
    let parent = event.target.parentElement;
    while (parent && parent !== form) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }, true);
  form.addEventListener('input', render); form.addEventListener('change', render);
  form.addEventListener('submit', event => {
    event.preventDefault(); if (!form.reportValidity() || !saved) return;
    task('Salvando personalização…',async () => {
      validateCustomization(draft());
      if (!await confirm('Salvar personalização?', 'As alterações aparecerão na página inicial da loja.', 'Salvar')) return;
      for (const [slot,item] of attachments) {
        if (!item.uploaded) item.uploaded = (await api('/images','POST',item.file,photoType(item.file))).image;
        images[slot] = { src:item.uploaded.src, alt:get(inputName(slot,'alt')).value };
      }
      const customization=validateCustomization(draft());
      receive(await api('/customization','PUT',{revision,customization}));
      feedback('Personalização salva. Sua página inicial foi atualizada.');
    });
  });
  document.querySelector('#restore-customization').addEventListener('click',() => task('Restaurando a loja…',async () => {
    if (!saved || !await confirm('Restaurar os valores padrão?', 'Textos e ilustrações originais voltarão à página inicial. As alterações não salvas serão descartadas. Produtos e fotografias cadastradas serão preservados.', 'Restaurar padrão')) return;
    receive(await api('/customization/reset','POST',{revision})); feedback('A página inicial voltou aos valores padrão.');
  }));
  document.querySelector('#reload-customization').addEventListener('click',() => task('Carregando personalização…',async () => {
    if (isDirty() && !await confirm('Descartar alterações?', 'Vamos carregar a versão salva da personalização. As mudanças ainda não salvas serão descartadas.', 'Recarregar')) return;
    receive(await api('/customization')); feedback('Versão salva carregada.');
  }));
  return {
    isDirty,
    async load() { if (!isDirty()) receive(await api('/customization')); },
    discard() { if(saved) populate(saved); },
    reset() { clearFiles(); saved=null; baseline=null; revision=0; images={}; form.reset(); document.querySelector('#customization-preview').replaceChildren(); }
  };
}
