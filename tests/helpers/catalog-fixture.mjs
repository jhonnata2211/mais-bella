// Apenas testes de lógica existentes. No navegador, os mesmos módulos recebem a API.
import { products as demoProducts } from '../../src/db/seed-products.mjs';
import { replaceCatalog, products } from '../../public/js/data/products.mjs';
const fixture = structuredClone(demoProducts);
const categories = [...new Set(fixture.map(product => product.category))].map((name, index) => ({ id: `fixture-${index}`, slug: `fixture-${index}`, name }));
replaceCatalog(fixture, categories);
export { products };
