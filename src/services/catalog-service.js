const { ValidationError, validateProduct, validateCategory, parseFilters, slug } = require('./validation');
const { transaction } = require('../db/database');

class CatalogService {
  constructor(repository) { this.repository = repository; }
  listProducts(query) { return this.repository.listProducts(parseFilters(query)); }
  findProduct(value) { return this.repository.findProduct(slug(value)); }
  listCategories() { return this.repository.listCategories(); }
  // Somente funções internas. Nenhuma rota pública de escrita é disponibilizada.
  createCategory(input) {
    const category = validateCategory(input);
    this.repository.insertCategory(category);
    return category;
  }
  createProduct(input) {
    const product = validateProduct(input);
    if (!this.repository.categoryById(product.categoryId)) throw new ValidationError('Categoria inexistente');
    transaction(this.repository.db, () => this.repository.insertProduct(product));
    return product;
  }
}
module.exports = { CatalogService };
