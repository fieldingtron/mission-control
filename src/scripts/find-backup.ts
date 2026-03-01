import db from '../../src/lib/db.js';

async function main() {
    const backups = await db.getBackups(20);
    console.log(`Found ${backups.length} backups.`);

    for (const b of backups) {
        const full = await db.getBackup(b.id);
        if (!full || !full.data) continue;
        try {
            const data = JSON.parse(full.data);
            console.log(`Backup #${b.id} | Label: ${b.label} | Created: ${b.created_at}`);
            console.log(`  Links: ${data.links?.length} | Cats: ${data.categories?.length} | Panels: ${data.panels?.length}`);

            // Print first couple categories to see if they are real or "RENAMED_CATEGORY"
            const catNames = data.categories?.slice(0, 3).map((c: any) => c.name).join(', ');
            console.log(`  First 3 cats: ${catNames}`);
            console.log('---');
        } catch (e) {
            console.error(`Error parsing backup #${b.id}:`, e);
        }
    }
}
main().catch(console.error);
