// Comandos offline também podem ler backups anteriores à migration 003.
function hasCustomization(db) { return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='store_customization_images'").get()); }
function customizationReferences(db) { return hasCustomization(db) ? db.prepare('SELECT DISTINCT reference FROM store_customization_images').all().map(row => row.reference) : []; }
function imageReferences(db) {
  return [...new Set([...db.prepare("SELECT reference FROM product_images WHERE kind='image'").all().map(row => row.reference), ...customizationReferences(db)])];
}
function isImageReferenced(db, reference) {
  return Boolean(db.prepare('SELECT 1 FROM product_images WHERE reference=? LIMIT 1').get(reference) || hasCustomization(db) && db.prepare('SELECT 1 FROM store_customization_images WHERE reference=? LIMIT 1').get(reference));
}
module.exports = { imageReferences, customizationReferences, isImageReferenced };
