import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect }) => {
    cookies.delete('dashboard_session', { path: '/' });

    return new Response(null, {
        status: 200,
        headers: {
            'HX-Redirect': '/login'
        }
    });
};
