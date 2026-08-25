# unredirectinator

Starter Chromium extension project that bypasses common redirect wrapper URLs.

## Files

- `manifest.json`: extension metadata and wiring
- `background.js`: initializes extension settings
- `content.js`: detects redirect wrapper URLs and jumps to target URLs
- `popup.html` + `popup.js`: simple enable/disable toggle

## Load in Chromium

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `/home/runner/work/unredirectinator/unredirectinator`
