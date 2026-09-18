/**
 * DOM selectors for a YouTube channel's Videos tab.
 *
 * YouTube runs two layouts in parallel and A/B tests between them:
 *
 *   - the current "view model" layout: richGridRenderer > richItemRenderer >
 *     lockupViewModel, with chip-view-model sort chips
 *   - the older Polymer layout: ytd-rich-grid-media / ytd-grid-video-renderer,
 *     with yt-chip-cloud-chip-renderer sort chips
 *
 * Every selector here lists the current form first and keeps the older form as
 * a fallback, so a flag flip on YouTube's side degrades instead of breaking.
 * Nothing matches on visible text, because chip labels are localised.
 */

/** One chip in the Latest / Popular / Oldest bar. */
export const CHIP = ['chip-view-model', 'yt-chip-cloud-chip-renderer'].join(', ');

/** The element the video cards are appended to. */
export const GRID_CONTENTS = [
  'ytd-rich-grid-renderer #contents',
  'ytd-section-list-renderer #contents',
].join(', ');

/** A single video card. */
export const GRID_ITEM = ['ytd-rich-item-renderer', 'ytd-grid-video-renderer'].join(', ');

/** Where the chips live, and how they are wrapped. */
export interface ChipBar {
  /** The element the chips are laid out in -- what we append to. */
  row: Element;
  /**
   * The per-chip wrapper to imitate, when YouTube gives each chip one.
   * Today it does: .ytChipBarViewModelChipWrapper. Copying it is what keeps
   * our chip on the row instead of beside it.
   */
  wrapper: HTMLElement | null;
  chips: HTMLElement[];
}

/**
 * Find the chip bar by looking at the chips themselves rather than at the
 * container's name.
 *
 * Naming the container was the original approach and it was wrong: the
 * current bar is <chip-bar-view-model>, whose direct child is a scroll
 * container, so appending to it put our chip outside the row the chips are
 * in. Deriving the row from a chip's own parent cannot make that mistake,
 * and survives the container being renamed.
 */
export function findChipBar(): ChipBar | null {
  const scope = document.querySelector('ytd-rich-grid-renderer') ?? document;
  const chips = Array.from(scope.querySelectorAll<HTMLElement>(CHIP));

  const first = chips[0];
  if (!first?.parentElement) return null;

  const sharedParent = chips.every((chip) => chip.parentElement === first.parentElement);

  // Chips side by side: their parent is the row.
  if (sharedParent) {
    return { row: first.parentElement, wrapper: null, chips };
  }

  // Each chip in its own wrapper: the row is the wrapper's parent, and we
  // need a wrapper of our own to sit correctly among them.
  const wrapper = first.parentElement;
  return { row: wrapper.parentElement ?? wrapper, wrapper, chips };
}

/** The grid container currently on screen, or null before it renders. */
export function findGridContents(): HTMLElement | null {
  return document.querySelector<HTMLElement>(GRID_CONTENTS);
}

/** Every video card currently loaded into the grid. */
export function getGridItems(root?: Element | null): HTMLElement[] {
  const scope: ParentNode = root?.isConnected ? root : document;
  return Array.from(scope.querySelectorAll<HTMLElement>(GRID_ITEM));
}
