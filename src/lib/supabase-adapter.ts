/**
 * SupabaseAdapter — Implements DatabaseAdapter using @supabase/supabase-js
 * Supabase uses PostgreSQL, so queries differ from SQLite (e.g., SERIAL vs AUTOINCREMENT).
 * This adapter uses the Supabase REST API (PostgREST) for all operations.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseAdapter, Panel, PanelWithCount, Category, CategoryWithPanel, Link, Backup, Snapshot } from './db';

export class SupabaseAdapter implements DatabaseAdapter {
    private sb: SupabaseClient;

    constructor(url: string, anonKey: string) {
        this.sb = createClient(url, anonKey);
    }

    /**
     * Initialize the database schema. 
     * For Supabase, tables should be created via the Supabase dashboard or migrations.
     * This method is a no-op but could be used for verification.
     */
    async init(): Promise<void> {
        // Tables are managed via Supabase dashboard/migrations.
        // SQL to create them in Supabase:
        /*
        CREATE TABLE IF NOT EXISTS panels (
          id       SERIAL PRIMARY KEY,
          name     TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS categories (
          id       SERIAL PRIMARY KEY,
          panel_id INTEGER REFERENCES panels(id),
          name     TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS links (
          id          SERIAL PRIMARY KEY,
          category_id INTEGER NOT NULL REFERENCES categories(id),
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
        */
    }

    // ── Panels ─────────────────────────────────────────
    async getPanels(): Promise<Panel[]> {
        const { data, error } = await this.sb.from('panels').select('*').order('position', { ascending: true });
        if (error) throw error;
        return data as Panel[];
    }

    async getPanelsWithCounts(): Promise<PanelWithCount[]> {
        // Supabase supports aggregation through RPC or views; use a simpler approach
        const panels = await this.getPanels();
        const { data: cats } = await this.sb.from('categories').select('panel_id');
        const counts: Record<number, number> = {};
        (cats || []).forEach((c: any) => { counts[c.panel_id] = (counts[c.panel_id] || 0) + 1; });
        return panels.map(p => ({ ...p, category_count: counts[p.id] || 0 }));
    }

    async getPanel(id: string | number): Promise<Panel | null> {
        const { data, error } = await this.sb.from('panels').select('*').eq('id', Number(id)).single();
        if (error) return null;
        return data as Panel;
    }

    async addPanel(name: string): Promise<{ lastInsertRowid: number | bigint }> {
        const panels = await this.getPanels();
        const maxPos = panels.reduce((max, p) => Math.max(max, p.position), 0);
        const { data, error } = await this.sb.from('panels').insert({ name, position: maxPos + 1 }).select('id').single();
        if (error) throw error;
        return { lastInsertRowid: data!.id };
    }

    async updatePanel(id: string | number, name: string): Promise<void> {
        const { error } = await this.sb.from('panels').update({ name }).eq('id', Number(id));
        if (error) throw error;
    }

    async deletePanel(id: string | number): Promise<void> {
        const nid = Number(id);
        // Get category IDs for this panel
        const { data: cats } = await this.sb.from('categories').select('id').eq('panel_id', nid);
        const catIds = (cats || []).map((c: any) => c.id);
        if (catIds.length > 0) {
            await this.sb.from('links').delete().in('category_id', catIds);
        }
        await this.sb.from('categories').delete().eq('panel_id', nid);
        await this.sb.from('panels').delete().eq('id', nid);
    }

    async reorderPanels(ids: (string | number)[]): Promise<void> {
        const updates = ids.map((id, idx) => this.sb.from('panels').update({ position: idx + 1 }).eq('id', Number(id)));
        await Promise.all(updates);
    }

    // ── Categories ─────────────────────────────────────
    async getCategories(panelId?: string | number | null): Promise<Category[]> {
        let query = this.sb.from('categories').select('*').order('position').order('id');
        if (panelId) query = query.eq('panel_id', Number(panelId));
        const { data, error } = await query;
        if (error) throw error;
        return data as Category[];
    }

    async getCategoriesWithPanel(): Promise<CategoryWithPanel[]> {
        const { data, error } = await this.sb.from('categories').select('*, panels(name)').order('position');
        if (error) throw error;
        return (data || []).map((c: any) => ({
            ...c,
            panel_name: c.panels?.name || null,
            panels: undefined
        })) as CategoryWithPanel[];
    }

    async getCategory(id: string | number): Promise<Category | null> {
        const { data, error } = await this.sb.from('categories').select('*').eq('id', Number(id)).single();
        if (error) return null;
        return data as Category;
    }

    async addCategory(name: string, panelId: string | number): Promise<{ lastInsertRowid: number | bigint }> {
        const cats = await this.getCategories(Number(panelId));
        const maxPos = cats.reduce((max, c) => Math.max(max, c.position), 0);
        const { data, error } = await this.sb.from('categories').insert({ name, panel_id: Number(panelId), position: maxPos + 1 }).select('id').single();
        if (error) throw error;
        return { lastInsertRowid: data!.id };
    }

    async updateCategory(id: string | number, name: string): Promise<void> {
        const { error } = await this.sb.from('categories').update({ name }).eq('id', Number(id));
        if (error) throw error;
    }

    async deleteCategory(id: string | number): Promise<void> {
        const nid = Number(id);
        await this.sb.from('links').delete().eq('category_id', nid);
        await this.sb.from('categories').delete().eq('id', nid);
    }

    async moveCategory(categoryId: string | number, panelId: string | number): Promise<void> {
        const cats = await this.getCategories(Number(panelId));
        const maxPos = cats.reduce((max, c) => Math.max(max, c.position), 0);
        const { error } = await this.sb.from('categories').update({ panel_id: Number(panelId), position: maxPos + 1 }).eq('id', Number(categoryId));
        if (error) throw error;
    }

    async reorderCategories(ids: (string | number)[]): Promise<void> {
        const updates = ids.map((id, index) => this.sb.from('categories').update({ position: index }).eq('id', Number(id)));
        await Promise.all(updates);
    }

    // ── Links ──────────────────────────────────────────
    async getLinks(): Promise<Link[]> {
        const { data, error } = await this.sb.from('links').select('*').order('position').order('id');
        if (error) throw error;
        return data as Link[];
    }

    async getLink(id: string | number): Promise<Link | null> {
        const { data, error } = await this.sb.from('links').select('*').eq('id', Number(id)).single();
        if (error) return null;
        return data as Link;
    }

    async addLink(categoryId: number, name: string, url: string, position: number, description: string | null): Promise<void> {
        const { error } = await this.sb.from('links').insert({ category_id: categoryId, name, url, position, description });
        if (error) throw error;
    }

    async updateLink(id: string | number, name: string, url: string, categoryId: number, description: string | null): Promise<void> {
        const { error } = await this.sb.from('links').update({ name, url, category_id: categoryId, description }).eq('id', Number(id));
        if (error) throw error;
    }

    async deleteLink(id: string | number): Promise<void> {
        await this.sb.from('links').delete().eq('id', Number(id));
    }

    async reorderLinks(ids: (string | number)[], categoryId: string | number): Promise<void> {
        const updates = ids.map((id, index) => this.sb.from('links').update({ position: index, category_id: Number(categoryId) }).eq('id', Number(id)));
        await Promise.all(updates);
    }

    async getMaxLinkPosition(): Promise<number> {
        const { data } = await this.sb.from('links').select('position').order('position', { ascending: false }).limit(1);
        return data && data.length > 0 ? data[0].position : 0;
    }

    // ── Backups ────────────────────────────────────────
    async getBackups(limit: number = 10): Promise<Backup[]> {
        const { data, error } = await this.sb.from('backups').select('id, created_at, label').order('id', { ascending: false }).limit(limit);
        if (error) throw error;
        return data as Backup[];
    }

    async getBackup(id: string | number): Promise<Backup | null> {
        const { data, error } = await this.sb.from('backups').select('*').eq('id', Number(id)).single();
        if (error) return null;
        return data as Backup;
    }

    async createBackup(label: string, data: string): Promise<void> {
        const { error } = await this.sb.from('backups').insert({ label, data });
        if (error) throw error;
    }

    async deleteBackup(id: string | number): Promise<void> {
        await this.sb.from('backups').delete().eq('id', Number(id));
    }

    async pruneBackups(keep: number = 10): Promise<void> {
        const { data } = await this.sb.from('backups').select('id').order('id', { ascending: false });
        if (data && data.length > keep) {
            const toDelete = data.slice(keep).map((b: any) => b.id);
            await this.sb.from('backups').delete().in('id', toDelete);
        }
    }

    async getBackupCount(): Promise<number> {
        const { count, error } = await this.sb.from('backups').select('*', { count: 'exact', head: true });
        if (error) throw error;
        return count ?? 0;
    }

    async restoreBackup(snapshot: Snapshot): Promise<void> {
        // Clear all tables
        await this.sb.from('links').delete().neq('id', -1);   // delete all
        await this.sb.from('categories').delete().neq('id', -1);
        await this.sb.from('panels').delete().neq('id', -1);

        // Bulk insert
        if (snapshot.panels.length > 0) {
            const { error } = await this.sb.from('panels').insert(snapshot.panels);
            if (error) throw error;
        }
        if (snapshot.categories.length > 0) {
            const { error } = await this.sb.from('categories').insert(snapshot.categories);
            if (error) throw error;
        }
        if (snapshot.links.length > 0) {
            const { error } = await this.sb.from('links').insert(snapshot.links);
            if (error) throw error;
        }
    }

    async getFullSnapshot(): Promise<Snapshot> {
        const [panels, categories, links] = await Promise.all([
            this.getPanels(),
            this.getCategories(),
            this.getLinks(),
        ]);
        return { panels, categories, links };
    }
}
