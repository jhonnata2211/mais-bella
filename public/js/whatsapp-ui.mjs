import { storeConfig } from './config.mjs';
import { isStoreNumberValid, whatsappLink, WHATSAPP_UNAVAILABLE } from './whatsapp.mjs';

export function bindWhatsAppButton(button, message, notify, number = storeConfig.whatsappNumber) {
  const configured = isStoreNumberValid(number);
  button.setAttribute('aria-disabled', String(!configured));
  button.addEventListener('click', () => {
    const url = whatsappLink(typeof message === 'function' ? message() : message, number);
    if (!url) { notify(WHATSAPP_UNAVAILABLE); return; }
    // Navegação acionada pela cliente. O texto ainda precisa ser enviado no WhatsApp.
    window.location.assign(url);
  });
}

export function initFloatingWhatsApp(notify) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'whatsapp-floating';
  button.setAttribute('aria-label', isStoreNumberValid(storeConfig.whatsappNumber)
    ? 'Falar com a Mais Bella pelo WhatsApp' : 'WhatsApp comercial ainda não configurado; consultar status');
  // Símbolo vetorial local; o nome acessível fica no aria-label do botão.
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.52 3.48A11.91 11.91 0 0 0 12.05 0C5.46 0 .1 5.36.1 11.95c0 2.11.55 4.17 1.6 5.99L0 24l6.23-1.63a11.94 11.94 0 0 0 5.81 1.48h.01C18.64 23.85 24 18.49 24 11.9c0-3.19-1.24-6.19-3.48-8.42ZM12.05 21.83h-.01a9.92 9.92 0 0 1-5.06-1.39l-.36-.21-3.7.97.99-3.61-.24-.37a9.9 9.9 0 0 1-1.52-5.27c0-5.48 4.46-9.94 9.95-9.94a9.88 9.88 0 0 1 7.03 2.92 9.88 9.88 0 0 1 2.91 7.04c0 5.48-4.47 9.86-9.99 9.86Zm5.45-7.43c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.11 3.22 5.11 4.51.71.31 1.27.49 1.71.62.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/></svg>';
  document.body.append(button);
  document.body.classList.add('has-whatsapp-contact');
  const greeting = 'Olá! Gostaria de atendimento na Mais Bella ♥️';
  bindWhatsAppButton(button, greeting, notify);
  document.querySelectorAll('[data-whatsapp-contact]').forEach(control => bindWhatsAppButton(control, greeting, notify));

  // Posição e camada são estáticas no CSS. Scroll não altera visibilidade ou geometria.
}
