export const FAVORITES_KEY = 'maisbella:favorites:v1';

export function clearStoredKey(storage, key) {
  if (!storage) return false;
  try {
    if (typeof storage.removeItem === 'function') storage.removeItem(key);
    else storage.setItem(key, '[]');
    return true;
  } catch { return false; }
}

export async function clearShoppingData({ cart, favorites, storage, confirm }) {
  if (!await confirm()) return { cleared: false };
  favorites.clear();
  const favoritesSaved = clearStoredKey(storage, FAVORITES_KEY);
  const cartSaved = cart.clear();
  return { cleared: true, persistent: favoritesSaved && cartSaved };
}

export function clearPersonalForm(form) {
  form.reset();
  // Não depende de valores restaurados pelo navegador ou de defaults alterados.
  for (const control of form.elements) {
    if (['name', 'phone', 'city', 'neighborhood', 'deliveryNote'].includes(control.name)) control.value = '';
    if (control.name === 'receiving') control.checked = false;
  }
}

export async function clearPersonalData({ form, confirm }) {
  if (!await confirm()) return false;
  clearPersonalForm(form); return true;
}

// Um modal pequeno, com texto seguro, cancelamento por Escape e foco restaurado.
export function confirmPrivacyAction(title, description, accept = 'Limpar') {
  return new Promise(resolve => {
    const trigger = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'privacy-dialog';
    dialog.setAttribute('aria-labelledby', 'privacy-confirm-title');
    dialog.setAttribute('aria-describedby', 'privacy-confirm-description');
    const heading = document.createElement('h2'); heading.id = 'privacy-confirm-title'; heading.textContent = title;
    const copy = document.createElement('p'); copy.id = 'privacy-confirm-description'; copy.textContent = description;
    const form = document.createElement('form'); form.method = 'dialog'; form.className = 'privacy-dialog-actions';
    const cancel = document.createElement('button'); cancel.className = 'text-button'; cancel.value = 'cancel'; cancel.textContent = 'Cancelar';
    const button = document.createElement('button'); button.className = 'button'; button.value = 'clear'; button.textContent = accept;
    form.append(cancel, button); dialog.append(heading, copy, form); document.body.append(dialog);
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'clear'; dialog.remove();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      resolve(confirmed);
    }, { once: true });
    dialog.showModal(); cancel.focus();
  });
}
