import type { APIRoute } from 'astro';
import db from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  const { ids } = await request.json();
  if (!Array.isArray(ids)) {
    return new Response(JSON.stringify({ error: 'ids must be an array' }), { status: 400 });
  }
  await db.reorderCategories(ids);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
