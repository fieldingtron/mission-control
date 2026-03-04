import db from '../lib/db';
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const configPath = join(dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: configPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function fetchSupabase(table: string) {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
        const options = {
            headers: {
                'apikey': SUPABASE_ANON_KEY || '',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(e); }
                } else {
                    reject(new Error(`Supabase API failed: ${res.statusCode} ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function migrate() {
    console.log(`🚀 Starting migration from Supabase -> SQLite`);
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
    }

    try {
        console.log(`📥 Fetching data from Supabase...`);
        const remotePanels = (await fetchSupabase('panels')) as any[];
        const remoteCategories = (await fetchSupabase('categories')) as any[];
        const remoteLinks = (await fetchSupabase('links')) as any[];

        console.log(`[Remote] Found ${remotePanels.length} panels, ${remoteCategories.length} categories, ${remoteLinks.length} links.`);

        // In case the local db already has dummy data, we will overwrite it with the snapshot mechanism
        const snapshot = {
            panels: remotePanels,
            categories: remoteCategories,
            links: remoteLinks
        };

        console.log(`💾 Pushing Supabase snapshot into local SQLite...`);
        // Using the same restore mechanism we use for backups
        // This completely replaces existing SQLite data with the remote data
        await db.restoreBackup(snapshot as any);

        console.log(`✅ Migration complete! Your Supabase data is now in SQLite.`);

    } catch (e) {
        console.error(`❌ Migration failed:`, e);
    }
}

migrate();
