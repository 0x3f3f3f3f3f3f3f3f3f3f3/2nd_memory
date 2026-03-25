# App Icon Notes

Current state:

- `ios/SageApp/SageApp/Resources/Assets.xcassets/AppIcon.appiconset`
- generated from existing web `public/icon-512.png`
- resized into a valid iOS asset catalog set for buildability

Why this is not final:

- it is a practical first-pass icon, not a layered native Liquid Glass icon
- it was generated inside a Linux environment where Icon Composer is unavailable

Recommended phase-2 upgrade:

1. Open the project in Xcode on macOS.
2. Create a layered icon using Icon Composer.
3. Replace the generated PNG set with the composed icon asset.
4. Keep the existing marketing shape and warm accent so the web/iOS brand remains visually aligned.
