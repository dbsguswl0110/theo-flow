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

`0002_trash.sql` adds a nullable deletion timestamp. Trash is reversible; it does not delete photos or subtasks. "영구삭제" asks for confirmation, then removes the selected items (and their photos) and updates the list in place without reloading the app; trash older than three days is purged on the next `GET /api/items`. That endpoint reads items, subtasks and photos in a single D1 batch, so its query count does not grow with the number of items. Project updates and subtask replacement use a D1 batch transaction. Notes support R2 photo uploads up to 10 MB and animated photo removal.

**Access boundary:** this V1 uses one shared workspace, with no login or per-user access control. Anyone able to access its URL/API can read or modify that workspace. Do not store sensitive personal or business information until authentication is added.

## Galaxy Android APK and Fold widget

The repository includes a Capacitor Android shell under `android/`. The shell loads the public Cloudflare URL (`https://theo-flow.dbsguswl0110.workers.dev/`) instead of freezing a second copy of the web app inside the APK. This means normal UI/API releases deployed to Cloudflare are available in the installed app the next time it opens, without reinstalling the APK.

The native shell now registers a Galaxy-compatible Android Home Screen widget. Its large/resizable layout shows open Todo/Task items on the left and the current month's calendar on the right; tapping it opens TEO. The widget reads `GET /api/items` directly and does not create a second widget database. It refreshes on the Android widget schedule and displays a small sync status. The app label and launcher artwork are TEO. Because the widget and launcher are native Android changes, this release requires installing the newly built APK once.

## macOS Calendar widget

`macos/TEOFlow` contains a lightweight SwiftUI host app and WidgetKit extension for macOS 14+. The widget uses the same `GET /api/items` endpoint as the Android widget, renders Todo/Task items inside a translucent blurred monthly calendar, and provides NOTE / TASK / TODO / + quick links. The links open the matching TEO page through the `teoflow://` URL scheme; the `+` link opens the note page where a new entry can be created. Small widgets only open the calendar (WidgetKit does not support `Link` there), so the quick links appear in medium and large widgets. The host app uses a single window: widget links reuse it, and tapping the same link again navigates again. The checked-in source is intentionally independent of the web UI so the widget remains usable when the main app is closed.

Source layout under `macos/TEOFlow`: `Shared/` (the `/api/items` client, month and week-lane maths, colours) is compiled into both the widget and the panel; `TEOFlow/` is the host app, `TEOFlowWidget/` the widget, `Panel/` the floating panel. Build the executables with Xcode's macOS SDK (Apple Silicon); the script compiles every `.swift` file in each target's folders, so adding a file needs no other change:

```bash
./macos/build.sh host     # artifacts/macos/build/TEOFlow
./macos/build.sh widget   # artifacts/macos/build/TEOFlowWidget
./macos/build.sh panel    # artifacts/macos/build/TEOCalendarPanel
./macos/build.sh          # all three
```

The installed bundle is `TEO.app`; after opening it once, add **TEO Flow Calendar** from the macOS widget gallery. The widget refreshes every 15 minutes and reads the latest server data on the next timeline refresh. The host app is labelled **TEO Flow** so it is discoverable by searching `teo`.

## macOS floating calendar panel

`macos/TEOFlow/Panel` contains a separate native `TEO Calendar Panel.app` for keeping the calendar on the desktop. It intentionally does not open the web app or its launch animation: the panel is calendar-only and loads the same Todo/Task data from `/api/items`. It reloads every 60 seconds and on the refresh button; the footer shows when it last synced, and when a refresh fails the panel keeps the last data on screen and shows a "연결 확인 필요" notice instead of emptying the calendar (one malformed record never hides the others). Its glass surface uses a light 5% overlay with a native blurred HUD material, has no visible close button, and can be resized from the window edges.

Items are drawn like the web calendar and the Android widget: an item with a due date is one continuous bar per week (To Do orange, Task teal), an item without one is a dot and a title, and completed items stay visible but dimmed and struck through. A day with more items than fit shows "+n". The code is split by job: `PanelWindow` (the window), `PanelStatusItem` (menu bar), `PanelStore` (loading and sync state), `PanelPreferences` (remembered settings), `PanelCalendarView` (drawing) and `PanelControls` (grip, glass, buttons). Because the panel has no Dock icon, menu or close button, a menu bar item (calendar icon) provides *패널 보이기 / 숨기기*, *새로고침*, *완료 항목 표시*, *항상 위에 표시*, the last sync time and *종료*. The panel remembers its position and size between launches.

The panel is floating and joins all Spaces. Window movement is deliberately restricted to the dotted grip at the end of the header button row; dragging the calendar body or the transparent title bar never moves the window, and the panel stays visible when another app is active. The initial panel size is 470×430 points with a 330×320 minimum. The weeks share the height that is left, so a six-week month never runs off the bottom, and a taller panel fits more bars under each day number. Build the executable with `./macos/build.sh panel`; the app bundle's Info.plist is `macos/TEOFlow/Resources/TEOCalendarPanel-Info.plist`.

The distributable archive is `artifacts/macos/TEO-Calendar-Panel.zip`. Open the app from `/Applications/TEO Calendar Panel.app`, then leave it running on the desktop as a lightweight calendar panel.

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

**Automatic deploys.** `.github/workflows/deploy.yml` deploys every push to `main` (every merged PR) and can also be run by hand from the Actions tab. Add the repository secrets `CLOUDFLARE_API_TOKEN` (permissions: Workers Scripts, D1 and R2 edit) and, only if the token spans several accounts, `CLOUDFLARE_ACCOUNT_ID`, under Settings → Secrets and variables → Actions. Each run type-checks, applies pending D1 migrations with `wrangler d1 migrations apply theo-flow --remote`, builds, deploys, and then requests the live site and `/api/folders` to confirm it answers. Without the token the run only prints a warning and deploys nothing. Because migrations run automatically, review any new file in `migrations/` before merging.

When updating the web experience by hand instead, run `npm run cf:deploy`. The Android app points to that same Worker URL, so no APK rebuild is needed for those web-only updates.

## Interaction details

The Memo Pad uses a 65px directional swipe threshold and spring-back for incomplete gestures. Completed swipes fly in the chosen direction without needing to hit an icon, then scale down, fade out, show a registration toast, and regenerate a blank Memo Pad. Focus mode keeps the Memo Pad crisp while applying a light `rgba(0,0,0,.03)` tint and a 7px backdrop blur behind it. Deadline bars interpolate continuously from green through yellow and orange to red at the defined 0/30/50/70% thresholds.

Drag the memo handle or paper margin; text fields retain text selection and scrolling. Arrow keys on the handle are accessible save actions. Visible arrow/category buttons have been removed from the memo. Tapping its paper or handle focuses the title. Saving never navigates into a collection. Calendar opens on tap. The month grid shows Todo and Task (including child Tasks) and never draws Notes; Notes appear next to them in the Information columns (To Do / Task / Note, all items by default, narrowed by choosing a day) and in the list view. The back arrow returns home. Opening a collection from a widget link is idempotent: the Android shell may re-send the link while the page loads, and it adds only one history entry. Detail and creation reuse the same MemoFields form, including a NONE/DUE toggle and a date field that is disabled when NONE is selected.

Positioning wrappers own the centering transform; only their children own animation transforms. This separation fixes the former off-screen memo and icon drift.

The layout tracks the browser visual viewport when the keyboard appears. The expanded memo reserves left/right/top icon space; Calendar is hidden while writing.

`0003_folders_tasks.sql` adds a `folders` table, a nullable Note folder, and content/start/due fields for child Tasks without deleting existing data. `GET/POST /api/folders` lists/creates folders; Note collection and detail provide folder assignment. Folder names are currently flat, not nested.

## TEO companion and feedback

TEO, the apricot toy poodle, lives on the home screen. He sits on a small cushion behind the memo pad's top edge (`TeoCompanion`), drawn from transparent frames of the supplied character sheet (`public/assets/teo-sprites.webp`). Regenerate that sheet and `src/lib/teoSprites.generated.ts` with `python3 tools/extract_teo_sprites.py` (needs pillow, numpy, scipy); frame sequences live in `src/lib/teoSprites.ts`.

- **Launch (about 2.8 s, skippable):** a drop falls onto a soft ground ring, squashes, springs back into a pearl and swells; the pearl crouches, then lets go of one bead per icon in turn. The beads swirl out along curved paths, slow into place and fade into the real icons as the screen is revealed. Every bead ends exactly on its icon and never overshoots (`tests/startup.spec.ts` samples every frame at four screen sizes). The timeline constants are at the top of `Startup.tsx`.
- **Idle:** slow blinks, and every 7–15 s a scratch, paw lick, yawn or look around. After about 24 s without any touch he yawns, curls up and sleeps; any touch wakes him.
- **While swiping:** the paper leans into the throw, shrinks slightly and the destination icon reaches out, glows and dims its neighbours in proportion to how far the swipe has gone (`--swipe` on the stage, 0 to 1). TEO looks toward the destination, and once the 65 px threshold is passed the icon wiggles and TEO cheers with his tongue out (a short haptic tick marks the moment).
- **On landing:** the icon squashes, hops and ripples, a burst of hearts / stars / bones / paws flies out (`BurstLayer`), the badge count pops, TEO cheers, and the toast carries his face. The destination stays lit until the server has accepted the memo; a failed save returns the memo without celebrating.
- **Counts and progress:** each icon shows a badge with open items (Note shows all notes; Calendar shows what is open today). Once anything is due today, the footer shows "오늘 done/total" as a bone-coloured meter; finishing the last item of the day triggers a bigger celebration once per day.
- **Checking things off:** checkboxes pop, confetti bursts from the box and TEO cheers (calendar cards, the timeline, task details and child tasks).
- **Petting:** tapping TEO sends hearts. Empty lists show him napping.
- **Settings:** "진동 피드백" (default on, `navigator.vibrate`; the Android shell declares the `VIBRATE` permission) and "효과음" (default off, short synthesised tones). "움직임 줄이기" or the system reduced-motion setting turns off particles, hopping, cheering and entrance animations and keeps TEO on a single still frame.

## Verification

```bash
npm run check
npm run build
npx playwright install chromium
# Start Vite on port 5174 in a separate terminal:
npm run dev -- --port 5174
npx playwright test tests/flow.spec.ts tests/startup.spec.ts tests/delight.spec.ts
# With local Wrangler running on port 8787:
node tests/api-smoke.mjs
```

`CHROME_PATH` optionally selects an installed Chrome executable. `TEST_URL` changes the UI test server (default http://127.0.0.1:5174). `tests/delight.spec.ts` covers the swipe progress, landing burst and badge, petting, check-off celebration, the daily meter and reduced motion. Tests cover 344/360/412 px folded, 768/900 px expanded, 1440 px desktop, touch drag, all swipe directions, draft retention, calendar list navigation, folder classification and Todo child Tasks. API smoke tests are deliberately hardcoded to localhost and remove only their own test records. Browser-emulated viewports and keyboard resizing do not replace final testing on a physical Galaxy Fold and its Android WebView.
