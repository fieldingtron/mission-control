import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
    return new Response(JSON.stringify({
        last_sync: globalThis.process.env.LAST_SYNC_TIMESTAMP || 0
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};
