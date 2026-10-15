const { validateCategory, validateProduct, ValidationError } = require('./validation');
const { transaction } = require('../db/database');
function missing() { const error = new Error('Registro não encontrado'); error.status = 404; throw error; }
class AdminService {
  constructor(repository) { this.repository = repository; }
  product(id) { return this.repository.product(id) || missing(); }
  saveCategory(input, id) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError();
    if (id && !this.repository.categories().some(c => c.id === id)) missing();
    if (id && input.id !== id) throw new ValidationError('ID não pode ser alterado');
    const c = validateCategory(input);
    this.write(() => id ? this.repository.updateCategory(c) : this.repository.insertCategory(c));
    return c;
  }
  saveProduct(input, id) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError();
    const old = id ? this.product(id) : null;
    if (id && input.id !== id) throw new ValidationError('ID não pode ser alterado');
    const p = validateProduct({ ...input, demo: old ? old.demo : false, createdAt: old ? old.createdAt : new Date().toISOString() });
    if (!this.repository.categoryById(p.categoryId)) throw new ValidationError('Categoria inexistente');
    this.write(() => id ? this.repository.updateProduct(p) : this.repository.insertProduct(p));
    return this.product(p.id);
  }
  write(action) {
    try { return transaction(this.repository.db, action); }
    catch (e) { if (String(e.code).startsWith('ERR_SQLITE') && /UNIQUE|FOREIGN KEY|CHECK/.test(e.message)) throw new ValidationError('Dados em conflito ou inválidos'); throw e; }
  }
}
module.exports = { AdminService };
