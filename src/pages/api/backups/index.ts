import db from '../../../lib/db';

// POST /api/backups — create a snapshot of the current state
export async function POST() {
    const snapshot = await db.getFullSnapshot();
    const data = JSON.stringify(snapshot);

    await db.createBackup(
        `Manual backup — ${new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })}`,
        data
    );

    // Prune to last 10 backups
    await db.pruneBackups(10);

    const count = await db.getBackupCount();

    return new Response(JSON.stringify({ success: true, total: count }), {
        status: 201,
        headers: {
            'Content-Type': 'application/json',
            'HX-Trigger': 'backupsUpdated'
        }
    });
}

// GET /api/backups — list all backups
export async function GET() {
    const backups = await db.getBackups(10);
    return new Response(JSON.stringify(backups), {
        headers: { 'Content-Type': 'application/json' }
    });
}
