import type { APIRoute } from 'astro';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'local-dev-password-123';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const formData = await request.formData();
        const password = formData.get('password')?.toString();

        if (password === ADMIN_PASSWORD) {
            // Set a secure, HTTP-only session cookie valid for 30 days
            const thirtyDays = 60 * 60 * 24 * 30;

            // Generate a simple deterministic token for this session
            // In a production multi-user app, this would be a secure random string stored in a DB
            const token = Buffer.from(ADMIN_PASSWORD + 'salt' + new Date().toISOString().substring(0, 10)).toString('base64');

            cookies.set('dashboard_session', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: thirtyDays
            });

            return new Response(null, {
                status: 200,
                headers: {
                    'HX-Redirect': '/'
                }
            });
        } else {
            return new Response('Invalid Master Password', { status: 401 });
        }
    } catch (e) {
        return new Response('Error logging in', { status: 500 });
    }
};
