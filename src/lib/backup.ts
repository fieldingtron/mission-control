import db from './db';

/**
 * Create an automatic backup snapshot before a destructive operation.
 * Keeps only the last 10 backups (oldest is pruned automatically).
 */
export async function createAutoBackup(label: string): Promise<void> {
    try {
        const snapshot = await db.getFullSnapshot();
        const data = JSON.stringify(snapshot);
        await db.createBackup(label, data);
        await db.pruneBackups(10);
    } catch (e) {
        // Non-fatal: backup failure should never block the actual operation
        console.warn('[backup] Auto-backup failed:', e);
    }
}
