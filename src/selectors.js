/**
 * DOM selectors for a YouTube channel's Videos tab.
 *
 * YouTube runs two layouts in parallel and A/B tests between them:
 *
 *   - the current "view model" layout: richGridRenderer > richItemRenderer >
 *     lockupViewModel, with chipViewModel sort chips
 *   - the older Polymer layout: ytd-rich-grid-media / ytd-grid-video-renderer,
 *     with yt-chip-cloud-chip-renderer sort chips
 *
 * Every selector here lists the current form first and keeps the older form as
 * a fallback, so a flag flip on YouTube's side degrades instead of breaking.
 * Nothing matches on visible text, because chip labels are localised.
 */
globalThis.YTUnwatched = globalThis.YTUnwatched || {};

(() => {
  'use strict';

  /** One chip in the Latest / Popular / Oldest bar. */
  const CHIP = [
    'chip-view-model',
    'yt-chip-cloud-chip-renderer',
  ].join(', ');

  /** Containers that hold those chips, most specific first. */
  const CHIP_BAR = [
    'ytd-feed-filter-chip-bar-renderer #chips',
    'yt-chip-cloud-renderer #chips',
    '#chips-wrapper #chips',
    'chip-bar-view-model',
  ].join(', ');

  /** The element the video cards are appended to. */
  const GRID_CONTENTS = [
    'ytd-rich-grid-renderer #contents',
    'ytd-section-list-renderer #contents',
  ].join(', ');

  /** A single video card. */
  const GRID_ITEM = [
    'ytd-rich-item-renderer',
    'ytd-grid-video-renderer',
  ].join(', ');

  /**
   * The chip bar, or null when a channel has too few videos to show one.
   * Falls back to the parent of any chip we can find, which keeps working if
   * YouTube renames the container but keeps the chips themselves.
   */
  function findChipBar() {
    const container = document.querySelector(CHIP_BAR);
    if (container) return container;

    const chip = document.querySelector(CHIP);
    return chip ? chip.parentElement : null;
  }

  /** The grid container currently on screen, or null before it renders. */
  function findGridContents() {
    return document.querySelector(GRID_CONTENTS);
  }

  /** Every video card currently loaded into the grid. */
  function getGridItems(root) {
    const scope = root && root.isConnected ? root : document;
    return Array.from(scope.querySelectorAll(GRID_ITEM));
  }

  globalThis.YTUnwatched.selectors = {
    CHIP,
    CHIP_BAR,
    GRID_CONTENTS,
    GRID_ITEM,
    findChipBar,
    findGridContents,
    getGridItems,
  };
})();
