import db from "../../../lib/db";
import { createAutoBackup } from "../../../lib/backup";

export async function POST({ request, params }: { request: Request, params: { id: string } }) {
    const { id } = params;
    const data = await request.formData();
    const name = data.get("name")?.toString();

    if (!name) return new Response("Name is required", { status: 400 });

    await db.updatePanel(id, name);

    return new Response(null, {
        status: 200,
        headers: {
            "HX-Trigger": "refresh, refreshSidebar"
        }
    });
}

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
