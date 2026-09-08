const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
const row = (x) => ({ ...x, completed: Boolean(x.completed) });
const validDates = (b) =>
  /^\d{4}-\d{2}-\d{2}$/.test(b.startDate || "") &&
  (!b.dueDate ||
    (/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) && b.dueDate >= b.startDate));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === "/api/folders" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT name FROM folders ORDER BY name",
        ).all();
        return json(results.map((f) => f.name));
      }
      if (url.pathname === "/api/folders" && request.method === "POST") {
        const b = await request.json(),
          name = String(b.name || "").trim();
        if (!name || name.length > 60 || name === "*")
          return json({ error: "Valid folder name required." }, 400);
        await env.DB.prepare(
          "INSERT OR IGNORE INTO folders (name,created_at) VALUES (?,?)",
        )
          .bind(name, new Date().toISOString())
          .run();
        return json({ name }, 201);
      }
      if (url.pathname === "/api/items" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM items ORDER BY created_at DESC",
        ).all();
        const items = await Promise.all(
          results.map(async (i) => {
            const subs =
              i.type === "todo"
                ? (
                    await env.DB.prepare(
                      "SELECT * FROM sub_todos WHERE project_id=? ORDER BY sort_order",
                    )
                      .bind(i.id)
                      .all()
                  ).results
                : [];
            const photos =
              i.type === "note"
                ? (
                    await env.DB.prepare(
                      "SELECT id,file_name,content_type FROM photos WHERE item_id=? ORDER BY created_at",
                    )
                      .bind(i.id)
                      .all()
                  ).results
                : [];
            return { ...row(i), subTodos: subs.map(row), photos };
          }),
        );
        return json(items);
      }
      if (url.pathname === "/api/items" && request.method === "POST") {
        const b = await request.json();
        if (
          !["note", "task", "todo"].includes(b.type) ||
          !String(b.title || "").trim() ||
          !validDates(b)
        )
          return json(
            { error: "Title, valid type and dates are required." },
            400,
          );
        const id = b.id || crypto.randomUUID(),
          now = new Date().toISOString();
        const statements = [
          env.DB.prepare(
            "INSERT INTO items (id,type,title,content,start_date,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
          ).bind(
            id,
            b.type,
            String(b.title).trim(),
            String(b.content || ""),
            b.startDate,
            b.dueDate || null,
            now,
            now,
          ),
        ];
        if (b.type === "todo" && Array.isArray(b.subTodos))
          for (const [n, title] of b.subTodos
            .filter(Boolean)
            .slice(0, 100)
            .entries())
            statements.push(
              env.DB.prepare(
                "INSERT INTO sub_todos (id,project_id,title,sort_order) VALUES (?,?,?,?)",
              ).bind(crypto.randomUUID(), id, String(title), n),
            );
        await env.DB.batch(statements);
        return json({ id }, 201);
      }
      const itemMatch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
      if (itemMatch && request.method === "PUT") {
        const b = await request.json(),
          now = new Date().toISOString();
        if (
          !String(b.title || "").trim() ||
          !validDates(b) ||
          (Array.isArray(b.subtasks) &&
            b.subtasks.some(
              (s) =>
                !validDates({
                  startDate: s.startDate || b.startDate,
                  dueDate: s.dueDate,
                }),
            ))
        )
          return json({ error: "Title and valid dates required." }, 400);
        const existing = await env.DB.prepare(
          "SELECT type,folder FROM items WHERE id=?",
        )
          .bind(itemMatch[1])
          .first();
        if (!existing) return json({ error: "Not found" }, 404);
        const folder =
          existing.type === "note"
            ? b.folder === undefined
              ? existing.folder
              : b.folder || null
            : null;
        if (
          folder &&
          !(await env.DB.prepare("SELECT name FROM folders WHERE name=?")
            .bind(folder)
            .first())
        )
          return json({ error: "Folder not found" }, 400);
        const statements = [
          env.DB.prepare(
            "UPDATE items SET title=?,content=?,start_date=?,due_date=?,completed=?,updated_at=?,deleted_at=?,folder=? WHERE id=?",
          ).bind(
            String(b.title).trim(),
            String(b.content || ""),
            b.startDate,
            b.dueDate || null,
            b.completed ? 1 : 0,
            now,
            b.deletedAt || null,
            folder,
            itemMatch[1],
          ),
        ];
        if (Array.isArray(b.subtasks)) {
          statements.push(
            env.DB.prepare("DELETE FROM sub_todos WHERE project_id=?").bind(
              itemMatch[1],
            ),
          );
          if (existing.type === "todo")
            for (const [index, subtask] of b.subtasks.slice(0, 100).entries())
              statements.push(
                env.DB.prepare(
                  "INSERT INTO sub_todos (id,project_id,title,completed,sort_order,content,start_date,due_date) VALUES (?,?,?,?,?,?,?,?)",
                ).bind(
                  subtask.id || crypto.randomUUID(),
                  itemMatch[1],
                  String(subtask.title || ""),
                  subtask.completed ? 1 : 0,
                  index,
                  String(subtask.content || ""),
                  subtask.startDate || b.startDate,
                  subtask.dueDate || null,
                ),
              );
        }
        await env.DB.batch(statements);
        return json({ ok: true });
      }
      if (itemMatch && request.method === "DELETE") {
        const photos = (
          await env.DB.prepare("SELECT object_key FROM photos WHERE item_id=?")
            .bind(itemMatch[1])
            .all()
        ).results;
        await Promise.all(photos.map((p) => env.PHOTOS.delete(p.object_key)));
        await env.DB.prepare("DELETE FROM items WHERE id=?")
          .bind(itemMatch[1])
          .run();
        return json({ ok: true });
      }
      const photoMatch = url.pathname.match(/^\/api\/items\/([^/]+)\/photos$/);
      if (photoMatch && request.method === "POST") {
        if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
          return json({ error: "Image too large." }, 413);
        const parent = await env.DB.prepare(
          "SELECT type,deleted_at FROM items WHERE id=?",
        )
          .bind(photoMatch[1])
          .first();
        if (!parent || parent.type !== "note" || parent.deleted_at)
          return json({ error: "Active note required." }, 400);
        const form = await request.formData(),
          file = form.get("photo");
        if (
          !(file instanceof File) ||
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
            "image/heic",
            "image/heif",
          ].includes(file.type)
        )
          return json({ error: "Image required." }, 400);
        if (file.size > 10 * 1024 * 1024)
          return json({ error: "Image too large." }, 413);
        const id = crypto.randomUUID(),
          key = `${photoMatch[1]}/${id}-${file.name}`;
        await env.PHOTOS.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });
        try {
          await env.DB.prepare(
            "INSERT INTO photos (id,item_id,object_key,file_name,content_type,created_at) VALUES (?,?,?,?,?,?)",
          )
            .bind(
              id,
              photoMatch[1],
              key,
              file.name,
              file.type,
              new Date().toISOString(),
            )
            .run();
        } catch (error) {
          await env.PHOTOS.delete(key);
          throw error;
        }
        return json({ id, fileName: file.name }, 201);
      }
      const servePhoto = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
      if (servePhoto && request.method === "GET") {
        const p = await env.DB.prepare(
          "SELECT object_key,content_type FROM photos WHERE id=?",
        )
          .bind(servePhoto[1])
          .first();
        if (!p) return new Response("Not found", { status: 404 });
        const obj = await env.PHOTOS.get(p.object_key);
        if (!obj) return new Response("Not found", { status: 404 });
        return new Response(obj.body, {
          headers: {
            "content-type": p.content_type,
            "cache-control": "private, max-age=3600",
          },
        });
      }
      const deletePhoto = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
      if (deletePhoto && request.method === "DELETE") {
        const p = await env.DB.prepare(
          "SELECT object_key FROM photos WHERE id=?",
        )
          .bind(deletePhoto[1])
          .first();
        if (p) await env.PHOTOS.delete(p.object_key);
        await env.DB.prepare("DELETE FROM photos WHERE id=?")
          .bind(deletePhoto[1])
          .run();
        return json({ ok: true });
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "api_error",
          path: url.pathname,
          message: error.message,
        }),
      );
      return json({ error: "Unable to complete request." }, 500);
    }
  },
};
