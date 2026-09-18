# Chrome Web Store listing

Everything to paste into the developer dashboard. Written to match what the
extension actually does. The review reads the code, so nothing here claims
more than `src/` delivers.

---

## Product details

**Name**

```
Unwatched Filter for YouTube
```

**Short description** (132 character limit; this is 95)

```
Adds an Unwatched filter beside Latest, Popular and Oldest on any YouTube channel's Videos tab.
```

**Category:** Productivity
**Language:** English

**Detailed description**

```
YouTube lets you sort a channel's uploads three ways (Latest, Popular, Oldest) but gives you no way to filter out what you have already seen. On a channel with hundreds of videos, finding what you have not watched means scanning thumbnails for the little red progress bar by eye.

This extension adds a fourth chip: Unwatched. Click it and every video showing watch progress disappears, leaving only the ones you have not started.

HOW IT WORKS
• Open any channel's Videos tab and click Unwatched
• Videos with any watch progress at all are hidden. Click again to bring them back
• The filter stays on while you switch between Latest, Popular and Oldest, and while you move between channels in the same tab
• Scroll to load more videos; new ones are filtered as they arrive

WHAT IT NEEDS
You need to be signed in with watch history enabled, because that is where the progress bars come from. If nothing on the page is marked as watched, the extension says so rather than silently showing you everything.

WHAT IT DOES NOT DO
• No accounts and no sign-in
• No network requests, no analytics, no third-party code
• No data collected, stored or transmitted, not even your on/off preference, which lives in memory for the life of the tab
• No permissions requested
• It filters the videos YouTube has loaded. Scroll to load more; it does not auto-scroll on your behalf.

Open source under the MIT licence: https://github.com/rushikeshg25/unwatched-filter-for-youtube

Not affiliated with, endorsed by, or sponsored by YouTube or Google.
```

---

## Privacy practices tab

**Single purpose**

```
This extension has one purpose: to add an "Unwatched" filter to the Videos tab of YouTube channel pages, hiding videos the signed-in viewer has already started watching. It does nothing else.
```

**Justification for the youtube.com host match**

```
The extension's only function is to modify the Videos tab of YouTube channel pages, so its content script is declared for www.youtube.com and nothing else. On those pages it reads the watch-progress indicator YouTube itself renders on each thumbnail, and adds or removes CSS classes to hide the videos that have one. Page content is never collected, stored or transmitted; the reading and the hiding both happen locally in the open tab.
```

**Remote code:** No. All code is bundled in the package; nothing is fetched
or evaluated at runtime.

**Data usage**: answer **No** to every category:

| Category | Answer |
| --- | --- |
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

Then tick all three certifications: data is not sold or transferred to third
parties outside approved use cases, is not used or transferred for purposes
unrelated to the item's single purpose, and is not used or transferred to
determine creditworthiness or for lending purposes.

**Privacy policy URL**

```
https://github.com/rushikeshg25/unwatched-filter-for-youtube/blob/main/PRIVACY.md
```

---

## Assets

**Package:** `./scripts/package.sh` → `unwatched-filter-for-youtube-vX.Y.Z.zip`
(manifest, `dist/`, `icons/`, nothing else).

**Store icon:** 128×128, already in the package at `icons/icon128.png`.

**Screenshots:** at least one, 1280×800 (or 640×400), PNG or JPEG. Suggested
set, captured on a channel you have actually watched so the effect is real:

1. A channel's Videos tab with the chip visible and the filter **off**: a
   grid with several red progress bars showing.
2. The same view with the filter **on**: the watched videos gone.
3. A close crop of the chip row: `Latest | Popular | Oldest | Unwatched`.

Before capturing, sign out of unrelated Google surfaces or crop the header:
your avatar and any account name in the top-right will otherwise be public.

**Promotional tile:** 440×280, optional. Only needed for certain placements.

---

## Before you submit

- [ ] Register at https://chrome.google.com/webstore/devconsole. One-time
      $5 fee, plus identity verification and the trader / non-trader
      declaration.
- [ ] Build a fresh package: `npm test && ./scripts/package.sh`
- [ ] Upload the zip, paste the fields above, attach screenshots.
- [ ] Choose visibility: **Public**, **Unlisted** (link only), or **Private**
      to named testers. Unlisted is a reasonable way to start.
- [ ] Submit. Review for a no-permission, single-site extension is usually
      days rather than weeks.

If the review comes back with questions, the two most likely subjects are
the host match and the name. Both are answered above, and the name already
uses the "for YouTube" suffix form rather than leading with the mark.
