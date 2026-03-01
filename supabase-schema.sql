-- Supabase Schema for Mission Control
-- Paste this into the Supabase SQL Editor and click 'Run'

CREATE TABLE IF NOT EXISTS panels (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id       SERIAL PRIMARY KEY,
  panel_id INTEGER REFERENCES panels(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS links (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS backups (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label      TEXT,
  data       TEXT NOT NULL
);

-- Enable Row Level Security (RLS) but allow anon access since we secure the app server-side
ALTER TABLE panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon on panels" ON panels FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anon on categories" ON categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anon on links" ON links FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anon on backups" ON backups FOR ALL TO anon USING (true) WITH CHECK (true);
