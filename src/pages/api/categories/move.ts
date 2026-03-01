import db from "../../../lib/db";

export async function POST({ request }: { request: Request }) {
    const { categoryId, panelId } = await request.json();

    if (!categoryId || !panelId) {
        return new Response(JSON.stringify({ error: "Missing categoryId or panelId" }), {
            status: 400,
        });
    }

    try {
        await db.moveCategory(categoryId, panelId);
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
        });
    }
}
