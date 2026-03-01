import type { APIRoute } from "astro";
import db, { SqliteAdapter } from "../../../lib/db";

export const POST: APIRoute = async ({ request }) => {
    try {
        console.log(`[DB] Syncing local SQLite data to Supabase...`);

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
