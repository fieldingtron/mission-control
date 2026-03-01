import type { APIRoute } from "astro";
import db, { SqliteAdapter } from "../../../lib/db";
import { getDbConfig } from "../../../lib/db-config";

export const POST: APIRoute = async ({ request }) => {
    try {
        const config = getDbConfig();

        // If we're already using local SQLite, syncing to itself doesn't make sense
        if (config.provider === 'sqlite') {
            return new Response(
                `<div id="sync-result" style="color: var(--accent); margin-top: 10px; font-size: 13px;">Cannot sync: Local SQLite is currently the active provider.</div>`,
                { status: 400, headers: { "Content-Type": "text/html" } }
            );
        }

        console.log(`[DB] Syncing local SQLite data to ${config.provider}...`);

        // Read from the local SQLite database
        const localDb = new SqliteAdapter();
        const snapshot = await localDb.getFullSnapshot();

        console.log(`[DB] Found ${snapshot.panels.length} panels, ${snapshot.categories.length} categories, ${snapshot.links.length} links on local SQLite.`);

        // Push exactly this snapshot to the currently active remote adapter (Wipe & Replace)
        await db.restoreBackup(snapshot);

        console.log(`[DB] Sync complete.`);

        // Return a success message and trigger a refresh
        return new Response(
            `<div id="sync-result" style="color: #10b981; margin-top: 10px; font-size: 13px;">✅ Migration successful. ${snapshot.links.length} links synced. Refreshing...</div>`,
            {
                status: 200,
                headers: {
                    "Content-Type": "text/html",
                    "HX-Trigger": "refreshSidebar, refresh",
                },
            }
        );

    } catch (error: any) {
        console.error('[DB] Sync error:', error);
        return new Response(
            `<div id="sync-result" style="color: #ef4444; margin-top: 10px; font-size: 13px;">❌ Sync failed: ${error.message}</div>`,
            { status: 500, headers: { "Content-Type": "text/html" } }
        );
    }
};
