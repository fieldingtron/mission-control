/**
 * TursoAdapter — Implements DatabaseAdapter using @libsql/client
 * Turso uses libSQL, which is SQLite-compatible, so the queries are identical 
 * to the SqliteAdapter but executed via HTTP.
 */
import { createClient, type Client } from '@libsql/client';
import type { DatabaseAdapter, Panel, PanelWithCount, Category, CategoryWithPanel, Link, Backup, Snapshot } from './db';

export class TursoAdapter implements DatabaseAdapter {
    private client: Client;

    constructor(url: string, authToken: string) {
        this.client = createClient({ url, authToken });
    }

    async init(): Promise<void> {
        await this.client.executeMultiple(`
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
    }

    // Helper to extract rows from libSQL result
    private rows<T>(result: any): T[] {
        return (result.rows || []) as T[];
    }

    private row<T>(result: any): T | null {
        const rows = result.rows || [];
        return rows.length > 0 ? (rows[0] as T) : null;
    }

    // ── Panels ─────────────────────────────────────────
    async getPanels(): Promise<Panel[]> {
        const r = await this.client.execute('SELECT * FROM panels ORDER BY position ASC');
        return this.rows<Panel>(r);
    }

    async getPanelsWithCounts(): Promise<PanelWithCount[]> {
        const r = await this.client.execute(`
      SELECT p.*, COUNT(c.id) as category_count 
      FROM panels p LEFT JOIN categories c ON c.panel_id = p.id 
      GROUP BY p.id ORDER BY p.position
    `);
        return this.rows<PanelWithCount>(r);
    }

    async getPanel(id: string | number): Promise<Panel | null> {
        const r = await this.client.execute({ sql: 'SELECT * FROM panels WHERE id = ?', args: [Number(id)] });
        return this.row<Panel>(r);
    }

    async addPanel(name: string): Promise<{ lastInsertRowid: number | bigint }> {
        const maxR = await this.client.execute('SELECT MAX(position) as maxPos FROM panels');
        const maxPos = (this.row<any>(maxR))?.maxPos ?? 0;
        const r = await this.client.execute({ sql: 'INSERT INTO panels (name, position) VALUES (?, ?)', args: [name, maxPos + 1] });
        return { lastInsertRowid: r.lastInsertRowid! };
    }

    async updatePanel(id: string | number, name: string): Promise<void> {
        await this.client.execute({ sql: 'UPDATE panels SET name = ? WHERE id = ?', args: [name, Number(id)] });
    }

    async deletePanel(id: string | number): Promise<void> {
        const nid = Number(id);
        await this.client.executeMultiple(`
      DELETE FROM links WHERE category_id IN (SELECT id FROM categories WHERE panel_id = ${nid});
      DELETE FROM categories WHERE panel_id = ${nid};
      DELETE FROM panels WHERE id = ${nid};
    `);
    }

    async reorderPanels(ids: (string | number)[]): Promise<void> {
        const batch = ids.map((id, idx) => ({
            sql: 'UPDATE panels SET position = ? WHERE id = ?',
            args: [idx + 1, Number(id)]
        }));
        await this.client.batch(batch as any);
    }

    // ── Categories ─────────────────────────────────────
    async getCategories(panelId?: string | number | null): Promise<Category[]> {
        if (panelId) {
            const r = await this.client.execute({ sql: 'SELECT * FROM categories WHERE panel_id = ? ORDER BY position, id', args: [Number(panelId)] });
            return this.rows<Category>(r);
        }
        const r = await this.client.execute('SELECT * FROM categories ORDER BY position, id');
        return this.rows<Category>(r);
    }

    async getCategoriesWithPanel(): Promise<CategoryWithPanel[]> {
        const r = await this.client.execute(`
      SELECT c.*, p.name as panel_name FROM categories c 
      LEFT JOIN panels p ON c.panel_id = p.id 
      ORDER BY p.position, c.position
    `);
        return this.rows<CategoryWithPanel>(r);
    }

    async getCategory(id: string | number): Promise<Category | null> {
        const r = await this.client.execute({ sql: 'SELECT * FROM categories WHERE id = ?', args: [Number(id)] });
        return this.row<Category>(r);
    }

    async addCategory(name: string, panelId: string | number): Promise<{ lastInsertRowid: number | bigint }> {
        const maxR = await this.client.execute({ sql: 'SELECT MAX(position) as max FROM categories WHERE panel_id = ?', args: [Number(panelId)] });
        const position = ((this.row<any>(maxR))?.max ?? 0) + 1;
        const r = await this.client.execute({ sql: 'INSERT INTO categories (name, panel_id, position) VALUES (?, ?, ?)', args: [name, Number(panelId), position] });
        return { lastInsertRowid: r.lastInsertRowid! };
    }

    async updateCategory(id: string | number, name: string): Promise<void> {
        await this.client.execute({ sql: 'UPDATE categories SET name = ? WHERE id = ?', args: [name, Number(id)] });
    }

    async deleteCategory(id: string | number): Promise<void> {
        const nid = Number(id);
        await this.client.batch([
            { sql: 'DELETE FROM links WHERE category_id = ?', args: [nid] },
            { sql: 'DELETE FROM categories WHERE id = ?', args: [nid] }
        ] as any);
    }

    async moveCategory(categoryId: string | number, panelId: string | number): Promise<void> {
        const maxR = await this.client.execute({ sql: 'SELECT MAX(position) as maxPos FROM categories WHERE panel_id = ?', args: [Number(panelId)] });
        const newPosition = ((this.row<any>(maxR))?.maxPos ?? 0) + 1;
        await this.client.execute({ sql: 'UPDATE categories SET panel_id = ?, position = ? WHERE id = ?', args: [Number(panelId), newPosition, Number(categoryId)] });
    }

    async reorderCategories(ids: (string | number)[]): Promise<void> {
        const batch = ids.map((id, index) => ({
            sql: 'UPDATE categories SET position = ? WHERE id = ?',
            args: [index, Number(id)]
        }));
        await this.client.batch(batch as any);
    }

    // ── Links ──────────────────────────────────────────
    async getLinks(): Promise<Link[]> {
        const r = await this.client.execute('SELECT * FROM links ORDER BY position, id');
        return this.rows<Link>(r);
    }

    async getLink(id: string | number): Promise<Link | null> {
        const r = await this.client.execute({ sql: 'SELECT * FROM links WHERE id = ?', args: [Number(id)] });
        return this.row<Link>(r);
    }

    async addLink(categoryId: number, name: string, url: string, position: number, description: string | null): Promise<void> {
        await this.client.execute({ sql: 'INSERT INTO links (category_id, name, url, position, description) VALUES (?, ?, ?, ?, ?)', args: [categoryId, name, url, position, description] });
    }

    async updateLink(id: string | number, name: string, url: string, categoryId: number, description: string | null): Promise<void> {
        await this.client.execute({ sql: 'UPDATE links SET name = ?, url = ?, category_id = ?, description = ? WHERE id = ?', args: [name, url, categoryId, description, Number(id)] });
    }

    async deleteLink(id: string | number): Promise<void> {
        await this.client.execute({ sql: 'DELETE FROM links WHERE id = ?', args: [Number(id)] });
    }

    async reorderLinks(ids: (string | number)[], categoryId: string | number): Promise<void> {
        const batch = ids.map((id, index) => ({
            sql: 'UPDATE links SET position = ?, category_id = ? WHERE id = ?',
            args: [index, Number(categoryId), Number(id)]
        }));
        await this.client.batch(batch as any);
    }

    async getMaxLinkPosition(): Promise<number> {
        const r = await this.client.execute('SELECT MAX(position) as max FROM links');
        return (this.row<any>(r))?.max ?? 0;
    }

    // ── Backups ────────────────────────────────────────
    async getBackups(limit: number = 10): Promise<Backup[]> {
        const r = await this.client.execute({ sql: 'SELECT id, created_at, label FROM backups ORDER BY id DESC LIMIT ?', args: [limit] });
        return this.rows<Backup>(r);
    }

    async getBackup(id: string | number): Promise<Backup | null> {
        const r = await this.client.execute({ sql: 'SELECT * FROM backups WHERE id = ?', args: [Number(id)] });
        return this.row<Backup>(r);
    }

    async createBackup(label: string, data: string): Promise<void> {
        await this.client.execute({ sql: 'INSERT INTO backups (label, data) VALUES (?, ?)', args: [label, data] });
    }

    async deleteBackup(id: string | number): Promise<void> {
        await this.client.execute({ sql: 'DELETE FROM backups WHERE id = ?', args: [Number(id)] });
    }

    async pruneBackups(keep: number = 10): Promise<void> {
        await this.client.execute(`DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY id DESC LIMIT ${keep})`);
    }

    async getBackupCount(): Promise<number> {
        const r = await this.client.execute('SELECT COUNT(*) as c FROM backups');
        return (this.row<any>(r))?.c ?? 0;
    }

    async restoreBackup(snapshot: Snapshot): Promise<void> {
        const stmts: any[] = [
            'DELETE FROM links',
            'DELETE FROM categories',
            'DELETE FROM panels',
        ];
        for (const p of snapshot.panels) {
            stmts.push({ sql: 'INSERT INTO panels (id, name, position) VALUES (?, ?, ?)', args: [p.id, p.name, p.position] });
        }
        for (const c of snapshot.categories) {
            stmts.push({ sql: 'INSERT INTO categories (id, panel_id, name, position) VALUES (?, ?, ?, ?)', args: [c.id, c.panel_id, c.name, c.position] });
        }
        for (const l of snapshot.links) {
            stmts.push({ sql: 'INSERT INTO links (id, category_id, name, url, position, description) VALUES (?, ?, ?, ?, ?, ?)', args: [l.id, l.category_id, l.name, l.url, l.position, l.description] });
        }
        await this.client.batch(stmts);
    }

    async getFullSnapshot(): Promise<Snapshot> {
        const [pR, cR, lR] = await Promise.all([
            this.client.execute('SELECT * FROM panels ORDER BY position'),
            this.client.execute('SELECT * FROM categories ORDER BY position'),
            this.client.execute('SELECT * FROM links ORDER BY position'),
        ]);
        return {
            panels: this.rows<Panel>(pR),
            categories: this.rows<Category>(cR),
            links: this.rows<Link>(lR),
        };
    }
}
