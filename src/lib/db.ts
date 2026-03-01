import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DrizzleAdapter } from './drizzle-adapter';
import dotenv from 'dotenv';

// Force load the .env file if we are in a bare Node context 
const configPath = join(dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: configPath });

const DATABASE_URL = process.env.DATABASE_URL || '';

// ──────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────
export interface Panel {
  id: number;
  name: string;
  position: number;
}

export interface PanelWithCount extends Panel {
  category_count: number;
}

export interface Category {
  id: number;
  panel_id: number;
  name: string;
  position: number;
}

export interface CategoryWithPanel extends Category {
  panel_name: string;
}

export interface Link {
  id: number;
  category_id: number;
  name: string;
  url: string;
  position: number;
  description: string | null;
}

export interface Backup {
  id: number;
  created_at: string;
  label: string;
  data?: string;
}

export interface Snapshot {
  panels: Panel[];
  categories: Category[];
  links: Link[];
}

// ──────────────────────────────────────────────────────
//  Database Adapter Interface
// ──────────────────────────────────────────────────────
export interface DatabaseAdapter {
  // Panels
  getPanels(): Promise<Panel[]>;
  getPanelsWithCounts(): Promise<PanelWithCount[]>;
  getPanel(id: string | number): Promise<Panel | null>;
  addPanel(name: string): Promise<{ lastInsertRowid: number | bigint }>;
  updatePanel(id: string | number, name: string): Promise<void>;
  deletePanel(id: string | number): Promise<void>;
  reorderPanels(ids: (string | number)[]): Promise<void>;

  // Categories
  getCategories(panelId?: string | number | null): Promise<Category[]>;
  getCategoriesWithPanel(): Promise<CategoryWithPanel[]>;
  getCategory(id: string | number): Promise<Category | null>;
  addCategory(name: string, panelId: string | number): Promise<{ lastInsertRowid: number | bigint }>;
  updateCategory(id: string | number, name: string): Promise<void>;
  deleteCategory(id: string | number): Promise<void>;
  moveCategory(categoryId: string | number, panelId: string | number): Promise<void>;
  reorderCategories(ids: (string | number)[]): Promise<void>;

  // Links
  getLinks(): Promise<Link[]>;
  getLink(id: string | number): Promise<Link | null>;
  addLink(categoryId: number, name: string, url: string, position: number, description: string | null): Promise<void>;
  updateLink(id: string | number, name: string, url: string, categoryId: number, description: string | null): Promise<void>;
  deleteLink(id: string | number): Promise<void>;
  reorderLinks(ids: (string | number)[], categoryId: string | number): Promise<void>;
  getMaxLinkPosition(): Promise<number>;

  // Backups
  getBackups(limit?: number): Promise<Backup[]>;
  getBackup(id: string | number): Promise<Backup | null>;
  createBackup(label: string, data: string): Promise<void>;
  deleteBackup(id: string | number): Promise<void>;
  pruneBackups(keep?: number): Promise<void>;
  restoreBackup(snapshot: Snapshot): Promise<void>;
  getBackupCount(): Promise<number>;

  // Snapshot (for sync engine)
  getFullSnapshot(): Promise<Snapshot>;

  // Utility
  syncSequences?(): Promise<void>;
}

// ──────────────────────────────────────────────────────
//  SQLite Adapter (Local)
// ──────────────────────────────────────────────────────
export class SqliteAdapter implements DatabaseAdapter {
  private db: InstanceType<typeof DatabaseSync>;

  constructor() {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const dataDir = join(__dirname, '../../data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    this.db = new DatabaseSync(join(dataDir, 'links.db'));
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS panels (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        name     TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS categories (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        panel_id INTEGER REFERENCES panels(id),
        name     TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS links (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        name        TEXT NOT NULL,
        url         TEXT NOT NULL,
        position    INTEGER NOT NULL DEFAULT 0,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS backups (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        label      TEXT,
        data       TEXT NOT NULL
      );
    `);

    // Migrations (safe to re-run)
    try { this.db.exec('ALTER TABLE categories ADD COLUMN panel_id INTEGER REFERENCES panels(id)'); } catch { }
    try { this.db.exec('ALTER TABLE categories ADD COLUMN position INTEGER NOT NULL DEFAULT 0'); } catch { }
    try { this.db.exec('ALTER TABLE links ADD COLUMN position INTEGER NOT NULL DEFAULT 0'); } catch { }
    try { this.db.exec('ALTER TABLE links ADD COLUMN description TEXT'); } catch { }

    // Ensure default panels exist
    const panelCount = this.db.prepare('SELECT COUNT(*) as count FROM panels').get() as { count: number };
    if (panelCount.count === 0) {
      this.db.exec("INSERT INTO panels (name, position) VALUES ('WORK', 1), ('LEARNING', 2), ('NEWS', 3)");
    }

    // Migrate categories without panel_id to the first panel
    const firstPanel = this.db.prepare('SELECT id FROM panels ORDER BY position LIMIT 1').get() as { id: number } | undefined;
    if (firstPanel) {
      this.db.exec(`UPDATE categories SET panel_id = ${firstPanel.id} WHERE panel_id IS NULL`);
    }

    this.db.exec('UPDATE categories SET position = id WHERE position = 0');
    this.db.exec('UPDATE links SET position = id WHERE position = 0');
  }

  // ── Panels ─────────────────────────────────────────
  async getPanels(): Promise<Panel[]> {
    return this.db.prepare('SELECT * FROM panels ORDER BY position ASC').all() as Panel[];
  }

  async getPanelsWithCounts(): Promise<PanelWithCount[]> {
    return this.db.prepare(`
      SELECT p.*, COUNT(c.id) as category_count 
      FROM panels p 
      LEFT JOIN categories c ON c.panel_id = p.id 
      GROUP BY p.id 
      ORDER BY p.position
    `).all() as PanelWithCount[];
  }

  async getPanel(id: string | number): Promise<Panel | null> {
    return (this.db.prepare('SELECT * FROM panels WHERE id = ?').get(id) as Panel) || null;
  }

  async addPanel(name: string): Promise<{ lastInsertRowid: number | bigint }> {
    const lastPanel = this.db.prepare('SELECT MAX(position) as maxPos FROM panels').get() as { maxPos: number | null };
    const newPos = (lastPanel?.maxPos ?? 0) + 1;
    const result = this.db.prepare('INSERT INTO panels (name, position) VALUES (?, ?)').run(name, newPos);
    return { lastInsertRowid: result.lastInsertRowid };
  }

  async updatePanel(id: string | number, name: string): Promise<void> {
    this.db.prepare('UPDATE panels SET name = ? WHERE id = ?').run(name, id);
  }

  async deletePanel(id: string | number): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db.prepare(`DELETE FROM links WHERE category_id IN (SELECT id FROM categories WHERE panel_id = ?)`).run(id);
      this.db.prepare('DELETE FROM categories WHERE panel_id = ?').run(id);
      this.db.prepare('DELETE FROM panels WHERE id = ?').run(id);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async reorderPanels(ids: (string | number)[]): Promise<void> {
    const update = this.db.prepare('UPDATE panels SET position = ? WHERE id = ?');
    this.db.exec('BEGIN');
    try {
      ids.forEach((id, idx) => update.run(idx + 1, id));
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ── Categories ─────────────────────────────────────
  async getCategories(panelId?: string | number | null): Promise<Category[]> {
    if (panelId) {
      return this.db.prepare('SELECT * FROM categories WHERE panel_id = ? ORDER BY position, id').all(panelId) as Category[];
    }
    return this.db.prepare('SELECT * FROM categories ORDER BY position, id').all() as Category[];
  }

  async getCategoriesWithPanel(): Promise<CategoryWithPanel[]> {
    return this.db.prepare(`
      SELECT c.*, p.name as panel_name 
      FROM categories c 
      LEFT JOIN panels p ON c.panel_id = p.id 
      ORDER BY p.position, c.position
    `).all() as CategoryWithPanel[];
  }

  async getCategory(id: string | number): Promise<Category | null> {
    return (this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category) || null;
  }

  async addCategory(name: string, panelId: string | number): Promise<{ lastInsertRowid: number | bigint }> {
    const maxRow = this.db.prepare('SELECT MAX(position) as max FROM categories WHERE panel_id = ?').get(panelId) as any;
    const position = (maxRow?.max ?? 0) + 1;
    const result = this.db.prepare('INSERT INTO categories (name, panel_id, position) VALUES (?, ?, ?)').run(name, panelId, position);
    return { lastInsertRowid: result.lastInsertRowid };
  }

  async updateCategory(id: string | number, name: string): Promise<void> {
    this.db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
  }

  async deleteCategory(id: string | number): Promise<void> {
    this.db.prepare('DELETE FROM links WHERE category_id = ?').run(id);
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  }

  async moveCategory(categoryId: string | number, panelId: string | number): Promise<void> {
    const lastPos = this.db.prepare('SELECT MAX(position) as maxPos FROM categories WHERE panel_id = ?').get(panelId) as { maxPos: number | null };
    const newPosition = (lastPos?.maxPos ?? 0) + 1;
    this.db.prepare('UPDATE categories SET panel_id = ?, position = ? WHERE id = ?').run(panelId, newPosition, categoryId);
  }

  async reorderCategories(ids: (string | number)[]): Promise<void> {
    const stmt = this.db.prepare('UPDATE categories SET position = ? WHERE id = ?');
    ids.forEach((id, index) => stmt.run(index, id));
  }

  // ── Links ──────────────────────────────────────────
  async getLinks(): Promise<Link[]> {
    return this.db.prepare('SELECT * FROM links ORDER BY position, id').all() as Link[];
  }

  async getLink(id: string | number): Promise<Link | null> {
    return (this.db.prepare('SELECT * FROM links WHERE id = ?').get(id) as Link) || null;
  }

  async addLink(categoryId: number, name: string, url: string, position: number, description: string | null): Promise<void> {
    this.db.prepare('INSERT INTO links (category_id, name, url, position, description) VALUES (?, ?, ?, ?, ?)').run(categoryId, name, url, position, description);
  }

  async updateLink(id: string | number, name: string, url: string, categoryId: number, description: string | null): Promise<void> {
    this.db.prepare('UPDATE links SET name = ?, url = ?, category_id = ?, description = ? WHERE id = ?').run(name, url, categoryId, description, id);
  }

  async deleteLink(id: string | number): Promise<void> {
    this.db.prepare('DELETE FROM links WHERE id = ?').run(id);
  }

  async reorderLinks(ids: (string | number)[], categoryId: string | number): Promise<void> {
    const stmt = this.db.prepare('UPDATE links SET position = ?, category_id = ? WHERE id = ?');
    ids.forEach((id, index) => stmt.run(index, categoryId, id));
  }

  async getMaxLinkPosition(): Promise<number> {
    const maxRow = this.db.prepare('SELECT MAX(position) as max FROM links').get() as any;
    return (maxRow?.max ?? 0);
  }

  // ── Backups ────────────────────────────────────────
  async getBackups(limit: number = 10): Promise<Backup[]> {
    return this.db.prepare('SELECT id, created_at, label FROM backups ORDER BY id DESC LIMIT ?').all(limit) as Backup[];
  }

  async getBackup(id: string | number): Promise<Backup | null> {
    return (this.db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as Backup) || null;
  }

  async createBackup(label: string, data: string): Promise<void> {
    this.db.prepare('INSERT INTO backups (label, data) VALUES (?, ?)').run(label, data);
  }

  async deleteBackup(id: string | number): Promise<void> {
    this.db.prepare('DELETE FROM backups WHERE id = ?').run(id);
  }

  async pruneBackups(keep: number = 10): Promise<void> {
    this.db.exec(`DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY id DESC LIMIT ${keep})`);
  }

  async getBackupCount(): Promise<number> {
    return ((this.db.prepare('SELECT COUNT(*) as c FROM backups').get() as any).c) as number;
  }

  async restoreBackup(snapshot: Snapshot): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM links');
      this.db.exec('DELETE FROM categories');
      this.db.exec('DELETE FROM panels');

      const insertPanel = this.db.prepare('INSERT INTO panels (id, name, position) VALUES (?, ?, ?)');
      for (const p of snapshot.panels) insertPanel.run(p.id, p.name, p.position);

      const insertCat = this.db.prepare('INSERT INTO categories (id, panel_id, name, position) VALUES (?, ?, ?, ?)');
      for (const c of snapshot.categories) insertCat.run(c.id, c.panel_id, c.name, c.position);

      const insertLink = this.db.prepare('INSERT INTO links (id, category_id, name, url, position, description) VALUES (?, ?, ?, ?, ?, ?)');
      for (const l of snapshot.links) insertLink.run(l.id, l.category_id, l.name, l.url, l.position, l.description);

      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ── Snapshot ────────────────────────────────────────
  async getFullSnapshot(): Promise<Snapshot> {
    const panels = this.db.prepare('SELECT * FROM panels ORDER BY position').all() as Panel[];
    const categories = this.db.prepare('SELECT * FROM categories ORDER BY position').all() as Category[];
    const links = this.db.prepare('SELECT * FROM links ORDER BY position').all() as Link[];
    return { panels, categories, links };
  }
}

// ──────────────────────────────────────────────────────
//  Dynamic Proxy Export
// ──────────────────────────────────────────────────────

let activeAdapter: DatabaseAdapter;

export function initializeAdapter(): void {
  console.log(`[DB] Initializing adapter: drizzle`);

  if (!DATABASE_URL) {
    console.error('[DB] CRITICAL ERROR: DATABASE_URL must be set in the environment.');
    // Keep a dummy adapter initialization to prevent crash before user provides config
    activeAdapter = new SqliteAdapter();
  } else {
    activeAdapter = new DrizzleAdapter(DATABASE_URL);
  }

  // Initialization hook for remote adapters if needed
  if (typeof (activeAdapter as any).init === 'function') {
    try {
      const initResult = (activeAdapter as any).init();
      if (initResult && typeof initResult.catch === 'function') {
        initResult.catch((e: any) => console.error('[DB] Adapter init error:', e));
      }
    } catch (e) {
      console.error('[DB] Synchronous Adapter init error:', e);
    }
  }
}

// Initialize on startup
initializeAdapter();

// We export a Proxy so we can re-initialize the adapter at runtime (e.g., when config changes)
// without breaking modules that have already imported `db`.
const dbProxy = new Proxy<DatabaseAdapter>({} as DatabaseAdapter, {
  get(target, prop) {
    if (prop === 'reinit') return initializeAdapter;
    const value = (activeAdapter as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activeAdapter);
    }
    return value;
  }
});

export default dbProxy as DatabaseAdapter & { reinit: () => void };
