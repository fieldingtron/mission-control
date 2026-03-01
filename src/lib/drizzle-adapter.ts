import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, asc, desc, sql } from 'drizzle-orm';
import type { DatabaseAdapter, Panel, PanelWithCount, Category, CategoryWithPanel, Link, Backup, Snapshot } from './db';
import * as schema from './schema';

export class DrizzleAdapter implements DatabaseAdapter {
    private db: ReturnType<typeof drizzle>;
    private client: postgres.Sql;

    constructor(url: string) {
        this.client = postgres(url, { prepare: false });
        this.db = drizzle(this.client, { schema });
    }

    async init(): Promise<void> {
        // Drizzle schema is managed via `drizzle-kit push` or migrations, 
        // leaving initialization to the deploy step. 
    }

    // ── Panels ─────────────────────────────────────────
    async getPanels(): Promise<Panel[]> {
        return await this.db.select().from(schema.panels).orderBy(asc(schema.panels.position));
    }

    async getPanelsWithCounts(): Promise<PanelWithCount[]> {
        const panels = await this.getPanels();
        const cats = await this.db.select({ panel_id: schema.categories.panel_id }).from(schema.categories);

        const counts: Record<number, number> = {};
        cats.forEach(c => {
            if (c.panel_id) {
                counts[c.panel_id] = (counts[c.panel_id] || 0) + 1;
            }
        });

        return panels.map(p => ({ ...p, category_count: counts[p.id] || 0 }));
    }

    async getPanel(id: string | number): Promise<Panel | null> {
        const res = await this.db.select().from(schema.panels).where(eq(schema.panels.id, Number(id))).limit(1);
        return res[0] || null;
    }

    async addPanel(name: string): Promise<{ lastInsertRowid: number | bigint }> {
        const maxRes = await this.db.select({ position: schema.panels.position }).from(schema.panels).orderBy(desc(schema.panels.position)).limit(1);
        const maxPos = maxRes[0]?.position ?? 0;

        const res = await this.db.insert(schema.panels).values({ name, position: maxPos + 1 }).returning({ id: schema.panels.id });
        return { lastInsertRowid: res[0].id };
    }

    async updatePanel(id: string | number, name: string): Promise<void> {
        await this.db.update(schema.panels).set({ name }).where(eq(schema.panels.id, Number(id)));
    }

    async deletePanel(id: string | number): Promise<void> {
        await this.db.delete(schema.panels).where(eq(schema.panels.id, Number(id)));
    }

    async reorderPanels(ids: (string | number)[]): Promise<void> {
        await this.db.transaction(async (tx) => {
            for (let i = 0; i < ids.length; i++) {
                await tx.update(schema.panels).set({ position: i + 1 }).where(eq(schema.panels.id, Number(ids[i])));
            }
        });
    }

    // ── Categories ─────────────────────────────────────
    async getCategories(panelId?: string | number | null): Promise<Category[]> {
        let query = this.db.select().from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.id));
        if (panelId) {
            query.where(eq(schema.categories.panel_id, Number(panelId)));
        }
        const results = await query;
        return results as unknown as Category[]; // Cast here as panel_id is nullable in schema but guaranteed populated in business logic
    }

    async getCategoriesWithPanel(): Promise<CategoryWithPanel[]> {
        const data = await this.db
            .select({
                id: schema.categories.id,
                panel_id: schema.categories.panel_id,
                name: schema.categories.name,
                position: schema.categories.position,
                panel_name: schema.panels.name
            })
            .from(schema.categories)
            .leftJoin(schema.panels, eq(schema.categories.panel_id, schema.panels.id))
            .orderBy(asc(schema.panels.position), asc(schema.categories.position));

        return data.map(c => ({
            id: c.id,
            panel_id: c.panel_id ?? -1, // Fallback if orphaned
            name: c.name,
            position: c.position,
            panel_name: c.panel_name || ''
        }));
    }

    async getCategory(id: string | number): Promise<Category | null> {
        const res = await this.db.select().from(schema.categories).where(eq(schema.categories.id, Number(id))).limit(1);
        return res[0] as Category || null;
    }

    async addCategory(name: string, panelId: string | number): Promise<{ lastInsertRowid: number | bigint }> {
        const maxRes = await this.db.select({ position: schema.categories.position }).from(schema.categories).where(eq(schema.categories.panel_id, Number(panelId))).orderBy(desc(schema.categories.position)).limit(1);
        const maxPos = maxRes[0]?.position ?? 0;

        const res = await this.db.insert(schema.categories).values({ name, panel_id: Number(panelId), position: maxPos + 1 }).returning({ id: schema.categories.id });
        return { lastInsertRowid: res[0].id };
    }

    async updateCategory(id: string | number, name: string): Promise<void> {
        await this.db.update(schema.categories).set({ name }).where(eq(schema.categories.id, Number(id)));
    }

    async deleteCategory(id: string | number): Promise<void> {
        await this.db.delete(schema.categories).where(eq(schema.categories.id, Number(id)));
    }

    async moveCategory(categoryId: string | number, panelId: string | number): Promise<void> {
        const maxRes = await this.db.select({ position: schema.categories.position }).from(schema.categories).where(eq(schema.categories.panel_id, Number(panelId))).orderBy(desc(schema.categories.position)).limit(1);
        const maxPos = maxRes[0]?.position ?? 0;

        await this.db.update(schema.categories).set({ panel_id: Number(panelId), position: maxPos + 1 }).where(eq(schema.categories.id, Number(categoryId)));
    }

    async reorderCategories(ids: (string | number)[]): Promise<void> {
        await this.db.transaction(async (tx) => {
            for (let i = 0; i < ids.length; i++) {
                await tx.update(schema.categories).set({ position: i }).where(eq(schema.categories.id, Number(ids[i])));
            }
        });
    }

    // ── Links ──────────────────────────────────────────
    async getLinks(): Promise<Link[]> {
        return await this.db.select().from(schema.links).orderBy(asc(schema.links.position), asc(schema.links.id));
    }

    async getLink(id: string | number): Promise<Link | null> {
        const res = await this.db.select().from(schema.links).where(eq(schema.links.id, Number(id))).limit(1);
        return res[0] || null;
    }

    async addLink(categoryId: number, name: string, url: string, position: number, description: string | null): Promise<void> {
        await this.db.insert(schema.links).values({ category_id: categoryId, name, url, position, description });
    }

    async updateLink(id: string | number, name: string, url: string, categoryId: number, description: string | null): Promise<void> {
        await this.db.update(schema.links).set({ name, url, category_id: categoryId, description }).where(eq(schema.links.id, Number(id)));
    }

    async deleteLink(id: string | number): Promise<void> {
        await this.db.delete(schema.links).where(eq(schema.links.id, Number(id)));
    }

    async reorderLinks(ids: (string | number)[], categoryId: string | number): Promise<void> {
        await this.db.transaction(async (tx) => {
            for (let i = 0; i < ids.length; i++) {
                await tx.update(schema.links).set({ position: i, category_id: Number(categoryId) }).where(eq(schema.links.id, Number(ids[i])));
            }
        });
    }

    async getMaxLinkPosition(): Promise<number> {
        const maxRes = await this.db.select({ position: schema.links.position }).from(schema.links).orderBy(desc(schema.links.position)).limit(1);
        return maxRes[0]?.position ?? 0;
    }

    // ── Backups ────────────────────────────────────────
    async getBackups(limit: number = 10): Promise<Backup[]> {
        return await this.db.select({
            id: schema.backups.id,
            created_at: schema.backups.created_at,
            label: schema.backups.label
        }).from(schema.backups).orderBy(desc(schema.backups.id)).limit(limit) as Backup[];
    }

    async getBackup(id: string | number): Promise<Backup | null> {
        const res = await this.db.select().from(schema.backups).where(eq(schema.backups.id, Number(id))).limit(1);
        return res[0] as Backup || null;
    }

    async createBackup(label: string, data: string): Promise<void> {
        await this.db.insert(schema.backups).values({ label, data });
    }

    async deleteBackup(id: string | number): Promise<void> {
        await this.db.delete(schema.backups).where(eq(schema.backups.id, Number(id)));
    }

    async pruneBackups(keep: number = 10): Promise<void> {
        const recentBackups = await this.db.select({ id: schema.backups.id }).from(schema.backups).orderBy(desc(schema.backups.id)).limit(keep);
        const idsToKeep = recentBackups.map(b => b.id);

        if (idsToKeep.length > 0) {
            await this.db.delete(schema.backups).where(sql`id NOT IN ${idsToKeep}`);
        }
    }

    async getBackupCount(): Promise<number> {
        const res = await this.db.select({ count: sql<number>`count(*)` }).from(schema.backups);
        return Number(res[0].count);
    }

    async restoreBackup(snapshot: Snapshot): Promise<void> {
        await this.db.transaction(async (tx) => {
            await tx.delete(schema.links);
            await tx.delete(schema.categories);
            await tx.delete(schema.panels);

            // Drizzle requires non-empty arrays for bulk insertions
            if (snapshot.panels.length > 0) {
                await tx.insert(schema.panels).values(snapshot.panels);
            }
            if (snapshot.categories.length > 0) {
                // Remove panel_name if it leaked into the snapshot Category data
                const cleanCats = snapshot.categories.map((c: any) => {
                    const { panel_name, ...rest } = c;
                    return rest;
                });
                await tx.insert(schema.categories).values(cleanCats);
            }
            if (snapshot.links.length > 0) {
                await tx.insert(schema.links).values(snapshot.links);
            }
        });

        await this.syncSequences();
    }

    async syncSequences(): Promise<void> {
        try {
            const panelsMax = await this.db.select({ maxId: sql<number>`max(id)` }).from(schema.panels);
            const catsMax = await this.db.select({ maxId: sql<number>`max(id)` }).from(schema.categories);
            const linksMax = await this.db.select({ maxId: sql<number>`max(id)` }).from(schema.links);

            const pid = panelsMax[0]?.maxId || 0;
            const cid = catsMax[0]?.maxId || 0;
            const lid = linksMax[0]?.maxId || 0;

            if (pid > 0) await this.client`SELECT setval('panels_id_seq', ${pid})`;
            if (cid > 0) await this.client`SELECT setval('categories_id_seq', ${cid})`;
            if (lid > 0) await this.client`SELECT setval('links_id_seq', ${lid})`;

            console.log('[DB] Sequences synchronized successfully using Postgres raw queries.');
        } catch (e) {
            console.error('[DB] Failed to sync sequences after restore/import:', e);
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
