# Theo Flow

Theo Flow is a spatial productivity app built around **Write → Swipe → Organise**.

- Swipe left: Note
- Swipe right: Task
- Swipe up: Project Todo
- Tap Calendar: morph into the shared timeline view

The Fold-first UI keeps the Memo Pad at the centre of a four-way Theo layout and expands the same relationship for a Fold-open or desktop viewport. The provided Theo sticker wallpaper and Theo icon sheet are bundled under `public/assets`.

## Local development

```bash
npm install
npm run dev
```

For a production-like Worker preview:

```bash
npm run cf:dev
```

`npm run check` runs the TypeScript project check and `npm run build` creates `dist/`.

## Data model

Cloudflare D1 stores one `items` source of truth for Notes, Tasks, and Project Todos. `sub_todos` holds project children and `photos` stores R2 object metadata. The Worker exposes `GET/POST /api/items`, `PUT/DELETE /api/items/:id`, `POST /api/items/:id/photos`, `GET/DELETE /api/photos/:id`.

The browser keeps a localStorage fallback for offline/local Vite development and switches to the API automatically when the Worker API responds.

## Cloudflare setup

The checked-in `wrangler.jsonc` binds D1 `theo-flow`, R2 `theo-flow-photos`, and the static Vite output in `dist/`.

```bash
npx wrangler d1 migrations apply theo-flow --remote
npm run cf:deploy
```

## Interaction details

The Memo Pad uses a 90px swipe threshold and spring-back for incomplete gestures. Completed swipes follow a curved flight, scale down, fade out, show a registration toast, and regenerate a blank Memo Pad. Focus mode keeps the Memo Pad crisp while applying `rgba(0,0,0,.10)` and a 7px backdrop blur behind it. Deadline bars interpolate continuously from green through yellow and orange to red at the defined 0/30/50/70% thresholds.
