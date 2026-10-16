const { defaultCustomization, customizationImages } = require('../../public/js/customization-model.mjs');
class CustomizationRepository {
  constructor(db) { this.db = db; }
  get() {
    const row = this.db.prepare('SELECT payload,revision FROM store_customization WHERE id=1').get();
    return row ? { customization: JSON.parse(row.payload), revision: row.revision } : { customization: defaultCustomization(), revision: 0 };
  }
  save(customization, revision) {
    this.db.prepare(`INSERT INTO store_customization (id,payload,revision,updated_at) VALUES (1,?,?,?)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at`)
      .run(JSON.stringify(customization), revision, new Date().toISOString());
    this.db.prepare('DELETE FROM store_customization_images').run();
    const insert = this.db.prepare('INSERT INTO store_customization_images (slot,reference) VALUES (?,?)');
    for (const image of customizationImages(customization)) insert.run(image.slot, image.src);
  }
}
module.exports = { CustomizationRepository };
