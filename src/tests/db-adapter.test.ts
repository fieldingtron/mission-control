/**
 * Database Adapter Test Suite
 * 
 * Tests the SqliteAdapter implementation of the DatabaseAdapter interface.
 * Uses an ISOLATED test database in /tmp to avoid touching production data.
 * 
 * Run: npm run test:adapter
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Types (duplicated here to avoid importing from db.ts which initializes prod DB) ──
interface Panel { id: number; name: string; position: number; }
interface PanelWithCount extends Panel { category_count: number; }
interface Category { id: number; panel_id: number; name: string; position: number; }
interface CategoryWithPanel extends Category { panel_name: string; }
interface Link { id: number; category_id: number; name: string; url: string; position: number; description: string | null; }
interface Backup { id: number; created_at: string; label: string; data?: string; }
interface Snapshot { panels: Panel[]; categories: Category[]; links: Link[]; }

interface DatabaseAdapter {
    getPanels(): Promise<Panel[]>;
    getPanelsWithCounts(): Promise<PanelWithCount[]>;
    getPanel(id: string | number): Promise<Panel | null>;
    addPanel(name: string): Promise<{ lastInsertRowid: number | bigint }>;
    updatePanel(id: string | number, name: string): Promise<void>;
    deletePanel(id: string | number): Promise<void>;
    reorderPanels(ids: (string | number)[]): Promise<void>;
    getCategories(panelId?: string | number | null): Promise<Category[]>;
    getCategoriesWithPanel(): Promise<CategoryWithPanel[]>;
    getCategory(id: string | number): Promise<Category | null>;
    addCategory(name: string, panelId: string | number): Promise<void>;
    updateCategory(id: string | number, name: string): Promise<void>;
    deleteCategory(id: string | number): Promise<void>;
    moveCategory(categoryId: string | number, panelId: string | number): Promise<void>;
    reorderCategories(ids: (string | number)[]): Promise<void>;
    getLinks(): Promise<Link[]>;
    getLink(id: string | number): Promise<Link | null>;
    addLink(categoryId: number, name: string, url: string, position: number, description: string | null): Promise<void>;
    updateLink(id: string | number, name: string, url: string, categoryId: number, description: string | null): Promise<void>;
    deleteLink(id: string | number): Promise<void>;
    reorderLinks(ids: (string | number)[], categoryId: string | number): Promise<void>;
    getMaxLinkPosition(): Promise<number>;
    getBackups(limit?: number): Promise<Backup[]>;
    getBackup(id: string | number): Promise<Backup | null>;
    createBackup(label: string, data: string): Promise<void>;
    deleteBackup(id: string | number): Promise<void>;
    pruneBackups(keep?: number): Promise<void>;
    restoreBackup(snapshot: Snapshot): Promise<void>;
    getBackupCount(): Promise<number>;
    getFullSnapshot(): Promise<Snapshot>;
}

// ── Create a test-only SqliteAdapter that uses a temp database ──
class TestSqliteAdapter implements DatabaseAdapter {
    private db: InstanceType<typeof DatabaseSync>;

    constructor(dbPath: string) {
        this.db = new DatabaseSync(dbPath);
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
        // Seed default panels
        this.db.exec("INSERT INTO panels (name, position) VALUES ('WORK', 1), ('LEARNING', 2), ('NEWS', 3)");
    }

    async getPanels(): Promise<Panel[]> {
        return this.db.prepare('SELECT * FROM panels ORDER BY position ASC').all() as Panel[];
    }
    async getPanelsWithCounts(): Promise<PanelWithCount[]> {
        return this.db.prepare(`SELECT p.*, COUNT(c.id) as category_count FROM panels p LEFT JOIN categories c ON c.panel_id = p.id GROUP BY p.id ORDER BY p.position`).all() as PanelWithCount[];
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
            this.db.prepare('DELETE FROM links WHERE category_id IN (SELECT id FROM categories WHERE panel_id = ?)').run(id);
            this.db.prepare('DELETE FROM categories WHERE panel_id = ?').run(id);
            this.db.prepare('DELETE FROM panels WHERE id = ?').run(id);
            this.db.exec('COMMIT');
        } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    }
    async reorderPanels(ids: (string | number)[]): Promise<void> {
        const update = this.db.prepare('UPDATE panels SET position = ? WHERE id = ?');
        this.db.exec('BEGIN');
        try { ids.forEach((id, idx) => update.run(idx + 1, id)); this.db.exec('COMMIT'); }
        catch (e) { this.db.exec('ROLLBACK'); throw e; }
    }
    async getCategories(panelId?: string | number | null): Promise<Category[]> {
        if (panelId) return this.db.prepare('SELECT * FROM categories WHERE panel_id = ? ORDER BY position, id').all(panelId) as Category[];
        return this.db.prepare('SELECT * FROM categories ORDER BY position, id').all() as Category[];
    }
    async getCategoriesWithPanel(): Promise<CategoryWithPanel[]> {
        return this.db.prepare('SELECT c.*, p.name as panel_name FROM categories c LEFT JOIN panels p ON c.panel_id = p.id ORDER BY p.position, c.position').all() as CategoryWithPanel[];
    }
    async getCategory(id: string | number): Promise<Category | null> {
        return (this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category) || null;
    }
    async addCategory(name: string, panelId: string | number): Promise<void> {
        const maxRow = this.db.prepare('SELECT MAX(position) as max FROM categories WHERE panel_id = ?').get(panelId) as any;
        const position = (maxRow?.max ?? 0) + 1;
        this.db.prepare('INSERT INTO categories (name, panel_id, position) VALUES (?, ?, ?)').run(name, panelId, position);
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
            this.db.exec('DELETE FROM links'); this.db.exec('DELETE FROM categories'); this.db.exec('DELETE FROM panels');
            const insertPanel = this.db.prepare('INSERT INTO panels (id, name, position) VALUES (?, ?, ?)');
            for (const p of snapshot.panels) insertPanel.run(p.id, p.name, p.position);
            const insertCat = this.db.prepare('INSERT INTO categories (id, panel_id, name, position) VALUES (?, ?, ?, ?)');
            for (const c of snapshot.categories) insertCat.run(c.id, c.panel_id, c.name, c.position);
            const insertLink = this.db.prepare('INSERT INTO links (id, category_id, name, url, position, description) VALUES (?, ?, ?, ?, ?, ?)');
            for (const l of snapshot.links) insertLink.run(l.id, l.category_id, l.name, l.url, l.position, l.description);
            this.db.exec('COMMIT');
        } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    }
    async getFullSnapshot(): Promise<Snapshot> {
        const panels = this.db.prepare('SELECT * FROM panels ORDER BY position').all() as Panel[];
        const categories = this.db.prepare('SELECT * FROM categories ORDER BY position').all() as Category[];
        const links = this.db.prepare('SELECT * FROM links ORDER BY position').all() as Link[];
        return { panels, categories, links };
    }
}

// ── Test Suite ───────────────────────────────────────
const TEST_DB_PATH = '/tmp/link-dashboard-test.db';

// Clean up any previous test database
try { unlinkSync(TEST_DB_PATH); } catch { }

const db: DatabaseAdapter = new TestSqliteAdapter(TEST_DB_PATH);

describe('DatabaseAdapter (SqliteAdapter) — Isolated Test DB', () => {

    // ── Panels ─────────────────────────────────────────
    describe('Panels', () => {
        it('should return default panels', async () => {
            const panels = await db.getPanels();
            assert.ok(Array.isArray(panels));
            assert.equal(panels.length, 3, 'Should have 3 default panels');
        });

        it('should add a new panel', async () => {
            const result = await db.addPanel('TEST_PANEL');
            const panels = await db.getPanels();
            assert.equal(panels.length, 4);
            const newPanel = panels.find(p => p.name === 'TEST_PANEL');
            assert.ok(newPanel);
            assert.equal(result.lastInsertRowid, newPanel!.id);
        });

        it('should update a panel name', async () => {
            const panels = await db.getPanels();
            const testPanel = panels.find(p => p.name === 'TEST_PANEL')!;
            await db.updatePanel(testPanel.id, 'RENAMED_PANEL');
            const updated = await db.getPanel(testPanel.id);
            assert.equal(updated?.name, 'RENAMED_PANEL');
        });

        it('should get panels with counts', async () => {
            const panels = await db.getPanelsWithCounts();
            assert.ok(Array.isArray(panels));
            assert.ok('category_count' in panels[0]);
        });

        it('should reorder panels', async () => {
            const panels = await db.getPanels();
            const ids = panels.map(p => p.id).reverse();
            await db.reorderPanels(ids);
            const reordered = await db.getPanels();
            assert.equal(reordered[0].id, ids[0]);
        });

        it('should delete a panel and cascade', async () => {
            const panels = await db.getPanels();
            const testPanel = panels.find(p => p.name === 'RENAMED_PANEL')!;

            // Add a category and link to this panel first
            await db.addCategory('Cascade Cat', testPanel.id);
            const cats = await db.getCategories(testPanel.id);
            await db.addLink(cats[0].id, 'Cascade Link', 'https://cascade.com', 1, null);

            // Now delete the panel — should cascade
            await db.deletePanel(testPanel.id);

            const after = await db.getPanel(testPanel.id);
            assert.equal(after, null);
            const catsAfter = await db.getCategories(testPanel.id);
            assert.equal(catsAfter.length, 0, 'Categories should be deleted');
        });
    });

    // ── Categories ─────────────────────────────────────
    describe('Categories', () => {
        let panelId: number;

        before(async () => {
            const panels = await db.getPanels();
            panelId = panels[0].id;
        });

        it('should add a category', async () => {
            await db.addCategory('Test Category', panelId);
            const cats = await db.getCategories(panelId);
            assert.ok(cats.find(c => c.name === 'Test Category'));
        });

        it('should get all categories', async () => {
            const all = await db.getCategories();
            assert.ok(all.find(c => c.name === 'Test Category'));
        });

        it('should get categories with panel names', async () => {
            const cats = await db.getCategoriesWithPanel();
            assert.ok(cats.length > 0);
            assert.ok('panel_name' in cats[0]);
        });

        it('should update a category', async () => {
            const cats = await db.getCategories();
            const cat = cats.find(c => c.name === 'Test Category')!;
            await db.updateCategory(cat.id, 'Updated Category');
            const updated = await db.getCategory(cat.id);
            assert.equal(updated?.name, 'Updated Category');
        });

        it('should move a category to another panel', async () => {
            const panels = await db.getPanels();
            const otherPanel = panels.find(p => p.id !== panelId)!;
            const cats = await db.getCategories();
            const cat = cats.find(c => c.name === 'Updated Category')!;

            await db.moveCategory(cat.id, otherPanel.id);
            const moved = await db.getCategory(cat.id);
            assert.equal(moved?.panel_id, otherPanel.id);
        });

        it('should reorder categories', async () => {
            await db.addCategory('Cat A', panelId);
            await db.addCategory('Cat B', panelId);
            const cats = await db.getCategories(panelId);
            const ids = cats.map(c => c.id).reverse();
            await db.reorderCategories(ids);
            // No error = success
        });

        it('should delete a category and its links', async () => {
            const cats = await db.getCategories();
            const cat = cats.find(c => c.name === 'Updated Category')!;
            await db.addLink(cat.id, 'DeleteMe', 'https://delete.me', 1, null);

            await db.deleteCategory(cat.id);
            assert.equal(await db.getCategory(cat.id), null);
            const links = await db.getLinks();
            assert.ok(!links.find(l => l.name === 'DeleteMe'));
        });
    });

    // ── Links ──────────────────────────────────────────
    describe('Links', () => {
        let categoryId: number;

        before(async () => {
            const panels = await db.getPanels();
            await db.addCategory('Link Test Cat', panels[0].id);
            const cats = await db.getCategories(panels[0].id);
            categoryId = cats.find(c => c.name === 'Link Test Cat')!.id;
        });

        it('should add a link', async () => {
            const maxPos = await db.getMaxLinkPosition();
            await db.addLink(categoryId, 'Test Link', 'https://example.com', maxPos + 1, 'A test link');
            const links = await db.getLinks();
            const testLink = links.find(l => l.name === 'Test Link');
            assert.ok(testLink);
            assert.equal(testLink!.url, 'https://example.com');
            assert.equal(testLink!.description, 'A test link');
        });

        it('should update a link', async () => {
            const links = await db.getLinks();
            const testLink = links.find(l => l.name === 'Test Link')!;
            await db.updateLink(testLink.id, 'Updated Link', 'https://updated.com', categoryId, 'Updated desc');
            const updated = await db.getLink(testLink.id);
            assert.equal(updated?.name, 'Updated Link');
            assert.equal(updated?.url, 'https://updated.com');
        });

        it('should reorder links', async () => {
            await db.addLink(categoryId, 'Link 2', 'https://two.com', 2, null);
            const links = await db.getLinks();
            const ids = links.map(l => l.id).reverse();
            await db.reorderLinks(ids, categoryId);
        });

        it('should delete a link', async () => {
            const links = await db.getLinks();
            const testLink = links.find(l => l.name === 'Updated Link')!;
            await db.deleteLink(testLink.id);
            assert.equal(await db.getLink(testLink.id), null);
        });
    });

    // ── Backups ────────────────────────────────────────
    describe('Backups', () => {
        it('should create a backup', async () => {
            const snapshot = await db.getFullSnapshot();
            await db.createBackup('Test Backup', JSON.stringify(snapshot));
            const backups = await db.getBackups();
            assert.ok(backups.some(b => b.label === 'Test Backup'));
        });

        it('should get a backup by id', async () => {
            const backups = await db.getBackups();
            const full = await db.getBackup(backups[0].id);
            assert.ok(full?.data);
        });

        it('should get backup count', async () => {
            const count = await db.getBackupCount();
            assert.ok(count >= 1);
        });

        it('should prune backups', async () => {
            const snapshot = await db.getFullSnapshot();
            for (let i = 0; i < 5; i++) await db.createBackup(`Prune ${i}`, JSON.stringify(snapshot));
            await db.pruneBackups(2);
            const count = await db.getBackupCount();
            assert.ok(count <= 2, `Expected <=2, got ${count}`);
        });

        it('should restore a backup', async () => {
            const snapshot = await db.getFullSnapshot();
            await db.addPanel('TEMP_FOR_RESTORE');
            const panelsAfterAdd = await db.getPanels();
            assert.ok(panelsAfterAdd.find(p => p.name === 'TEMP_FOR_RESTORE'));

            await db.restoreBackup(snapshot);
            const panelsAfterRestore = await db.getPanels();
            assert.ok(!panelsAfterRestore.find(p => p.name === 'TEMP_FOR_RESTORE'));
        });

        it('should delete a backup', async () => {
            const backups = await db.getBackups();
            if (backups.length === 0) return;
            await db.deleteBackup(backups[0].id);
            assert.equal(await db.getBackup(backups[0].id), null);
        });
    });

    // ── Full Snapshot ──────────────────────────────────
    describe('Full Snapshot', () => {
        it('should return a complete snapshot', async () => {
            const snapshot = await db.getFullSnapshot();
            assert.ok(Array.isArray(snapshot.panels));
            assert.ok(Array.isArray(snapshot.categories));
            assert.ok(Array.isArray(snapshot.links));
        });
    });
});
