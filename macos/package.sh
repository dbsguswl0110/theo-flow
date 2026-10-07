#!/usr/bin/env bash
# Builds both Mac apps and wraps them for installing (Apple Silicon, macOS 14+):
#   ./macos/package.sh
# Output in artifacts/macos:
#   TEO.app                    the host app with the widget inside (Contents/PlugIns/TEOFlowWidget.appex)
#   TEO Calendar Panel.app     the floating calendar panel
#   TEO-Mac.dmg                both apps and an Applications shortcut, to drag across
#   TEO.zip, TEO-Calendar-Panel.zip
# The apps are signed ad hoc (no Apple developer account), so macOS asks for a first-open approval; see the README.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=artifacts/macos
BUILD=$OUT/build
RES=macos/TEOFlow/Resources
ICON=public/assets/teo-pixel-app-icon.png

./macos/build.sh all

rm -rf "$OUT/TEO.app" "$OUT/TEO Calendar Panel.app" "$OUT/dmg" "$OUT/AppIcon.iconset" "$OUT"/*.zip "$OUT"/*.dmg "$OUT/AppIcon.icns"

# One PNG becomes the .icns every app shares.
mkdir -p "$OUT/AppIcon.iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$ICON" --out "$OUT/AppIcon.iconset/icon_${size}x${size}.png" > /dev/null
  sips -z $((size * 2)) $((size * 2)) "$ICON" --out "$OUT/AppIcon.iconset/icon_${size}x${size}@2x.png" > /dev/null
done
iconutil -c icns "$OUT/AppIcon.iconset" -o "$OUT/AppIcon.icns"

plist() { /usr/libexec/PlistBuddy -c "$2" "$1"; }

# --- TEO.app with the widget extension inside ---
APP="$OUT/TEO.app"
APPEX="$APP/Contents/PlugIns/TEOFlowWidget.appex"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APPEX/Contents/MacOS"
cp "$BUILD/TEOFlow" "$APP/Contents/MacOS/TEOFlow"
cp "$RES/TEOFlow-Info.plist" "$APP/Contents/Info.plist"
cp "$OUT/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
plist "$APP/Contents/Info.plist" "Set :CFBundleIconFile AppIcon"
plist "$APP/Contents/Info.plist" "Delete :CFBundleIconName" || true
cp "$BUILD/TEOFlowWidget" "$APPEX/Contents/MacOS/TEOFlowWidget"
cp "$RES/TEOFlowWidget-Info.plist" "$APPEX/Contents/Info.plist"
# The widget must be sandboxed to load; sign it before the app that contains it.
codesign --force --sign - --entitlements "$RES/TEOFlow.entitlements" "$APPEX"
codesign --force --sign - --entitlements "$RES/TEOFlow.entitlements" "$APP"

# --- TEO Calendar Panel.app ---
PANEL="$OUT/TEO Calendar Panel.app"
mkdir -p "$PANEL/Contents/MacOS" "$PANEL/Contents/Resources"
cp "$BUILD/TEOCalendarPanel" "$PANEL/Contents/MacOS/TEOCalendarPanel"
cp "$RES/TEOCalendarPanel-Info.plist" "$PANEL/Contents/Info.plist"
cp "$OUT/AppIcon.icns" "$PANEL/Contents/Resources/AppIcon.icns"
plist "$PANEL/Contents/Info.plist" "Add :CFBundleIconFile string AppIcon"
plist "$PANEL/Contents/Info.plist" "Add :NSHighResolutionCapable bool true"
codesign --force --sign - "$PANEL"

for bundle in "$APP" "$APPEX" "$PANEL"; do
  plutil -lint "$bundle/Contents/Info.plist"
  codesign --verify --strict --verbose=2 "$bundle"
done

# --- Things to hand over ---
ditto -c -k --keepParent "$APP" "$OUT/TEO.zip"
ditto -c -k --keepParent "$PANEL" "$OUT/TEO-Calendar-Panel.zip"
mkdir -p "$OUT/dmg"
cp -R "$APP" "$PANEL" "$OUT/dmg/"
ln -s /Applications "$OUT/dmg/Applications"
hdiutil create -volname "TEO" -srcfolder "$OUT/dmg" -ov -format UDZO "$OUT/TEO-Mac.dmg" > /dev/null
rm -rf "$OUT/dmg" "$OUT/AppIcon.iconset"
ls -lh "$OUT"
