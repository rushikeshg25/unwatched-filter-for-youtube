/**
 * Entry point: adds an Unwatched filter to a channel's Videos tab.
 *
 * The filter is client-side and deliberately shallow -- it hides the watched
 * cards YouTube has already loaded into the grid, and nothing more. It does
 * not fetch, auto-scroll or store anything. Scroll down and the newly loaded
 * cards are filtered as they arrive.
 */
(() => {
  'use strict';

  const NS = globalThis.YTUnwatched;
  const { selectors, watched, chip } = NS;

  /** /@handle/videos, /channel/UC.../videos, /c/name/videos, /user/name/videos */
  const VIDEOS_PATH = /^\/(?:@[^/]+|c\/[^/]+|channel\/[^/]+|user\/[^/]+)\/videos\/?$/;

  /** Long enough to coalesce a burst of lazy-loaded cards into one pass. */
  const DEBOUNCE_MS = 150;

  /** Sticky for the tab session: survives sort changes and channel hops. */
  let enabled = false;

  let gridObserver = null;
  let rootObserver = null;
  let observedGrid = null;
  let timer = 0;
  let lastHref = location.href;

  function onVideosPage() {
    return VIDEOS_PATH.test(location.pathname);
  }

  function schedule() {
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
  function watchGrid(contents) {
    if (gridObserver) gridObserver.disconnect();
    gridObserver = new MutationObserver(schedule);
    gridObserver.observe(contents, { childList: true, subtree: true });
    observedGrid = contents;

    if (rootObserver) {
      rootObserver.disconnect();
      rootObserver = null;
    }
  }

  /** Wait for the grid to exist. Noisy, so it runs only until it finds one. */
  function watchForGrid() {
    if (rootObserver) return;
    rootObserver = new MutationObserver(schedule);
    rootObserver.observe(document.body, { childList: true, subtree: true });
  }

  /** Leave the page exactly as we found it when navigating away. */
  function teardown() {
    chip.remove();

    if (gridObserver) gridObserver.disconnect();
    if (rootObserver) rootObserver.disconnect();
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
  function apply() {
    if (!onVideosPage()) {
      teardown();
      return;
    }

    const bar = selectors.findChipBar();
    if (bar) chip.ensure(bar, toggle);

    const contents = selectors.findGridContents();
    if (!contents) {
      watchForGrid();
      return;
    }

    if (contents !== observedGrid || !observedGrid.isConnected) {
      watchGrid(contents);
    }

    for (const item of selectors.getGridItems(contents)) {
      item.classList.toggle('ytu-watched', watched.isWatched(item));
    }

    contents.classList.toggle('ytu-filtering', enabled);
    chip.setLabel('Unwatched');
    chip.setActive(enabled);
  }

  function toggle() {
    enabled = !enabled;
    apply();
  }

  /**
   * YouTube is a single-page app: the Videos tab is reached without a page
   * load, so every entry and exit arrives as one of these events.
   */
  function onNavigate() {
    lastHref = location.href;

    if (onVideosPage()) {
      apply();
      watchForGrid();
    } else {
      teardown();
    }
  }

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
})();
