#!/usr/bin/env bash
# Builds the macOS executables from the checked-in sources (Apple Silicon, macOS 14+):
#   ./macos/build.sh [host|widget|panel|all]
# Each target compiles every .swift file in its folders, so new files need no edits here.
set -euo pipefail

cd "$(dirname "$0")/.."
SDK=$(xcrun --sdk macosx --show-sdk-path)
OUT=artifacts/macos/build
SRC=macos/TEOFlow
mkdir -p "$OUT"

build() {
  local name=$1
  shift
  echo "Building $name"
  xcrun swiftc -parse-as-library -target arm64-apple-macosx14.0 -sdk "$SDK" "$@" -o "$OUT/$name"
}

case "${1:-all}" in
  host) build TEOFlow -framework SwiftUI -framework WebKit "$SRC"/TEOFlow/*.swift ;;
  widget) build TEOFlowWidget -framework SwiftUI -framework WidgetKit "$SRC"/Shared/*.swift "$SRC"/TEOFlowWidget/*.swift ;;
  panel) build TEOCalendarPanel -framework SwiftUI -framework AppKit "$SRC"/Shared/*.swift "$SRC"/Panel/*.swift ;;
  all)
    "$0" host
    "$0" widget
    "$0" panel
    ;;
  *)
    echo "usage: $0 [host|widget|panel|all]" >&2
    exit 2
    ;;
esac
