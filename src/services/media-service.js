const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ValidationError } = require('./validation');
const { validateImage } = require('./image-validation');
const FILE_NAME = /^[a-f0-9]{32}\.(?:jpg|png|webp)$/;
const UPLOAD_REFERENCE = /^\/uploads\/products\/([a-f0-9]{32}\.(?:jpg|png|webp))$/;
const PENDING_TTL = 24 * 60 * 60 * 1000;
class MediaService {
  constructor(directory) { this.directory = directory; this.pending = path.join(directory, 'pending'); this.published = path.join(directory, 'products'); }
  directories() { for (const dir of [this.pending, this.published]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
  stage(buffer, mime) {
    const extension = validateImage(buffer, mime);
    this.directories();
    const pending = fs.readdirSync(this.pending).filter(name => FILE_NAME.test(name));
    if (pending.length >= 200) throw new ValidationError('Há muitas fotos aguardando cadastro. Conclua os cadastros ou peça à equipe para liberar espaço.');
    const id = crypto.randomBytes(16).toString('hex'), filename = `${id}.${extension}`;
    const target = path.join(this.pending, filename);
    try { fs.writeFileSync(target, buffer, { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') { try { fs.unlinkSync(target); } catch {} } throw error; }
    return { id, type: 'image', src: '/uploads/products/' + filename, alt: 'Foto do produto' };
  }
  // Copia antes do commit; mantém o temporário para uma tentativa posterior caso o banco falhe.
  prepare(images, previous = []) {
    const created = [], consumed = [], seen = new Set();
    const allowed = new Set(previous.map(image => image.src));
    const rollback = () => { for (const filename of created) { try { fs.unlinkSync(path.join(this.published, filename)); } catch {} } };
    try {
      for (const image of images) {
        if (image.type !== 'image' || !image.src.startsWith('/uploads/')) continue;
        if (seen.has(image.src)) throw new ValidationError('Não repita a mesma foto na galeria.');
        seen.add(image.src);
        const match = UPLOAD_REFERENCE.exec(image.src);
        if (!match) throw new ValidationError('Referência de foto inválida.');
        const filename = match[1], staged = path.join(this.pending, filename), published = path.join(this.published, filename);
        if (allowed.has(image.src) && fs.existsSync(published)) continue;
        if (!fs.existsSync(staged)) throw new ValidationError('Uma foto não está mais disponível. Remova-a e selecione novamente.');
        if (Date.now() - fs.statSync(staged).mtimeMs > PENDING_TTL) throw new ValidationError('Uma foto expirou antes de salvar. Remova-a e selecione novamente.');
        this.directories();
        fs.copyFileSync(staged, published, fs.constants.COPYFILE_EXCL); created.push(filename); consumed.push(filename);
      }
    } catch (error) { rollback(); throw error; }
    return {
      rollback,
      commit: () => { for (const filename of consumed) { try { fs.unlinkSync(path.join(this.pending, filename)); } catch {} } }
    };
  }
  // Executar manutenção com o servidor parado. O banco é a fonte das referências vivas.
  cleanup(db, apply = false, now = Date.now()) {
    const live = new Set(db.prepare("SELECT reference FROM product_images WHERE kind='image'").all().map(row => row.reference));
    const candidates = [];
    for (const [folder, directory] of [['pending', this.pending], ['products', this.published]]) {
      if (!fs.existsSync(directory)) continue;
      for (const filename of fs.readdirSync(directory)) {
        if (!FILE_NAME.test(filename)) continue;
        const file = path.join(directory, filename), stat = fs.lstatSync(file);
        if (!stat.isFile() || now - stat.mtimeMs < PENDING_TTL || folder === 'products' && live.has('/uploads/products/' + filename)) continue;
        candidates.push(`${folder}/${filename}`);
        if (apply) fs.unlinkSync(file);
      }
    }
    return { apply, count: candidates.length };
  }
}
module.exports = { MediaService, FILE_NAME, UPLOAD_REFERENCE, PENDING_TTL };
