# TEO

TEO is a spatial productivity app built around **Write → Swipe → Organise**.

- Swipe left: Note
- Swipe right: Task
- Swipe up: Todo (project container)
- Tap Calendar: morph into the shared timeline view

The Fold-first UI keeps a compact Memo Pad in a four-way TEO layout on a plain cream-white background (no wallpaper). Opening the app plays a white-screen jelly birth → four drops → Theo faces → memo zoom-in sequence. The supplied navigation and pixel character sheets are included intact under `public/assets`; SVG viewports display the relevant artwork without the original sheet labels. Today is labelled Todo.

Both folded and expanded screens use Todo above, Note left, Task right, Calendar below. The separate Project icon has been removed: Todo itself is the project container, with child Tasks that have title, content, start/due dates and completion. The toolbar contains only Trash and Setting. Automatic layout uses available width and aspect ratio, not pointer type; Setting also provides a manual override and reduced-motion option.

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

## Galaxy Android APK and Fold widget

The repository includes a Capacitor Android shell under `android/`. The shell loads the public Cloudflare URL (`https://theo-flow.dbsguswl0110.workers.dev/`) instead of freezing a second copy of the web app inside the APK. This means normal UI/API releases deployed to Cloudflare are available in the installed app the next time it opens, without reinstalling the APK.

The native shell now registers a Galaxy-compatible Android Home Screen widget. Its large/resizable layout shows open Todo/Task items on the left and the current month's calendar on the right; tapping it opens TEO. The widget reads `GET /api/items` directly and does not create a second widget database. It refreshes on the Android widget schedule and displays a small sync status. The app label and launcher artwork are TEO. Because the widget and launcher are native Android changes, this release requires installing the newly built APK once.

Build locally when Android Studio/SDK and Java 21 are installed:

```bash
npm run android:build
```

The installable debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions also builds this APK on every push to `main` and publishes it as an `android-debug-apk` workflow artifact.

This environment does not contain a Java runtime, so the APK is built by the repository workflow rather than locally. Open the latest successful GitHub Actions run and download its `android-debug-apk` artifact.

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

The Memo Pad uses a 65px directional swipe threshold and spring-back for incomplete gestures. Completed swipes fly in the chosen direction without needing to hit an icon, then scale down, fade out, show a registration toast, and regenerate a blank Memo Pad. Focus mode keeps the Memo Pad crisp while applying a light `rgba(0,0,0,.03)` tint and a 7px backdrop blur behind it. Deadline bars interpolate continuously from green through yellow and orange to red at the defined 0/30/50/70% thresholds.

Drag the memo handle or paper margin; text fields retain text selection and scrolling. Arrow keys on the handle are accessible save actions. Visible arrow/category buttons have been removed from the memo. Tapping its paper or handle focuses the title. Saving never navigates into a collection. Calendar opens on tap and shows Todo and Task (including child Tasks) together, never Notes. Its bottom Todo/Task switches open the matching collections, and closing the collection returns to Calendar. It draws continuous start-to-due bars across each week. Detail and creation reuse the same MemoFields form, including a NONE/DUE toggle and a date field that is disabled when NONE is selected.

Positioning wrappers own the centering transform; only their children own animation transforms. This separation fixes the former off-screen memo and icon drift.

The layout tracks the browser visual viewport when the keyboard appears. The expanded memo reserves left/right/top icon space; Calendar is hidden while writing.

`0003_folders_tasks.sql` adds a `folders` table, a nullable Note folder, and content/start/due fields for child Tasks without deleting existing data. `GET/POST /api/folders` lists/creates folders; Note collection and detail provide folder assignment. Folder names are currently flat, not nested.

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

`CHROME_PATH` optionally selects an installed Chrome executable. `TEST_URL` changes the UI test server (default http://127.0.0.1:5174). Tests cover 344/360/412 px folded, 768/900 px expanded, 1440 px desktop, touch drag, all swipe directions, draft retention, calendar list navigation, folder classification and Todo child Tasks. API smoke tests are deliberately hardcoded to localhost and remove only their own test records. Browser-emulated viewports and keyboard resizing do not replace final testing on a physical Galaxy Fold and its Android WebView.
