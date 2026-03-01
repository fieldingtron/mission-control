import type { APIRoute } from 'astro';
import db from '../../lib/db';

export const GET: APIRoute = async () => {
  const categories = await db.getCategories();
  const links = await db.getLinks();
  const result = categories.map(c => ({
    ...c,
    links: links.filter(l => l.category_id === c.id),
  }));
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};
