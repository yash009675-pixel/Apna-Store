# Apna Store Mobile App

This directory is the native-app packaging layer for Apna Store.

- Android: Capacitor 8 project is generated in CI and an installable debug APK is produced as an artifact.
- iOS: Capacitor 8 project generation is prepared for a macOS/Xcode build and App Store signing.
- The app bundles the same production website source used by GitHub Pages.
- No courier, payment, Supabase service-role, or other server secrets are bundled into the app.

Production store publishing still requires the owner's Google Play Console and Apple Developer accounts, signing credentials, store metadata, and review submission.
