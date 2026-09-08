// Run only against an isolated local Worker; never touches production items.
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:8787";
const ids = [];
async function request(path, method = "GET", data) {
  return fetch(origin + path, {
    method,
    headers:
      data && !(data instanceof FormData)
        ? { "content-type": "application/json" }
        : {},
    body:
      data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });
}
try {
  const id = crypto.randomUUID();
  ids.push(id);
  const item = {
    id,
    type: "todo",
    title: "API QA project",
    content: "test",
    startDate: "2026-09-08",
    dueDate: "2026-09-14",
    subTodos: ["first"],
  };
  assert.equal((await request("/api/items", "POST", item)).status, 201);
  let all = await (await request("/api/items")).json();
  assert.equal(all.find((i) => i.id === id).subTodos.length, 1);
  const updated = {
    ...item,
    subtasks: [{ id: crypto.randomUUID(), title: "edited", completed: true }],
    deletedAt: new Date().toISOString(),
  };
  assert.equal((await request("/api/items/" + id, "PUT", updated)).status, 200);
  all = await (await request("/api/items")).json();
  assert.ok(all.find((i) => i.id === id).deleted_at);
  assert.equal(all.find((i) => i.id === id).subTodos[0].completed, true);
  assert.equal(
    (await request("/api/items/" + id, "PUT", { ...updated, deletedAt: null }))
      .status,
    200,
  );
  assert.equal(
    (
      await request("/api/items/" + id, "PUT", {
        ...updated,
        dueDate: "2026-01-01",
      })
    ).status,
    400,
  );
  const noteId = crypto.randomUUID();
  ids.push(noteId);
  assert.equal(
    (await request("/api/items", "POST", { ...item, id: noteId, type: "note" }))
      .status,
    201,
  );
  const photo = new FormData();
  photo.append(
    "photo",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "qa.png",
  );
  const upload = await request(
    "/api/items/" + noteId + "/photos",
    "POST",
    photo,
  );
  assert.equal(upload.status, 201);
  const { id: photoId } = await upload.json();
  assert.equal((await request("/api/photos/" + photoId)).status, 200);
  assert.equal((await request("/api/photos/" + photoId, "DELETE")).status, 200);
  assert.equal((await request("/api/photos/" + photoId)).status, 404);
  console.log(
    "PASS local D1 create/update/subtodos/trash/restore/date validation; R2 upload/read/delete.",
  );
} finally {
  for (const id of ids) await request("/api/items/" + id, "DELETE");
}
