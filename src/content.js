/**
 * Entry point: adds an Unwatched filter to a channel's Videos tab.
 *
 * The filter is client-side and deliberately shallow -- it hides the watched
 * cards YouTube has already loaded into the grid, and nothing more. It does
 * not fetch, auto-scroll or store anything.
 */
(() => {
  'use strict';

  const NS = globalThis.YTUnwatched;
  const { selectors, watched, chip } = NS;

  /** /@handle/videos, /channel/UC.../videos, /c/name/videos, /user/name/videos */
  const VIDEOS_PATH = /^\/(?:@[^/]+|c\/[^/]+|channel\/[^/]+|user\/[^/]+)\/videos\/?$/;

  /** Sticky for the tab session: survives sort changes and channel hops. */
  let enabled = false;

  function onVideosPage() {
    return VIDEOS_PATH.test(location.pathname);
  }

  /**
   * Tag every loaded card as watched or not and switch the grid's filtering
   * class. The hiding itself is done in CSS, so re-running this is cheap.
   */
  function apply() {
    if (!onVideosPage()) return;

    const bar = selectors.findChipBar();
    if (bar) chip.ensure(bar, toggle);

    const contents = selectors.findGridContents();
    if (!contents) return;

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

  apply();
})();
