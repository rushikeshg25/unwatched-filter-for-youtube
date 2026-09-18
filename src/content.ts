/**
 * Entry point: adds an Unwatched filter to a channel's Videos tab.
 *
 * The filter is client-side and deliberately shallow -- it hides the watched
 * cards YouTube has already loaded into the grid, and nothing more. It does
 * not fetch, auto-scroll or store anything. Scroll down and the newly loaded
 * cards are filtered as they arrive.
 */

import * as chip from './chip';
import * as selectors from './selectors';
import type { ChipBar } from './selectors';
import * as watched from './watched';

/** /@handle/videos, /channel/UC.../videos, /c/name/videos, /user/name/videos */
const VIDEOS_PATH = /^\/(?:@[^/]+|c\/[^/]+|channel\/[^/]+|user\/[^/]+)\/videos\/?$/;

/** Long enough to coalesce a burst of lazy-loaded cards into one pass. */
const DEBOUNCE_MS = 150;

interface Stats {
  total: number;
  watched: number;
  unwatched: number;
}

interface Report {
  onVideosPage: boolean;
  chipBarFound: boolean;
  chipAttached: boolean;
  gridFound: boolean;
  cardsLoaded: number;
  watched: number;
  unwatched: number;
  filtering: boolean;
  progressSelectorMatches: Record<string, number>;
}

interface Diagnostics {
  readonly enabled: boolean;
  readonly stats: Stats;
  toggle(): void;
  refresh(): void;
  report(): Report;
}

declare global {
  // eslint-disable-next-line no-var -- `var` is how a global is declared
  var __ytUnwatched: Diagnostics;
}

/** Sticky for the tab session: survives sort changes and channel hops. */
let enabled = false;

let gridObserver: MutationObserver | null = null;
let rootObserver: MutationObserver | null = null;
let observedGrid: HTMLElement | null = null;
let timer = 0;
let lastHref = location.href;

/** Result of the last pass, also used by the diagnostics helper. */
let stats: Stats = { total: 0, watched: 0, unwatched: 0 };

let noteNode: HTMLParagraphElement | null = null;
let standaloneBar: HTMLDivElement | null = null;

function onVideosPage(): boolean {
  return VIDEOS_PATH.test(location.pathname);
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = 0;
    apply();
  }, DEBOUNCE_MS);
}

/**
 * Watch the grid for lazy-loaded cards and for the wholesale replacement
 * that happens when the viewer switches sort order.
 *
 * childList only, never attributes: the pass below writes classes onto
 * cards, and observing attributes would make this feed itself.
 */
function watchGrid(contents: HTMLElement): void {
  gridObserver?.disconnect();
  gridObserver = new MutationObserver(schedule);
  gridObserver.observe(contents, { childList: true, subtree: true });
  observedGrid = contents;

  rootObserver?.disconnect();
  rootObserver = null;
}

/** Wait for the grid to exist. Noisy, so it runs only until it finds one. */
function watchForGrid(): void {
  if (rootObserver) return;
  rootObserver = new MutationObserver(schedule);
  rootObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * A line of explanation under the chip bar. With no auto-scrolling, an
 * empty-looking grid is a normal state rather than a bug, and the viewer
 * needs to be told which normal state they are in.
 */
function noteText(): string {
  if (!stats.total) return '';

  if (!stats.unwatched) {
    return `Every loaded video (${stats.total}) is watched. Scroll down to load more.`;
  }

  if (!stats.watched) {
    return `Nothing loaded (${stats.total}) is marked as watched. Check that you are signed in and watch history is on.`;
  }

  return `Hiding ${stats.watched} watched. Scroll down to load more.`;
}

function removeNote(): void {
  noteNode?.remove();
  noteNode = null;
}

function updateNote(contents: HTMLElement): void {
  const text = enabled ? noteText() : '';

  if (!text) {
    removeNote();
    return;
  }

  if (!noteNode) {
    noteNode = document.createElement('p');
    noteNode.className = 'ytu-note';
  }

  if (noteNode.textContent !== text) noteNode.textContent = text;

  // Just above the grid, and outside #contents on purpose: writing it
  // inside would retrigger the observer that watches the grid.
  const parent = contents.parentElement;
  if (parent && noteNode.parentElement !== parent) {
    parent.insertBefore(noteNode, contents);
  }
}

/**
 * Where the chip should live. Channels with only a handful of videos get
 * no sort chips at all, so rather than dropping the feature the chip gets
 * a bar of its own just above the grid.
 */
function chipHome(contents: HTMLElement): ChipBar | null {
  const bar = selectors.findChipBar();

  if (bar) {
    standaloneBar?.remove();
    standaloneBar = null;
    return bar;
  }

  if (!standaloneBar) {
    standaloneBar = document.createElement('div');
    standaloneBar.className = 'ytu-standalone-bar';
  }

  const parent = contents.parentElement;
  if (!parent) return null;

  if (standaloneBar.parentElement !== parent) {
    parent.insertBefore(standaloneBar, contents);
  }

  return { row: standaloneBar, wrapper: null, chips: [] };
}

/** Leave the page exactly as we found it when navigating away. */
function teardown(): void {
  chip.remove();
  removeNote();

  standaloneBar?.remove();
  standaloneBar = null;

  gridObserver?.disconnect();
  rootObserver?.disconnect();
  gridObserver = null;
  rootObserver = null;
  observedGrid = null;

  for (const node of document.querySelectorAll('.ytu-filtering')) {
    node.classList.remove('ytu-filtering');
  }
}

/**
 * Tag every loaded card as watched or not and switch the grid's filtering
 * class. The hiding itself is done in CSS, so re-running this is cheap.
 */
function apply(): void {
  if (!onVideosPage()) {
    teardown();
    return;
  }

  const contents = selectors.findGridContents();
  if (!contents) {
    watchForGrid();
    return;
  }

  const home = chipHome(contents);
  if (home) chip.ensure(home, toggle);

  if (contents !== observedGrid || !observedGrid.isConnected) {
    watchGrid(contents);
  }

  const items = selectors.getGridItems(contents);
  let watchedCount = 0;

  for (const item of items) {
    const seen = watched.isWatched(item);
    item.classList.toggle('ytu-watched', seen);
    if (seen) watchedCount += 1;
  }

  stats = {
    total: items.length,
    watched: watchedCount,
    unwatched: items.length - watchedCount,
  };

  contents.classList.toggle('ytu-filtering', enabled);
  // No count: the grid is lazy-loaded, so any number here would only ever
  // describe the videos loaded so far and would read as the channel total.
  chip.setLabel('Unwatched');
  chip.setActive(enabled);
  updateNote(contents);
}

function toggle(): void {
  enabled = !enabled;
  apply();
}

/**
 * YouTube is a single-page app: the Videos tab is reached without a page
 * load, so every entry and exit arrives as one of these events.
 */
function onNavigate(): void {
  lastHref = location.href;

  if (onVideosPage()) {
    apply();
  } else {
    teardown();
  }
}

/**
 * Console helper for when YouTube changes its markup. Run
 * __ytUnwatched.report() from the DevTools console with the context
 * switched to this extension, and it prints which selectors still match.
 */
globalThis.__ytUnwatched = {
  get enabled(): boolean {
    return enabled;
  },
  get stats(): Stats {
    return { ...stats };
  },
  toggle,
  refresh: apply,
  report(): Report {
    const contents = selectors.findGridContents();
    const items = contents ? selectors.getGridItems(contents) : [];

    const progressSelectorMatches: Record<string, number> = {};
    for (const selector of watched.PROGRESS_SELECTORS) {
      progressSelectorMatches[selector] = items.filter((item) =>
        item.querySelector(selector),
      ).length;
    }

    const summary = {
      onVideosPage: onVideosPage(),
      chipBarFound: Boolean(selectors.findChipBar()),
      chipAttached: Boolean(chip.element()?.isConnected),
      gridFound: Boolean(contents),
      cardsLoaded: items.length,
      watched: stats.watched,
      unwatched: stats.unwatched,
      filtering: enabled,
    };

    console.table(summary);
    console.table(progressSelectorMatches);
    return { ...summary, progressSelectorMatches };
  },
};

document.addEventListener('yt-navigate-finish', onNavigate);
document.addEventListener('yt-page-data-updated', onNavigate);
window.addEventListener('popstate', onNavigate);

// Safety net: those events are YouTube's own and could be renamed. A URL
// comparison once a second costs nothing and keeps the chip from going
// missing if that ever happens.
setInterval(() => {
  if (location.href !== lastHref) onNavigate();
}, 1000);

onNavigate();
