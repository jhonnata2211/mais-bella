// <dialog>.showModal mantém o foco dentro do modal e torna o restante da página inerte.
export function setupDialog(dialog) {
  let trigger;
  function close() { dialog.close(); }
  dialog.querySelector('[data-close-dialog]').addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dialog.addEventListener('close', () => {
    trigger?.setAttribute('aria-expanded', 'false');
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
  return {
    open(button = document.activeElement) {
      if (dialog.open) return;
      trigger = button;
      dialog.showModal();
      trigger?.setAttribute('aria-expanded', 'true');
      dialog.querySelector('[data-close-dialog]').focus();
    },
    close
  };
}
