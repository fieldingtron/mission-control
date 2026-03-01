import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { createAutoBackup } from '../../../lib/backup';

export const POST: APIRoute = async ({ request, params }) => {
  const formData = await request.formData();
  const name = formData.get('name')?.toString();
  const url = formData.get('url')?.toString();
  const category_id = formData.get('category_id')?.toString();
  const description = formData.get('description')?.toString();

  if (!category_id || !name?.trim() || !url?.trim()) {
    return new Response('Missing fields', { status: 400 });
  }

  const normalizedUrl = url.trim().match(/^[a-zA-Z]+:\/\//) ? url.trim() : `https://${url.trim()}`;

  await db.updateLink(params.id!, name.trim(), normalizedUrl, parseInt(category_id), description?.trim() || null);

  return new Response(null, {
    status: 200,
    headers: {
      'HX-Trigger': 'refresh'
    }
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const link = await db.getLink(params.id!);
  await createAutoBackup(`Before delete link: ${link?.name || params.id}`);
  await db.deleteLink(params.id!);
  return new Response(null, { status: 200 });
};
