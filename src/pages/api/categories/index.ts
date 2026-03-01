import type { APIRoute } from 'astro';
import db from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const name = formData.get('name')?.toString();
  const panelId = formData.get('panel_id')?.toString();

  if (!name?.trim()) {
    return new Response('Name required', { status: 400 });
  }

  if (!panelId) {
    return new Response('Panel ID required', { status: 400 });
  }

  await db.addCategory(name.trim(), panelId);

  return new Response(null, {
    status: 200,
    headers: {
      'HX-Trigger': 'refresh'
    }
  });
};
