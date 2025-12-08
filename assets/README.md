# Assets Folder

This folder should contain the following icon files for the mobile app:

- `icon.png` - App icon (1024x1024)
- `splash.png` - Splash screen image (2048x2048 or similar)
- `adaptive-icon.png` - Android adaptive icon foreground (1024x1024)
- `favicon.png` - Web favicon (if building for web)

## Creating Icons

You can use the existing icons from the `icons/` folder as a starting point.

### Using Existing Icons

The `icons/icon128.png` can be upscaled for the app icon.

### Recommended Tools

- [App Icon Generator](https://appicon.co/)
- [Figma](https://www.figma.com/)
- [Adobe Illustrator](https://www.adobe.com/products/illustrator.html)

### Icon Requirements

**iOS:**
- Must be at least 1024x1024 pixels
- PNG format
- No transparency

**Android:**
- Adaptive icon: 1024x1024 pixels foreground + background
- PNG format
- Background can be solid color (specified in app.json)

**Splash Screen:**
- 2048x2048 or larger
- PNG format
- Background color specified in app.json

## Temporary Solution

For development, you can copy the existing icon128.png:

```bash
# Copy existing icon as placeholder
cp icons/icon128.png assets/icon.png
cp icons/icon128.png assets/splash.png
cp icons/icon128.png assets/adaptive-icon.png
```

Note: These will need to be properly sized for production builds.
