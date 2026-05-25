# Icons

Generate PNG icons from `icon.svg` using any of:

```bash
# Using Inkscape:
inkscape icon.svg -w 16 -h 16 -o icon16.png
inkscape icon.svg -w 48 -h 48 -o icon48.png
inkscape icon.svg -w 128 -h 128 -o icon128.png

# Using ImageMagick:
magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 128x128 icon128.png

# Using rsvg-convert:
rsvg-convert -w 16 -h 16 icon.svg > icon16.png
rsvg-convert -w 48 -h 48 icon.svg > icon48.png
rsvg-convert -w 128 -h 128 icon.svg > icon128.png
```

Or use any online SVG-to-PNG converter.
The icons must be present before loading the extension unpacked in Chrome.
