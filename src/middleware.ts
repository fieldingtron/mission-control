import { defineMiddleware } from 'astro:middleware';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'local-dev-password-123';

export const onRequest = defineMiddleware((context: any, next: any) => {
    // 1. Allow the login page and authentication endpoints to be accessed publicly
    const url = new URL(context.request.url);
    if (url.pathname === '/login' || url.pathname.startsWith('/api/auth/')) {
        return next();
    }

    // 2. Allow static assets like CSS and JS payloads to load
    if (url.pathname.includes('.') || url.pathname.startsWith('/_astro/')) {
        return next();
    }

    // 3. Verify the Dashboard Session Cookie
    const sessionCookie = context.cookies.get('dashboard_session');

    // Calculate what the valid token should be for today (salt + date)
    // NOTE: If the user leaves the page open past midnight UTC, they might be prompted to log in again
    // In a prod app, we'd do a real database lookup for the session token.
    const expectedToken = Buffer.from(ADMIN_PASSWORD + 'salt' + new Date().toISOString().substring(0, 10)).toString('base64');

    if (!sessionCookie || sessionCookie.value !== expectedToken) {
        // Clear broken/expired cookies just in case
        if (sessionCookie) {
            context.cookies.delete('dashboard_session', { path: '/' });
        }

        // Redirect unauthorized users to the login screen
        return context.redirect('/login');
    }

    // If authenticated, let the request proceed to the Dashboard route / API endpoint
    return next();
});
