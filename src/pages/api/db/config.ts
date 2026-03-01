import type { APIRoute } from "astro";
import db from "../../../lib/db";
import { getDbConfig, saveDbConfig, type DbProvider } from "../../../lib/db-config";

export const POST: APIRoute = async ({ request }) => {
    const formData = await request.formData();
    const provider = formData.get("provider") as DbProvider;
    const config = getDbConfig();

    config.provider = provider || 'sqlite';

    if (provider === 'turso') {
        config.tursoUrl = formData.get("tursoUrl")?.toString() || config.tursoUrl;
        config.tursoToken = formData.get("tursoToken")?.toString() || config.tursoToken;
    } else if (provider === 'supabase') {
        config.supabaseUrl = formData.get("supabaseUrl")?.toString() || config.supabaseUrl;
        config.supabaseAnonKey = formData.get("supabaseAnonKey")?.toString() || config.supabaseAnonKey;
    }

    saveDbConfig(config);

    // Re-initialize the adapter so the app starts using the new database immediately
    (db as any).reinit();

    // Return the updated settings fragment
    const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol;
    const host = request.headers.get("host");
    const response = await fetch(`${protocol}://${host}/api/fragments/settings`);
    const html = await response.text();

    return new Response(html, {
        status: 200,
        headers: {
            "Content-Type": "text/html",
            "HX-Trigger": "refreshSidebar, refresh",
        },
    });
};
