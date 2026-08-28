# unredirectinator

The Un-Redirectinator can **protect selected sites** from redirecting you away or opening new tabs.

## What it does

- You choose which sites are protected in the popup.
- You can whitelist URLs so the extension auto-enables on those sites.
- On protected sites, outbound redirects and cross-site tab openings are blocked.
- You can disable the whole extension with one toggle.

## Files

- `manifest.json`: extension metadata and permissions
- `background.js`: keeps redirect-blocking rules in sync with settings and force-closes spawned tabs
- `content.js`: blocks script-based redirects, popups, and cross-site form/link navigation
- `popup.html` + `popup.js`: toggles global enablement and current-site protection

## Load in Chromium

1. Open `chrome://extensions` (Also works in Edge, Brave, and other Chromium-based browsers!)
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder
