# YouTube Unwatched Filter

A Chrome extension that adds an **Unwatched** filter beside Latest, Popular and Oldest on any YouTube channel's Videos tab.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](manifest.json)
[![Permissions: none](https://img.shields.io/badge/permissions-none-brightgreen.svg)](manifest.json)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen.svg)

```
┌────────┐ ┌─────────┐ ┌────────┐   ┌────────────────┐
│ Latest │ │ Popular │ │ Oldest │   │ Unwatched · 12 │  ← added by this extension
└────────┘ └─────────┘ └────────┘   └────────────────┘
```

## The problem

YouTube gives you three ways to *sort* a channel's uploads and no way to *filter* them. On a channel with hundreds of videos, finding what you have not seen yet means scanning thumbnails for the little red progress bar by eye, one row at a time.

This extension reads that same progress bar in bulk and hides everything that has one.

## Install

**From a release (recommended)**

1. Download `yt-unwatched-vX.Y.Z.zip` from the [latest release](https://github.com/rushikeshg25/yt-unwatched/releases/latest) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.

**From source**

```bash
git clone https://github.com/rushikeshg25/yt-unwatched.git
```

Then load the cloned folder with **Load unpacked**, as above.

The extension is not on the Chrome Web Store, so Chrome will show the usual "loaded in developer mode" notice.

## Use it

Open any channel's Videos tab — `youtube.com/@channel/videos` — and click **Unwatched**.

- Videos with any watch progress are hidden; the chip shows how many are left.
- Click it again to bring everything back.
- The filter stays on while you switch between Latest, Popular and Oldest, and while you move between channels in the same tab.
- Scroll to load more videos; new ones are filtered as they arrive.

You need to be **signed in with watch history enabled** — that is where the progress bars come from. If nothing is marked as watched, the extension says so instead of silently showing you everything.

## What counts as "watched"

Any progress at all. A video you opened for ten seconds is a video you have already made a decision about, so it is hidden. There is no threshold to configure and nothing to tune.

## How it works

The extension is four small content scripts and a stylesheet. No background worker, no network requests, no storage.

| File | Responsibility |
| --- | --- |
| `src/selectors.js` | Finds the chip bar and the video grid |
| `src/watched.js` | Reads the thumbnail resume bar to decide if a card is watched |
| `src/chip.js` | Builds the Unwatched chip and keeps it in the bar |
| `src/content.js` | Applies the filter, follows navigation, watches for new cards |
| `src/content.css` | Chip styling and the rule that hides watched cards |

Two details worth knowing if you plan to change it:

- **The chip borrows styling, it is not a clone.** Cloning one of YouTube's `<chip-view-model>` elements gets the copy upgraded by YouTube's own runtime, which can re-bind YouTube's tap handler to it. Instead the chip is a plain `<button>` that copies the class names off an *unselected* sibling chip, with a self-contained fallback in CSS if that fails.
- **Selectors come in pairs.** YouTube A/B tests a new view-model layout (`richItemRenderer` → `lockupViewModel`) against the older Polymer one, so every selector lists the current form first and keeps the old one as a fallback. Nothing matches on visible text, because chip labels are localised.

## Limitations

These are deliberate, not oversights:

- **It filters what is loaded, not the whole channel.** YouTube loads a channel's videos as you scroll, and this extension does not auto-scroll on your behalf. Scroll to see more.
- **It trusts YouTube's progress bars.** Videos watched long ago, watched while signed out, or watched on a different account have no bar and will show up as unwatched.
- **It depends on YouTube's private markup.** Google changes it without notice. When that happens the chip or the filtering stops working — see below.

## Troubleshooting

Open DevTools on the YouTube tab, and in the **Console**, switch the context dropdown (top left of the console, usually reading `top`) to **YouTube Unwatched Filter**. Then run:

```js
__ytUnwatched.report()
```

It prints whether the page, chip bar and grid were found, how many cards are loaded, and how many cards each progress-bar selector matched.

| Symptom | Likely cause |
| --- | --- |
| No chip appears | The chip bar was not found — `chipBarFound: false` in the report. Update `CHIP_BAR` / `CHIP` in `src/selectors.js`. |
| Chip works, nothing is ever hidden | Every progress selector matched 0 cards. Either watch history is off, or the resume-bar markup changed — update `PROGRESS_SELECTORS` in `src/watched.js`. |
| Everything disappears | Progress bars are being detected on every card. Check `progressSelectorMatches` in the report against what you actually see on screen. |
| Chip vanishes after switching sort | The grid observer lost the container; `__ytUnwatched.refresh()` re-applies. Please open an issue with the report output. |

## Development

No build step and no dependencies — edit the files and press the reload button on `chrome://extensions`.

```bash
python3 scripts/make-icons.py   # regenerate icons/*.png (stdlib only)
./scripts/package.sh            # build the release zip
node --check src/content.js     # syntax check any script
```

## Privacy

The extension requests **no permissions** and has no `host_permissions`; a statically declared content script needs neither. It makes no network requests, stores nothing (not even your on/off preference, which lives in memory for the life of the tab) and sends nothing anywhere. All it does is add and remove CSS classes on the page you are already looking at.

## License

[MIT](LICENSE)
