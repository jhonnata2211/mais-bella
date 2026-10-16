const { transaction } = require('../db/database');
const { ValidationError } = require('./validation');
const { defaultCustomization, validateCustomization, customizationImages } = require('../../public/js/customization-model.mjs');
const { CustomizationRepository } = require('../repositories/customization-repository');
class CustomizationService {
  constructor(db, media) { this.db = db; this.repository = new CustomizationRepository(db); this.media = media; }
  get() { return this.repository.get(); }
  save(input, reset = false) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !Number.isSafeInteger(input.revision) || input.revision < 0 || Object.keys(input).some(key => !(reset ? ['revision'] : ['revision','customization']).includes(key))) throw new ValidationError('Confira os campos da personalização.');
    let customization;
    try { customization = reset ? defaultCustomization() : validateCustomization(input.customization); }
    catch (error) { throw new ValidationError(error.message); }
    let publication;
    try {
      transaction(this.db, () => {
        const current = this.get();
        if (current.revision !== input.revision) {
          const error = new Error('A personalização mudou em outro acesso. Use “Recarregar versão salva” e revise antes de salvar.'); error.status = 409; throw error;
        }
        const unique = images => [...new Map(images.map(image => [image.src, image])).values()];
        const images = unique(customizationImages(customization));
        if (images.length && !this.media) throw new ValidationError('Armazenamento de imagens indisponível.');
        if (this.media) publication = this.media.prepare(images, unique(customizationImages(current.customization)));
        this.repository.save(customization, current.revision + 1);
      });
    } catch (error) { publication?.rollback(); throw error; }
    publication?.commit(); return this.get();
  }
}
module.exports = { CustomizationService };
