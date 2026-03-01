import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Adjust path to your database
const dbPath = join(__dirname, '../../data/links.db');
const db = new DatabaseSync(dbPath);

console.log('--- Database Verification ---');

// Check panels
const panels = db.prepare('SELECT * FROM panels ORDER BY position').all() as any[];
console.log(`Found ${panels.length} panels:`, panels.map(p => p.name).join(', '));

// Check categories per panel
panels.forEach(panel => {
    const cats = db.prepare('SELECT * FROM categories WHERE panel_id = :panelId').all({ panelId: panel.id }) as any[];
    console.log(`Panel [${panel.name}] has ${cats.length} categories.`);
});

// Check orphan categories
const orphans = db.prepare('SELECT * FROM categories WHERE panel_id IS NULL OR panel_id NOT IN (SELECT id FROM panels)').all() as any[];
if (orphans.length > 0) {
    console.warn(`WARNING: Found ${orphans.length} orphan categories!`);
} else {
    console.log('No orphan categories found.');
}

console.log('--- End of Verification ---');
