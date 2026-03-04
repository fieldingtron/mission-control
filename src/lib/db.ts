import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { DrizzleAdapter } from './drizzle-adapter';
import dotenv from 'dotenv';

// Force load the .env file if we are in a bare Node context 
const configPath = join(dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: configPath });

// ──────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────
export interface Panel { id: number; name: string; position: number; }
export interface PanelWithCount extends Panel { category_count: number; }
export interface Category { id: number; panel_id: number; name: string; position: number; }
export interface CategoryWithPanel extends Category { panel_name: string; }
export interface Link { id: number; category_id: number; name: string; url: string; position: number; description: string | null; }
export interface Backup { id: number; created_at: string; label: string; data?: string; }
export interface Snapshot { panels: Panel[]; categories: Category[]; links: Link[]; }

// ──────────────────────────────────────────────────────
//  Database Adapter Interface
// ──────────────────────────────────────────────────────
export interface DatabaseAdapter {
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
  addCategory(name: string, panelId: string | number): Promise<{ lastInsertRowid: number | bigint }>;
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
  syncSequences?(): Promise<void>;
}

// ──────────────────────────────────────────────────────
//  Dynamic Proxy Export
// ──────────────────────────────────────────────────────
let activeAdapter: DatabaseAdapter;

export function initializeAdapter(): void {
  console.log(`[DB] Initializing adapter: drizzle`);

  let dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    const homedir = os.homedir();
    const docDir = join(homedir, 'Documents');
    if (!existsSync(docDir)) mkdirSync(docDir, { recursive: true });

    const dbPath = join(docDir, 'mission_control.db');
    dbUrl = `file:${dbPath}`;
    console.log(`[DB] No DATABASE_URL provided. Using local iCloud database: ${dbPath}`);
  }

  activeAdapter = new DrizzleAdapter(dbUrl);

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
