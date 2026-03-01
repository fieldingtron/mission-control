import db from "../../../lib/db";

export async function POST({ request }: { request: Request }) {
    const { ids } = await request.json();

    await db.reorderPanels(ids);

    return new Response(null, { status: 204 });
}
