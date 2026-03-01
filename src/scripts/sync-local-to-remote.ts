import db, { SqliteAdapter, initializeAdapter } from "../lib/db";
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const configPath = join(dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: configPath });

async function sync() {
    try {
        console.log(`[DB] Syncing local SQLite data to remote...`);

        // Initialize the remote adapter (Supabase)
        initializeAdapter();

        // Read from the local SQLite database
        const localDb = new SqliteAdapter();
        const snapshot = await localDb.getFullSnapshot();

        console.log(`[DB] Found ${snapshot.panels.length} panels, ${snapshot.categories.length} categories, ${snapshot.links.length} links on local SQLite.`);

        // Push exactly this snapshot to the currently active remote adapter (Wipe & Replace)
        await db.restoreBackup(snapshot);

        console.log(`[DB] Sync complete.`);
    } catch (error) {
        console.error('[DB] Sync error:', error);
    }
}

sync();
