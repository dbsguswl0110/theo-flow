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

## Galaxy Android APK

The repository includes a Capacitor Android shell under `android/`. The shell loads the public Cloudflare URL (`https://theo-flow.dbsguswl0110.workers.dev/`) instead of freezing a second copy of the web app inside the APK. This means normal UI/API releases deployed to Cloudflare are available in the installed app the next time it opens, without reinstalling the APK. Native-shell changes (permissions, plugins, or Android code) still require a new APK version.

Build locally when Android Studio/SDK and Java 17 are installed:

```bash
npm run android:build
```

The installable debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions also builds this APK on every push to `main` and publishes it as an `android-debug-apk` workflow artifact.

## Cloudflare setup

The checked-in `wrangler.jsonc` binds:

- D1 database: `theo-flow`
- R2 bucket: `theo-flow-photos`
- Static Vite output: `dist/`

Create or reuse resources, then apply the migration:

```bash
npx wrangler d1 create theo-flow
npx wrangler r2 bucket create theo-flow-photos
npx wrangler d1 migrations apply theo-flow --remote
```

Update the D1 UUID in `wrangler.jsonc` if you create a new database. Deploy the Worker and static assets with:

```bash
npm run cf:deploy
```

Cloudflare authentication is provided by `wrangler login` or an existing Wrangler OAuth session. No credentials are committed to this repository.

When updating the web experience, run `npm run cf:deploy`. The Android app points to that same Worker URL, so no APK rebuild is needed for those web-only updates.

## Interaction details

The Memo Pad uses a 90px swipe threshold and spring-back for incomplete gestures. Completed swipes follow a curved flight, scale down, fade out, show a registration toast, and regenerate a blank Memo Pad. Focus mode keeps the Memo Pad crisp while applying `rgba(0,0,0,.10)` and a 7px backdrop blur behind it. Deadline bars interpolate continuously from green through yellow and orange to red at the defined 0/30/50/70% thresholds.
