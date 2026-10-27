-- D1 schema for the muhammednabi database. Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,          -- e.g. /personality/peace-on-earth (decoded)
  date TEXT NOT NULL,                 -- ISO datetime
  title TEXT NOT NULL,                -- HTML-entity encoded, as exported
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,              -- HTML
  image TEXT,                         -- /uploads/... (served from R2), NULL when the post has no photo
  categories TEXT NOT NULL,           -- JSON array of category ids, first one is the primary
  author TEXT NOT NULL DEFAULT '',
  author_slug TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS posts_date ON posts (date DESC);
CREATE INDEX IF NOT EXISTS posts_author ON posts (author_slug);
