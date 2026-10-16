const { ValidationError } = require('../services/validation');
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (req.imageUpload && error.type === 'entity.too.large') return res.status(413).json({ error: 'Esta imagem é muito grande. O limite é 5 MiB por foto.' });
  if (req.imageUpload && error.status === 415) return res.status(400).json({ error: 'Envie a foto sem compactação HTTP, em JPEG, PNG ou WebP.' });
  if (error.status === 503) return res.status(503).set('Retry-After','5').json({ error: 'Uma operação de segurança está em andamento. Aguarde e tente novamente.' });
  if (error.status === 409) return res.status(409).json({ error: 'A personalização mudou em outro acesso. Use “Recarregar versão salva” e revise antes de salvar.' });
  if (error.status === 404) return res.status(404).json({ error: 'Registro não encontrado' });
  if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Corpo da requisição excede o limite' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (error instanceof URIError) return res.status(400).json({ error: 'Parâmetro inválido' });
  // Nunca serializar error, stack, consultas, caminhos ou o corpo da requisição.
  const kind = error.code === 'ERR_SQLITE_ERROR' ? 'database' : error.code === 'ENOSPC' ? 'storage_full' : 'internal';
  console.error(JSON.stringify({ event: 'request_failed', method: req.method, operation: typeof req.route?.path === 'string' ? req.route.path : 'unknown', kind, status: 500 }));
  res.status(500).json({ error: 'Não foi possível concluir a solicitação' });
}
module.exports = { errorHandler };
