/**
 * Deciding whether a video card has been watched.
 *
 * The only reliable signal YouTube gives us on a grid card is the red resume
 * bar painted across the bottom of the thumbnail. It is rendered from the
 * viewer's own watch history, so it is exactly what the eye uses when
 * scanning a channel manually -- we just read it in bulk.
 *
 * Rule: any progress at all counts as watched. A video you opened for ten
 * seconds is a video you have already made a decision about.
 */

/**
 * Resume-bar selectors, current layout first. Kept as an array so the
 * diagnostics helper can report which one actually matched.
 */
export const PROGRESS_SELECTORS: readonly string[] = [
  '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
  'yt-thumbnail-overlay-progress-bar-view-model [style*="width"]',
  'ytd-thumbnail-overlay-resume-playback-renderer #progress',
];

export const PROGRESS = PROGRESS_SELECTORS.join(', ');

/** The resume bar inside a card, or null if the card has none. */
export function findProgressBar(item: Element): HTMLElement | null {
  return item.querySelector<HTMLElement>(PROGRESS);
}

/**
 * How far through the video the resume bar says we are, 0-100.
 * Returns null when the bar exists but cannot be measured -- offscreen
 * cards have a zero-size rect, and a bar we cannot measure is still a bar.
 */
export function progressPercent(bar: HTMLElement): number | null {
  const inline = bar.style.width;

  if (inline.endsWith('%')) {
    const percent = Number.parseFloat(inline);
    if (Number.isFinite(percent)) return percent;
  }

  const own = bar.getBoundingClientRect().width;
  const track = bar.parentElement?.getBoundingClientRect().width ?? 0;

  if (!track) return own > 0 ? 100 : null;
  return (own / track) * 100;
}

/**
 * True when the card shows any watch progress.
 * A present-but-unmeasurable bar counts as watched: YouTube only renders
 * the segment for videos it has progress for, so its presence is the
 * stronger signal and a zero measurement usually just means offscreen.
 */
export function isWatched(item: Element): boolean {
  const bar = findProgressBar(item);
  if (!bar) return false;

  const percent = progressPercent(bar);
  return percent === null ? true : percent > 0;
}
