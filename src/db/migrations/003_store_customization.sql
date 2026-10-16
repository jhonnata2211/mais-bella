-- Somente novas tabelas. Não atualiza categorias, produtos ou referências existentes.
CREATE TABLE store_customization (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  revision INTEGER NOT NULL CHECK(revision > 0),
  updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE store_customization_images (
  slot TEXT PRIMARY KEY NOT NULL CHECK(slot IN ('hero','vestidos','conjuntos','blusas','calcas')),
  customization_id INTEGER NOT NULL DEFAULT 1 CHECK(customization_id = 1) REFERENCES store_customization(id),
  reference TEXT NOT NULL
) STRICT;
CREATE INDEX store_customization_image_reference ON store_customization_images(reference);
