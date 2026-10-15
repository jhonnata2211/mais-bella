-- A senha inicial vem do ambiente; alterações posteriores persistem somente o hash.
CREATE TABLE admin_credentials (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
