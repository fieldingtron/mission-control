import type { APIRoute } from 'astro';
import db from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
    const data = await request.formData();
    const name = data.get('name')?.toString();

    if (!name) {
        return new Response('Name is required', { status: 400 });
    }

    const result = await db.addPanel(name);

    return new Response(null, {
        status: 200,
        headers: {
            'HX-Redirect': `/?panel=${result.lastInsertRowid}`
        }
    });
};
