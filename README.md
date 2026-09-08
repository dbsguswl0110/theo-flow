# Theo Flow

Theo Flow is a spatial productivity app built around **Write → Swipe → Organise**.

- Swipe left: Note
- Swipe right: Task
- Swipe up: Project Todo
- Tap Calendar: morph into the shared timeline view

The Fold-first UI keeps the Memo Pad at the centre of a four-way Theo layout. Opening the app plays a white-screen jelly birth → four drops → Theo faces → memo zoom-in sequence. The supplied navigation and pixel character sheets are included intact under `public/assets`; SVG viewports display the relevant artwork without the original sheet labels. Today is labelled Todo.

Expanded screens use two thumb-area docks: Note / Todo on the left, Task / Project on the right, Calendar at bottom centre. Todo shows project subtasks; Project opens the project collection. The toolbar contains only Trash and Setting. Automatic layout uses available width and aspect ratio, not pointer type; Setting also provides a manual override and reduced-motion option.

## Local development

```bash
npm install
npm run dev
```

Vite alone previews the UI. For working API/storage, initialise the local D1 database and run the Worker:

```bash
npx wrangler d1 migrations apply theo-flow --local
npm run cf:dev
```

`npm run check` runs the TypeScript project check and `npm run build` creates `dist/`.

## Data model

Cloudflare D1 stores one `items` source of truth for Notes, Tasks, and Project Todos. `sub_todos` holds project children and `photos` stores R2 object metadata. The Worker exposes `GET/POST /api/items`, `PUT/DELETE /api/items/:id`, `POST /api/items/:id/photos`, `GET/DELETE /api/photos/:id`.

The browser caches the last synced records in localStorage and refreshes from the API on focus and every 15 seconds. New or edited records are confirmed only after the server accepts them. A failed swipe keeps its draft and displays a retry message; this is not an offline mutation queue. A revision guard prevents an in-flight refresh from overwriting a local save.

`0002_trash.sql` adds a nullable deletion timestamp. Trash is reversible; it does not delete photos or subtasks. Project updates and subtask replacement use a D1 batch transaction. Notes support R2 photo uploads up to 10 MB and animated photo removal.

**Access boundary:** this V1 uses one shared workspace, with no login or per-user access control. Anyone able to access its URL/API can read or modify that workspace. Do not store sensitive personal or business information until authentication is added.

## Galaxy Android APK

The repository includes a Capacitor Android shell under `android/`. The shell loads the public Cloudflare URL (`https://theo-flow.dbsguswl0110.workers.dev/`) instead of freezing a second copy of the web app inside the APK. This means normal UI/API releases deployed to Cloudflare are available in the installed app the next time it opens, without reinstalling the APK. Native-shell changes (permissions, plugins, or Android code) still require a new APK version.

Build locally when Android Studio/SDK and Java 21 are installed:

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

For headless deployment use the `CLOUDFLARE_API_TOKEN` environment variable with Workers, D1 and R2 permissions and, when required, `CLOUDFLARE_ACCOUNT_ID`. Runtime storage is supplied via `DB`, `PHOTOS` and `ASSETS` bindings; no client-side secret or extra environment variable is needed. Apply all remote migrations **before** deploying this revision. Back up production data before schema changes.

When updating the web experience, run `npm run cf:deploy`. The Android app points to that same Worker URL, so no APK rebuild is needed for those web-only updates.

## Interaction details

The Memo Pad uses a 90px swipe threshold and spring-back for incomplete gestures. Completed swipes follow a curved flight, scale down, fade out, show a registration toast, and regenerate a blank Memo Pad. Focus mode keeps the Memo Pad crisp while applying `rgba(0,0,0,.10)` and a 7px backdrop blur behind it. Deadline bars interpolate continuously from green through yellow and orange to red at the defined 0/30/50/70% thresholds.

Drag the memo handle or paper margin; text fields retain text selection and scrolling. Arrow keys on the handle and the small direction buttons are equivalent accessible save actions. Saving never navigates into a collection. Calendar opens on tap and draws continuous start-to-due bars across each week. Detail and creation reuse the same MemoFields form, including explicit None/date due-date selection.

Positioning wrappers own the centering transform; only their children own animation transforms. This separation fixes the former off-screen memo and icon drift.

## Verification

```bash
npm run check
npm run build
npx playwright install chromium
# Start Vite on port 5174 in a separate terminal:
npm run dev -- --port 5174
npx playwright test tests/flow.spec.ts
# With local Wrangler running on port 8787:
node tests/api-smoke.mjs
```

`CHROME_PATH` optionally selects an installed Chrome executable. `TEST_URL` changes the UI test server (default http://127.0.0.1:5174). Tests cover 344/360/412 px folded, 768/900 px expanded, 1440 px desktop, touch drag, all swipe directions, draft retention, calendar, edit and trash restore. API smoke tests are deliberately hardcoded to localhost and remove only their own test records. Browser-emulated viewports and keyboard resizing do not replace final testing on a physical Galaxy Fold and its Android WebView.
