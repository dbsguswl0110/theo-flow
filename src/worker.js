const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const row = (x) => ({ ...x, completed: Boolean(x.completed) });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === '/api/items' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
        const items = await Promise.all(results.map(async i => {
          const subs = i.type === 'todo' ? (await env.DB.prepare('SELECT * FROM sub_todos WHERE project_id=? ORDER BY sort_order').bind(i.id).all()).results : [];
          const photos = i.type === 'note' ? (await env.DB.prepare('SELECT id,file_name,content_type FROM photos WHERE item_id=? ORDER BY created_at').bind(i.id).all()).results : [];
          return { ...row(i), subTodos: subs.map(row), photos };
        }));
        return json(items);
      }
      if (url.pathname === '/api/items' && request.method === 'POST') {
        const b = await request.json();
        if (!['note','task','todo'].includes(b.type) || !String(b.title || '').trim()) return json({ error: 'Title and valid type are required.' }, 400);
        const id = b.id || crypto.randomUUID(), now = new Date().toISOString();
        await env.DB.prepare('INSERT INTO items (id,type,title,content,start_date,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
          .bind(id,b.type,String(b.title).trim(),String(b.content||''),b.startDate||null,b.dueDate||null,now,now).run();
        if (b.type === 'todo') for (const [n, title] of (b.subTodos || []).filter(Boolean).entries()) await env.DB.prepare('INSERT INTO sub_todos (id,project_id,title,sort_order) VALUES (?,?,?,?)').bind(crypto.randomUUID(),id,title,n).run();
        return json({ id }, 201);
      }
      const itemMatch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
      if (itemMatch && request.method === 'PUT') {
        const b = await request.json(), now = new Date().toISOString();
        await env.DB.prepare('UPDATE items SET title=?,content=?,start_date=?,due_date=?,completed=?,updated_at=? WHERE id=?')
          .bind(b.title,b.content||'',b.startDate||null,b.dueDate||null,b.completed?1:0,now,itemMatch[1]).run();
        if (Array.isArray(b.subtasks)) {
          await env.DB.prepare('DELETE FROM sub_todos WHERE project_id=?').bind(itemMatch[1]).run();
          for (const [index, subtask] of b.subtasks.entries()) await env.DB.prepare('INSERT INTO sub_todos (id,project_id,title,completed,sort_order) VALUES (?,?,?,?,?)').bind(subtask.id || crypto.randomUUID(),itemMatch[1],subtask.title || '',subtask.completed ? 1 : 0,index).run();
        }
        return json({ ok: true });
      }
      if (itemMatch && request.method === 'DELETE') {
        const photos = (await env.DB.prepare('SELECT object_key FROM photos WHERE item_id=?').bind(itemMatch[1]).all()).results;
        await Promise.all(photos.map(p => env.PHOTOS.delete(p.object_key)));
        await env.DB.prepare('DELETE FROM items WHERE id=?').bind(itemMatch[1]).run();
        return json({ ok: true });
      }
      const photoMatch = url.pathname.match(/^\/api\/items\/([^/]+)\/photos$/);
      if (photoMatch && request.method === 'POST') {
        const form = await request.formData(), file = form.get('photo');
        if (!(file instanceof File) || !file.type.startsWith('image/')) return json({ error: 'Image required.' }, 400);
        const id = crypto.randomUUID(), key = `${photoMatch[1]}/${id}-${file.name}`;
        await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
        await env.DB.prepare('INSERT INTO photos (id,item_id,object_key,file_name,content_type,created_at) VALUES (?,?,?,?,?,?)').bind(id,photoMatch[1],key,file.name,file.type,new Date().toISOString()).run();
        return json({ id, fileName: file.name }, 201);
      }
      const servePhoto = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
      if (servePhoto && request.method === 'GET') {
        const p = await env.DB.prepare('SELECT object_key,content_type FROM photos WHERE id=?').bind(servePhoto[1]).first();
        if (!p) return new Response('Not found', { status: 404 });
        const obj = await env.PHOTOS.get(p.object_key); if (!obj) return new Response('Not found', { status: 404 });
        return new Response(obj.body, { headers: { 'content-type': p.content_type, 'cache-control': 'private, max-age=3600' } });
      }
      const deletePhoto = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
      if (deletePhoto && request.method === 'DELETE') {
        const p = await env.DB.prepare('SELECT object_key FROM photos WHERE id=?').bind(deletePhoto[1]).first();
        if (p) await env.PHOTOS.delete(p.object_key);
        await env.DB.prepare('DELETE FROM photos WHERE id=?').bind(deletePhoto[1]).run(); return json({ ok: true });
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) { return json({ error: error.message }, 500); }
  }
};
