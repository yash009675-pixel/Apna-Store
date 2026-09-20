# Apna Store Mobile App

This directory is the native-app packaging layer for Apna Store.

- Android: Capacitor 8 project is generated in CI and an installable debug APK is produced as an artifact.
- iOS: Capacitor 8 project generation is prepared for a macOS/Xcode build and App Store signing.
- The app bundles the same production website source used by GitHub Pages.
- No courier, payment, Supabase service-role, or other server secrets are bundled into the app.

Production store publishing still requires the owner's Google Play Console and Apple Developer accounts, signing credentials, store metadata, and review submission.


## Android release signing

The repository contains a manual signed-AAB workflow at `.github/workflows/release-android.yml`. Signing material is intentionally not committed.

Required GitHub Actions secrets:
- `ANDROID_KEYSTORE_BASE64`: base64 contents of the release PKCS#12 keystore
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

After the four secrets are configured, run the **Apna Store Android Release** workflow manually. It produces a signed `app-release.aab` artifact. Keep a secure backup of the keystore and passwords; losing the signing key can prevent future updates to the same Play Store app.
