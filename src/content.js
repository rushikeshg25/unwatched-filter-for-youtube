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

  /** Result of the last pass, also used by the diagnostics helper. */
  let stats = { total: 0, watched: 0, unwatched: 0 };

  let noteNode = null;

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

  /**
   * A line of explanation under the chip bar. With no auto-scrolling, an
   * empty-looking grid is a normal state rather than a bug, and the viewer
   * needs to be told which normal state they are in.
   */
  function noteText() {
    if (!stats.total) return '';

    if (!stats.unwatched) {
      return `Every loaded video (${stats.total}) is watched. Scroll down to load more.`;
    }

    if (!stats.watched) {
      return `Nothing loaded (${stats.total}) is marked as watched \u2014 check that you are signed in and watch history is on.`;
    }

    return `Hiding ${stats.watched} watched. Scroll down to load more.`;
  }

  function removeNote() {
    if (noteNode) noteNode.remove();
    noteNode = null;
  }

  function updateNote(contents) {
    const text = enabled ? noteText() : '';

    if (!text) {
      removeNote();
      return;
    }

    if (!noteNode) {
      noteNode = document.createElement('p');
      noteNode.className = 'ytu-note';
    }

    noteNode.textContent = text;

    // Just above the grid, and outside #contents on purpose: writing it
    // inside would retrigger the observer that watches the grid.
    if (noteNode.parentElement !== contents.parentElement) {
      contents.parentElement.insertBefore(noteNode, contents);
    }
  }

  /** Leave the page exactly as we found it when navigating away. */
  function teardown() {
    chip.remove();
    removeNote();

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
    chip.setLabel(enabled ? `Unwatched · ${stats.unwatched}` : 'Unwatched');
    chip.setActive(enabled);
    updateNote(contents);
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

  /**
   * Console helper for when YouTube changes its markup. Run
   * __ytUnwatched.report() from the DevTools console with the context
   * switched to this extension, and it prints which selectors still match.
   */
  globalThis.__ytUnwatched = {
    get enabled() {
      return enabled;
    },
    get stats() {
      return { ...stats };
    },
    toggle,
    refresh: apply,
    report() {
      const contents = selectors.findGridContents();
      const items = contents ? selectors.getGridItems(contents) : [];

      const progressSelectorMatches = {};
      for (const selector of watched.PROGRESS_SELECTORS) {
        progressSelectorMatches[selector] = items.filter(
          (item) => item.querySelector(selector),
        ).length;
      }

      const summary = {
        onVideosPage: onVideosPage(),
        chipBarFound: Boolean(selectors.findChipBar()),
        chipAttached: Boolean(chip.element && chip.element.isConnected),
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
})();
