import db from "../../../lib/db";
import { createAutoBackup } from "../../../lib/backup";

export async function DELETE({ params }: { params: { id: string } }) {
    const { id } = params;
    const panel = await db.getPanel(id);
    await createAutoBackup(`Before delete panel: ${panel?.name || id}`);

    await db.deletePanel(id);

    return new Response(null, {
        status: 204,
        headers: {
            "HX-Trigger": "refresh, refreshSidebar"
        }
    });
}
