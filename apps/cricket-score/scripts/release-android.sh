#!/usr/bin/env bash
# Build the signed Android APK and put it in releases/ named with its version
# (versionName in android/app/build.gradle), e.g. releases/cricket-score-v2.0.apk.
# Bump versionCode and versionName first. Needs android/keystore.properties (the
# release key) and the Android SDK. Push afterwards: the deploy puts it on the site.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*versionName "\(.*\)".*/\1/p' android/app/build.gradle)
[ -n "$version" ] || { echo "versionName not found in android/app/build.gradle" >&2; exit 1; }
[ -f android/keystore.properties ] || { echo "android/keystore.properties missing (release signing key)" >&2; exit 1; }
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home)}"
npx vite build
npx cap sync android
(cd android && ./gradlew assembleRelease -q)
rm -f releases/cricket-score-v*.apk
cp android/app/build/outputs/apk/release/app-release.apk "releases/cricket-score-v$version.apk"
echo "Built releases/cricket-score-v$version.apk"
