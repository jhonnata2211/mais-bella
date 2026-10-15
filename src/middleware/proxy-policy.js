const { isIP } = require('node:net');

function configureProxy(app, mode) {
  if (mode === 'loopback') app.set('trust proxy', 'loopback');
  if (mode !== 'railway') return;
  // Opt-in somente no runtime Railway. Fronteira de confiança: ingresso HTTP da
  // plataforma, sem acesso direto/TCP à porta e sem serviços privados não confiáveis.
  // Não há CIDRs de ingresso estáveis publicados: não inventar allowlist de IPs.
  // Confia só no salto adjacente; não em todos os endereços de uma cadeia fornecida.
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    // Railway documenta X-Real-IP como IP remoto do cliente, não a composição de
    // X-Forwarded-For. Ignora cadeias anteriores para evitar evasão do rate limit.
    // O ingresso deve substituir X-Real-IP e X-Forwarded-Proto vindos do cliente.
    const realIP = req.get('x-real-ip');
    if (typeof realIP === 'string' && isIP(realIP)) req.headers['x-forwarded-for'] = realIP;
    else delete req.headers['x-forwarded-for']; // fallback conservador: IP do socket
    next();
  });
}
module.exports = { configureProxy };
