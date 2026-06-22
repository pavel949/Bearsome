# App resources

`icon.svg` is the master Bearsome icon. `electron-builder` (configured under the
`build` block in `package.json`, with `buildResources: "resources"`) needs
raster icons, which aren't committed because they're generated artifacts.

Generate them from the SVG before packaging:

```bash
# requires ImageMagick or rsvg-convert + iconutil/png2icons, etc.

# 1024px master PNG
rsvg-convert -w 1024 -h 1024 resources/icon.svg -o resources/icon.png

# Windows .ico and macOS .icns can be produced with a tool such as png2icons:
npx png2icons resources/icon.png resources/icon -allwe
```

electron-builder picks up `resources/icon.png` (Linux), `resources/icon.ico`
(Windows) and `resources/icon.icns` (macOS) automatically. Until they're
generated, builds fall back to the default Electron icon.
