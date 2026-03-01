import type { APIRoute } from 'astro';
import db from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const name = formData.get('name')?.toString();
  const url = formData.get('url')?.toString();
  const category_id = formData.get('category_id')?.toString();
  const description = formData.get('description')?.toString();

  if (!category_id || !name?.trim() || !url?.trim()) {
    return new Response('Missing fields', { status: 400 });
  }

  const normalizedUrl = url.trim().match(/^[a-zA-Z]+:\/\//) ? url.trim() : `https://${url.trim()}`;

  const maxPosition = await db.getMaxLinkPosition();
  const position = maxPosition + 1;

  await db.addLink(parseInt(category_id), name.trim(), normalizedUrl, position, description?.trim() || null);

  return new Response(null, {
    status: 200,
    headers: {
      'HX-Trigger': 'refresh'
    }
  });
};
