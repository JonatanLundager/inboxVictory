# Inbox Victory 🇺🇸🦅

A Chrome extension for Gmail that celebrates every sent email like you just won a major historical conflict.

Send email ➜ image appears in the middle of the screen ➜ jingle plays ➜ instant questionable confidence.

## What this does

- Detects when you send an email in Gmail.
- Pops a random image from `assets/images/`.
- Plays the matching jingle from `assets/jingles/` (same filename, different extension).
- Lets you enable/disable entries in a Chrome Side Panel UI.
- Has a global ON/OFF button for when you need to act professional.

## File pairing magic

If you have:

- `assets/images/freedom.png`
- `assets/jingles/freedom.mp3`

Then `freedom` is a matched pair.

Entries are listed in:

- `assets/library.json`

Example:

```json
{
  "entries": ["freedom", "eagle_mode", "final_boss"]
}
```

## Install (unpacked extension)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder
5. Open Gmail, send mail, achieve glory

## Side Panel controls

- Click the extension icon to open the side panel.
- Toggle individual entries on/off.
- Use the top global toggle to disable all celebrations instantly.
- Upload custom image/GIF + sound pairs directly from the side panel.
- If both uploaded files share the same base filename, the pair name auto-fills; otherwise set a custom entry name.
- Delete custom pairs from the side panel list at any time.

## Important notes

- If jingles are missing, it falls back to a built-in patriotic synth tune.
- If you add/rename files, update `assets/library.json` and reload the extension.
- Side panel uploads are stored in `chrome.storage.local` (data URLs), so very large files may exceed extension storage limits.
- Gmail changes UI often; this extension uses multiple detection methods to stay resilient.

## FAQ

**Q: Is this necessary?**  
A: No.

**Q: Is it funny?**  
A: Depends on your team and your HR policy.

**Q: Can this be too much?**  
A: Absolutely. That’s the point.
