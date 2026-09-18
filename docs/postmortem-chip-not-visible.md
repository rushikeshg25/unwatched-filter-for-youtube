# Postmortem: the Unwatched chip did not appear on YouTube

**Date:** 18 September 2026
**Affects:** v1.0.0 and v1.0.1
**Fixed in:** v1.0.2
**Symptom:** the extension loaded without errors and did nothing visible on a channel's Videos tab.

---

## 1. Summary

The chip was being injected the whole time. It was injected into the wrong
element and dressed in a class that strips styling, so it rendered as
unstyled text outside the row it was meant to join, which is easy to miss.

Both mistakes have the same origin: **the markup was inferred rather than
read.** No part of the released code had ever been run against a page
YouTube actually serves. A test suite of 31 checks passed throughout,
because the fixtures it ran against were written from the same guesses as
the code.

---

## 2. What was believed before

During planning, the channel page was fetched with `curl` and its embedded
`ytInitialData` was inspected. That was real evidence and it was correct as
far as it went:

| Finding | Status |
| --- | --- |
| Grid is `richGridRenderer` → `richItemRenderer` → `lockupViewModel` | Correct |
| Sort chips are `chipViewModel` entries in a `chipBar` | Correct |
| No `videoRenderer`; the old Polymer layout is not in use | Correct |

The error was in what came next. `ytInitialData` is YouTube's *data*, not
its DOM. It names renderers, not elements, classes or nesting. The DOM
selectors were written by assuming how those renderer names become markup:

- that `chipViewModel` renders inside a container with `id="chips"`,
  as older YouTube layouts did
- that a chip's visible styling lives on its `<button>`
- that selected state is exposed on the chip element

All three were wrong, and none was checked.

---

## 3. Why the tests did not catch it

Two independent failures, both worth stating plainly.

**The fixtures were fiction.** `test/grid.html` contained a
`ytd-feed-filter-chip-bar-renderer > #chips` structure invented to match the
selectors. The tests therefore confirmed the code agreed with itself. The
suite was green while the extension was broken on the only site it targets.

**The suite could not fail for the most likely reason.** When a fixture's
script threw, the page kept its placeholder text, the runner searched the
output for a line starting with `FAIL`, found none, and reported success.
A crashed fixture and a perfect run were indistinguishable.

The second point is the more serious of the two. The first made the suite
wrong; the second made it unable to tell anyone.

---

## 4. How it was found

No browser automation tool was available in the session, so the real page
was captured with headless Chrome directly:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --window-size=1440,2000 \
  --dump-dom "https://www.youtube.com/@sidemenreacts/videos" > real.html
```

A first attempt with `--virtual-time-budget` returned zero bytes, because
YouTube's timers never let virtual time settle. Dropping that flag and letting the
page reach `load` produced 1.7 MB of rendered DOM.

That snapshot was then turned into a test bench:

1. **Freeze it.** Strip every `<script>` from `real.html`, so reloading the
   snapshot cannot let YouTube's own code rewrite the DOM.
2. **Serve it under a matching path.** A small HTTP server returns the
   snapshot for any path, so it can be requested at
   `http://127.0.0.1:8799/@sidemenreacts/videos` and the content script's
   route check sees the pathname it expects.
3. **Probe selectors against it**, then **load the real built bundle** into
   it and measure what the chip actually became.

### 4.1 First probe: which selectors match

```
   3  chip-view-model, yt-chip-cloud-chip-renderer
   0  ytd-feed-filter-chip-bar-renderer #chips
   0  yt-chip-cloud-renderer #chips
   0  #chips-wrapper #chips
   1  chip-bar-view-model
   1  ytd-rich-grid-renderer #contents
  30  ytd-rich-item-renderer
   0  any #chips
```

The grid selectors were right. Every `#chips` selector matched nothing:
`#chips` does not exist on this page at all. Only the last fallback,
`chip-bar-view-model`, matched, and it matched the **host** element.

### 4.2 The real structure

```
chip-bar-view-model.ytChipBarViewModelHost
  div.ytChipBarViewModelChipBarScrollContainer      ← display:flex, overflow-x:auto
    div.ytChipBarViewModelChipWrapper               ← one per chip
      chip-view-model.ytChipViewModelHost
        chip-shape.ytChipShapeHost
          button.ytChipShapeButtonReset             ← transparent, no styling
            div.ytChipShapeChip ytChipShapeInactive ytChipShapeOnlyTextPadding
              div                                   ← the text
              yt-touch-feedback-shape               ← ripple, no useful classes
```

Computed styling, confirming where the pixels come from:

| Element | background | colour | radius | height | padding |
| --- | --- | --- | --- | --- | --- |
| `button.ytChipShapeButtonReset` | `rgba(0,0,0,0)` | `rgb(0,0,0)` | `0px` | 32px | `0px` |
| `div.ytChipShapeChip` **inactive** | `rgba(0,0,0,0.05)` | `rgb(15,15,15)` | `8px` | 32px | `0 12px` |
| `div.ytChipShapeChip` **active** | `rgb(15,15,15)` | `rgb(241,241,241)` | `8px` | 32px | `0 12px` |

### 4.3 Running the shipped bundle against it

```
chip injected: true
injected into: chip-bar-view-model .ytChipBarViewModelHost
same parent as real chips: false
borrowed classes: ytChipShapeButtonReset ytu-chip
```

That is the bug, in three lines. The chip existed, sat outside the scroll
container, and wore the reset class, a class whose entire job is to remove
button styling.

---

## 5. Root causes

**Cause 1: placement by container name.** `findChipBar()` matched the
container by name and the winning name was the bar's host element, whose
child is a scroll container rather than the chips. Anything appended there
lands beside the row, not on it.

**Cause 2: styling copied from the wrong element.** The code borrowed the
class list of a chip's `<button>`. On this markup that is
`ytChipShapeButtonReset`, a reset. The chip therefore had no background, no
radius and no padding.

**Cause 3 (meta): fixtures written from the same assumptions as the code,
and a runner that treated a crashed fixture as a pass.** Either alone would
have hidden the first two.

### A cause found before release

The first fix rebuilt the chip's element chain but located the visual
element by descending to the deepest first child. On real markup that walks
*past* the styled div into `yt-touch-feedback-shape`, whose `className` is
empty. Every chip then looked identical, so selected state could not be
detected and the chip copied whichever chip came first, which is the
selected one. It would have shipped looking permanently switched on.

This was caught only because the fix was probed against the captured DOM
before release, which is the practice that should have existed from the
start.

---

## 6. The fix

- **The bar is derived from a chip, not named.** `findChipBar()` takes a
  chip's own `parentElement` as the row. If chips each sit in a wrapper, the
  row is the wrapper's parent and we build a matching wrapper for ours. This
  cannot select a non-row ancestor, and survives renames.
- **The chip's whole element chain is rebuilt**, each element keeping its
  class names, with custom-element tags (`chip-view-model`, `chip-shape`)
  swapped for plain `div`s. YouTube's class-based CSS then paints our chip in
  both themes. Custom elements are never cloned: a clone gets upgraded by
  YouTube's runtime, which can re-bind YouTube's own tap handler to it.
- **Selected state is derived by diffing class tokens across the chips.**
  Whatever token set exactly one chip has is the selected look; clicking
  swaps those tokens. YouTube exposes `aria-selected` on the inner button
  here, but the token diff needs no attribute and no name.
- **No YouTube class name appears anywhere in the source.** Every name in
  this document is an observation, not a dependency.

Result against the captured page:

```
row order: Latest | Popular | Oldest | Unwatched
our wrapper: ytChipBarViewModelChipWrapper ytu-chip-wrapper
same row as real chips: true
styling off: bg=rgba(0,0,0,0.05) fg=rgb(15,15,15) r=8px h=32px pad=0 12px  MATCH
styling on : bg=rgb(15,15,15) fg=rgb(241,241,241) r=8px h=32px pad=0 12px  MATCH
```

### Test changes

- `test/grid.html` now embeds the chip bar markup **captured verbatim** from
  the live page instead of an imitation.
- The harness reports an uncaught error as a `FAIL`, and the runner fails a
  fixture that produced no passing checks.

Against the pre-fix code the suite now fails on placement, wrapper and row
position, then reports the crash. Against the fix it passes.

---

## 7. Still unverified

The watched-detection selectors have **not** been confirmed against real
markup. YouTube only renders a resume bar for a signed-in viewer with watch
history, and every capture here was logged out, where zero cards carry one.

The three selectors in `src/watched.ts` remain a best guess. To check on a
real session, open a channel's Videos tab and run
`__ytUnwatched.report()` from the DevTools console with the context switched
to the extension: `progressSelectorMatches` shows how many cards each
selector matched. All zero on a channel with watched videos means the class
name has changed, and that is the line to update.

---

## 8. Lessons

1. **Renderer names are not markup.** `ytInitialData` proved the layout
   family and nothing about elements, classes or nesting.
2. **A fixture written from the code's assumptions tests nothing.** Capture
   the real thing, or accept that the suite only proves internal
   consistency.
3. **A suite that cannot fail is worse than no suite**, because it is
   reported as evidence. The crashed-fixture hole meant every green run was
   partly unearned.
4. **For a DOM-coupled extension, render the target before writing
   selectors.** Headless Chrome plus a frozen snapshot takes minutes and
   would have prevented all of this.
