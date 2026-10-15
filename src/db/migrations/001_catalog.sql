CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 0 AND 2147483647),
  promotional_price_cents INTEGER CHECK(promotional_price_cents >= 0 AND promotional_price_cents < price_cents),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  is_new INTEGER NOT NULL DEFAULT 0 CHECK(is_new IN (0,1)),
  best_seller INTEGER NOT NULL DEFAULT 0 CHECK(best_seller IN (0,1)),
  demo INTEGER NOT NULL DEFAULT 0 CHECK(demo IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX products_category_active ON products(category_id, active);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  alt TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  kind TEXT NOT NULL CHECK(kind IN ('image','illustration')),
  tone TEXT,
  shape TEXT
) STRICT;
CREATE INDEX product_images_order ON product_images(product_id, sort_order);
CREATE UNIQUE INDEX product_images_one_primary ON product_images(product_id) WHERE is_primary = 1;

CREATE TABLE product_variations (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  stock INTEGER NOT NULL CHECK(stock BETWEEN 0 AND 1000000),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0),
  UNIQUE(product_id, color, size)
) STRICT;
CREATE INDEX product_variations_order ON product_variations(product_id, active, sort_order);

-- Registra quais conjuntos de demonstração já foram aplicados, mesmo se editados depois.
CREATE TABLE seed_runs (
  name TEXT PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;
