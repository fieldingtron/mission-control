import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { createAutoBackup } from '../../../lib/backup';

export const POST: APIRoute = async ({ request, params }) => {
  const formData = await request.formData();
  const name = formData.get('name')?.toString();

  if (!name?.trim()) {
    return new Response('Name required', { status: 400 });
  }

  await db.updateCategory(params.id!, name.trim());

  return new Response(null, {
    status: 200,
    headers: {
      'HX-Trigger': 'refresh'
    }
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const cat = await db.getCategory(params.id!);
  await createAutoBackup(`Before delete category: ${cat?.name || params.id}`);
  await db.deleteCategory(params.id!);
  return new Response(null, { status: 200 });
};
