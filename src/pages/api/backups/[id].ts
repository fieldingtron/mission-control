import db from '../../../lib/db';
import type { Snapshot } from '../../../lib/db';

// POST /api/backups/[id]/restore
export async function POST({ params }: { params: { id: string } }) {
    const backup = await db.getBackup(params.id);
    if (!backup || !backup.data) {
        return new Response(JSON.stringify({ error: 'Backup not found' }), { status: 404 });
    }

    const snapshot: Snapshot = JSON.parse(backup.data);

    try {
        await db.restoreBackup(snapshot);
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Restore failed' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'HX-Trigger': 'refresh, refreshSidebar'
        }
    });
}

// DELETE /api/backups/[id]
export async function DELETE({ params }: { params: { id: string } }) {
    await db.deleteBackup(params.id);
    return new Response(null, {
        status: 204,
        headers: { 'HX-Trigger': 'backupsUpdated' }
    });
}
