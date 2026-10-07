# TEO

TEO is a spatial productivity app built around **Write → Swipe → Organise**.

- Swipe left: Note
- Swipe right: Task
- Swipe up: Todo (project container)
- Tap Calendar: morph into the shared timeline view

The Fold-first UI keeps a compact Memo Pad in a four-way layout on a plain cream-white background (no wallpaper, no paw-print pattern). Opening the app shows the home screen at once, with no launch animation. Note, Task, Todo and Calendar are words on tinted pills (with a count badge), and TEO sits above the paper. The supplied navigation and pixel character sheets are included intact under `public/assets`; SVG viewports display the relevant artwork without the original sheet labels. Today is labelled Todo.

**Mac app mode.** The Mac app's web view adds `TEOFlowMac` to the user agent (`src/lib/platform.ts`), and the web app then works the way a desktop does: it opens on the calendar (no animation), the swipe pad is left to phones, and a bar of tabs (캘린더 · Note · Task · Todo · Trash · Setting) replaces the Trash/Setting buttons and the four targets. The tab screens have no back arrow (a detail still goes back to its list), **새 메모** opens a ready-to-write Note, and the Note, Task and Todo lists each have their own *새 …* button (Todo gets one on every device) because writing by swiping is not available. Empty-list hints and the Settings tips stop mentioning swipes. Everything else, including every other browser, is unchanged. `tests/mac.spec.ts` covers it by setting that user agent.

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

The native shell registers one Android Home Screen widget, **TEO 캘린더**, built for a Galaxy Z Fold: it is a single bitmap painted by `CalendarPainter` for each size the launcher offers, so the cover screen and the opened inner screen each get their own layout. It reads `GET /api/items` directly and does not create a second widget database; it refreshes on the Android widget schedule, when the app is opened or left, and at midnight, and shows "동기화 대기" until the first sync.

- **Month:** Korean weekday headings (Sunday in red), today as a bold red number, Todo in orange and Task in teal like the web calendar. Items are packed into lanes like the web calendar (`WeekLanes`), so items that do not overlap share a row; what does not fit is counted per day as "+n" under the bars. A very small widget shows up to three coloured dots per day instead of titles.
- **Opened Fold (520 dp wide or more):** the month takes about 60 % and an agenda "다가오는 일정" sits beside it, listing open items from today with the date in words ("오늘", "내일", "10월 12일 (월) → 10/15", "진행 중 → 10/18"), plus "외 n개" when the list is longer.
- **Tapping** opens the app on its calendar (`theo_open=calendar`). **TalkBack** reads the date and today's open items (`CalendarText.describe`), not just a label.
- The former quick-link "memo" widget was removed; use the app for that. `CalendarData`, `CalendarText` and `WeekLanes` have no Android types and are covered by plain JVM unit tests (`./gradlew testDebugUnitTest`); the emulator test in CI renders the widget at several sizes.

Because the widget is native code, a new APK has to be installed once to get it; web changes reach the app without that.

## macOS Calendar widget

`macos/TEOFlow` contains the Mac app (TEO, below) and its WidgetKit extension for macOS 14+. The MacBook widget (**TEO 캘린더**) is separate from the Fold widget but speaks the same way: it uses the same `GET /api/items` endpoint, draws Korean weekday headings (Sunday in red), Todo in orange and Task in teal, and shows "다가오는 일정" with dates in words ("오늘", "내일", "10월 12일 (월) → 10/15"; `CalendarWords.swift`, same wording as `CalendarText.java`). Small shows the month as dots; medium puts the agenda and quick links beside a compact month; large writes titles in the days with the agenda below; extra large puts the month beside the agenda and links, like the opened Fold. VoiceOver reads the date and today's open items. It provides NOTE / TASK / TODO / + quick links. The links open the matching TEO page through the `teoflow://` URL scheme; the `+` link opens the note page where a new entry can be created. Small widgets only open the calendar (WidgetKit does not support `Link` there), so the quick links appear in medium and larger widgets. The host app uses a single window: widget links reuse it, and tapping the same link again navigates again. The checked-in source is intentionally independent of the web UI so the widget remains usable when the main app is closed.

Source layout under `macos/TEOFlow`: `Shared/` (the `/api/items` client, month and week-lane maths, colours) is compiled into both the widget and the app; `TEOFlow/` is the app (entry point, web window, menu bar icon, main menu), `Panel/` the calendar panel it puts on the desktop, `TEOFlowWidget/` the widget. Build the executables with Xcode's macOS SDK (Apple Silicon); the script compiles every `.swift` file in each target's folders, so adding a file needs no other change:

```bash
./macos/build.sh host     # artifacts/macos/build/TEOFlow  (the app, panel included)
./macos/build.sh widget   # artifacts/macos/build/TEOFlowWidget
./macos/build.sh          # both
./macos/package.sh        # builds both and makes TEO.app, TEO.zip and TEO-Mac.dmg
```

The installed bundle is `TEO.app`; after opening it once, add **TEO 캘린더** from the macOS widget gallery. The widget refreshes every 15 minutes and reads the latest server data on the next timeline refresh.

## macOS app: TEO

TEO on the Mac is **one app, `TEO.app`, with no Dock icon**. A calendar icon in the menu bar is always there; opening TEO shows the TEO web app in a window (it opens on the calendar, see *Mac app mode* above) and puts the calendar panel on the desktop. The panel's own settings and the widget live in the same app.

- **Menu bar icon**: *TEO 열기* (brings the web window back), *바탕화면 패널 보이기 / 숨기기*, *패널 새로고침*, *완료 항목 표시*, *할 일 목록 표시*, *로그인할 때 열기*, the last sync time and *종료*. Closing the web window leaves the panel and the icon where they are; opening TEO again (Finder, Spotlight, a widget tap) brings the window back. Because there is no Dock icon, TEO is not in Cmd+Tab either: the menu bar icon is the way back.
- **Open at login**: *로그인할 때 열기* registers TEO as a login item (`SMAppService`); macOS may ask you to approve it once in *System Settings → General → Login Items*, and the item shows a dash until you do. When macOS starts TEO that way only the desktop panel appears, so the web window does not pop up every morning; opening TEO yourself still shows both.
- **Keyboard**: the app has a hidden main menu for Cmd+C / V / X / A / Z, Cmd+R (reload) and Cmd+W / M / Q, so copying and pasting work in the web window.
- **Widget links** (`teoflow://calendar`, `note`, `task`, `todo`, `new-note`) open the window on that screen.

### The desktop panel

`macos/TEOFlow/Panel` is the calendar for the desktop. It loads the same Todo/Task data from `/api/items`, reloads every 60 seconds and on the refresh button; the footer shows when it last synced, and when a refresh fails the panel keeps the last data on screen and shows a "연결 확인 필요" notice instead of emptying the calendar (one malformed record never hides the others). Its glass is a light blurred material (always the light appearance, whatever the system setting) under a cream plate that is 86% opaque, so the brown text reads on any wallpaper, a dark or vivid one included; the year is written "2026" and a day is just its number. It has no visible close button and can be resized from the window edges.

**It lives on the desktop, not above other windows.** The panel sits at the layer of the desktop icons (one above), so a browser, an editor or any other window covers it, and clicking it does not lift it: it is a non-activating panel, so a click neither brings TEO forward nor puts the panel over anything. It joins every Space and stays put when windows are swept aside to show the desktop. Its first position is the top right corner of the screen.

Items are drawn like the web calendar and the Android widget: an item with a due date is one continuous bar per week (To Do orange, Task teal), an item without one is a dot and a title, and completed items stay visible but dimmed and struck through. A day with more items than fit shows "+n".

Under the calendar sits a **할 일** checklist: what is overdue first (in red, "기한 지남 · 10/4"), then what is open from today on, then — when *완료 항목 표시* is on — what is done, dimmed and struck through. Ticking the circle writes to the server (`PUT /api/items/:id`): the record is read fresh, only `completed` changes, and everything else, a Todo's child Tasks included, is sent back as it was; the box shows the change at once and returns to what it was, with a "저장하지 못했어요" notice, if the save fails. A Task inside a Todo changes only its own box. The bar between the calendar and the checklist is a divider: drag it up or down to share the height as you like (the calendar never gets less than six rows with day numbers, the checklist never less than about two rows), double-click it to go back to the default 66 / 34 split, or adjust it with VoiceOver's increment and decrement. The split is remembered between launches, and *할 일 목록 표시* in the menu bar item hides the checklist for a calendar-only panel. A window saved by an older version is made taller once so the checklist has room.

The code is split by job: `PanelWindow` (the window and its layer), `PanelStore` (loading, ticking and sync state), `PanelPreferences` (remembered settings), `PanelCalendarView` (the calendar and the split), `PanelChecklist` (divider and checklist) and `PanelControls` (grip, glass, buttons); the app side is `TEOFlowApp` (AppKit entry and delegate), `WebWindow`, `AppStatusItem` and `MainMenu`. Window movement is deliberately restricted to the dotted grip at the end of the header button row; dragging the calendar body or the transparent title bar never moves the window. The panel is 470×600 points to begin with (330×400 minimum) and remembers its position and size; the weeks share the height the calendar has, so a six-week month never runs off the bottom, and more height (a taller panel, or the divider dragged down) fits more bars under each day number. The app bundle's Info.plist is `macos/TEOFlow/Resources/TEOFlow-Info.plist` (`LSUIElement` is what keeps the Dock icon away).

### Installing on a Mac

The **Mac apps** workflow (`.github/workflows/macos.yml`) builds the app on a macOS runner for every change under `macos/` and for pull requests that touch it; run it by hand from the Actions tab when the last artifact has expired. Open the run and download the `mac-apps` artifact: `TEO-Mac.dmg` holds `TEO.app` (the app with the widget inside) beside an Applications shortcut, and the same app is in `TEO.zip`. The run also installs and starts the app on the runner and prints where macOS puts its windows and whether it registers the widget (`mac-screenshot` holds a picture of that desktop). `./macos/package.sh` makes the same files on a Mac with Xcode (`artifacts/macos`).

1. Open the DMG and drag **TEO** onto **Applications**.
2. The app is signed ad hoc (there is no Apple developer account behind it), so macOS refuses a downloaded copy the first time. Run once in Terminal: `xattr -dr com.apple.quarantine /Applications/TEO.app` (or open the app, then allow it in *System Settings → Privacy & Security → Open Anyway*).
3. Open **TEO**: the web window and the desktop panel appear and the calendar icon shows in the menu bar. Add **TEO 캘린더** from the widget gallery if you want it too.

An update is the same steps: quit TEO from the menu bar icon, replace it in Applications, open it again. Each build is signed afresh, so the first-open approval comes back, and a widget that was already on the desktop may need to be removed and added again. The earlier separate *TEO Calendar Panel* app is gone: delete it from Applications (its remembered position and ratio do not carry over).

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

- **Idle:** slow blinks, and every 7–15 s a scratch, paw lick, yawn or look around. After about 24 s without any touch he yawns, curls up and sleeps; any touch wakes him.
- **While swiping:** the paper leans into the throw, shrinks slightly and the destination pill swells, glows and dims its neighbours in proportion to how far the swipe has gone (`--swipe` on the stage, 0 to 1). TEO looks toward the destination, and once the 65 px threshold is passed the word wiggles and TEO cheers with his tongue out (a short haptic tick marks the moment).
- **On landing:** the word squashes, hops and ripples, a burst of hearts / stars / bones / paws flies out (`BurstLayer`), the badge count pops, TEO cheers, and the toast carries his face. The destination stays lit until the server has accepted the memo; a failed save returns the memo without celebrating.
- **Counts and progress:** each pill shows a badge with open items (Note shows all notes; Calendar shows what is open today). Once anything is due today, the footer shows "오늘 done/total" as a bone-coloured meter; finishing the last item of the day triggers a bigger celebration once per day.
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
npx playwright test tests/flow.spec.ts tests/delight.spec.ts tests/interior.spec.ts
# With local Wrangler running on port 8787:
node tests/api-smoke.mjs
```

`CHROME_PATH` optionally selects an installed Chrome executable. `TEST_URL` changes the UI test server (default http://127.0.0.1:5174). `tests/delight.spec.ts` covers the swipe progress, landing burst and badge, petting, check-off celebration, the daily meter and reduced motion. Tests cover 344/360/412 px folded, 768/900 px expanded, 1440 px desktop, touch drag, all swipe directions, draft retention, calendar list navigation, folder classification and Todo child Tasks. API smoke tests are deliberately hardcoded to localhost and remove only their own test records. Browser-emulated viewports and keyboard resizing do not replace final testing on a physical Galaxy Fold and its Android WebView.
