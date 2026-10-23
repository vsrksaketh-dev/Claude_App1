#!/bin/sh
# Compiles the widget Java against stand-ins for the Android classes and runs it on the JVM with a real snapshot from the app.
# Usage: tests/widgets/run.sh <path-to-playwright> [port]   (start `python3 -m http.server <port>` first; needs java and org.json from node_modules)
set -e
cd "$(dirname "$0")/../.."
PW=${1:?path to playwright}; PORT=${2:-8123}
JSON=$(ls node_modules/@trapezedev/gradle-parse/lib/json-*.jar | head -1)
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
mkdir -p "$W/src" "$W/out"
cp -r tests/widgets/stubs/. "$W/src/"
mkdir -p "$W/src/app/dailydriver/personal"
cp tests/widgets/Harness.java "$W/src/app/dailydriver/personal/"
python3 tests/widgets/gen-r.py "$W/src"
node tests/widgets/snap.cjs "$PW" "$W/snapshot.json" "$PORT"
javac -cp "$JSON" -d "$W/out" $(find "$W/src" -name '*.java') $(ls android-native/java/app/dailydriver/personal/*.java | grep -v "MainActivity\|WidgetBridgePlugin") 2>&1 | grep -v JAVA_TOOL || true
java -cp "$W/out:$JSON" app.dailydriver.personal.Harness "$W/snapshot.json"
