/**
 * The "Unwatched" chip that sits beside Latest / Popular / Oldest.
 *
 * The chip is a plain <button> that borrows the class names of a real
 * YouTube chip, rather than a clone of one. Cloning a <chip-view-model>
 * gets the copy upgraded by YouTube's own runtime, which can re-bind
 * YouTube's tap handler to our element; borrowing class names gets the
 * same pixels with none of that. If the borrow fails, content.css has a
 * self-contained fallback under .ytu-chip--bare.
 */
globalThis.YTUnwatched = globalThis.YTUnwatched || {};

(() => {
  'use strict';

  const NS = globalThis.YTUnwatched;
  const SELECTED = /(^|[\s_-])selected([\s_-]|$)/i;

  let element = null;
  let labelNode = null;
  let handler = null;

  /** className we last borrowed, so an unchanged bar costs no DOM writes. */
  let borrowedFrom = null;

  /** True for the chip that is currently active, e.g. Latest. */
  function isSelected(node) {
    return (
      node.getAttribute('aria-selected') === 'true' ||
      node.getAttribute('aria-pressed') === 'true' ||
      node.hasAttribute('selected') ||
      SELECTED.test(node.className || '')
    );
  }

  /**
   * An unselected YouTube chip whose styling we can borrow. Unselected
   * matters: copying the selected chip's classes would leave ours looking
   * permanently active.
   */
  function findTemplate(bar) {
    const chips = bar.querySelectorAll(NS.selectors.CHIP);

    for (const chip of chips) {
      if (element && chip.contains(element)) continue;
      if (isSelected(chip)) continue;

      const button = chip.matches('button')
        ? chip
        : chip.querySelector('button, .yt-spec-button-shape-next');

      if (button && !isSelected(button)) return button;
    }

    return null;
  }

  /**
   * Copy a template chip's look onto our button, or fall back to the
   * self-contained styling when there is no chip to copy from.
   *
   * Writing className is skipped when the source has not changed: this runs
   * on every pass, and a needless write would both churn the DOM and drop
   * the active class that setActive() owns.
   */
  function applyTemplate(template) {
    const source = template ? template.className : '';
    if (source === borrowedFrom) return;
    borrowedFrom = source;

    if (!template) {
      element.className = 'ytu-chip ytu-chip--bare';
      labelNode.className = '';
      return;
    }

    element.className = `${source} ytu-chip`;

    const innerText = template.querySelector('[class*="text-content"], [class*="text"]');
    labelNode.className = innerText ? innerText.className : '';
  }

  function build() {
    element = document.createElement('button');
    element.type = 'button';
    element.dataset.ytuChip = 'unwatched';
    element.title = 'Hide videos you have already started watching';
    element.setAttribute('aria-pressed', 'false');

    labelNode = document.createElement('span');
    element.appendChild(labelNode);

    element.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (handler) handler();
    });
  }

  /**
   * Put the chip in the bar, creating it on first call and re-attaching it
   * after YouTube replaces the bar (which it does on every sort change).
   */
  function ensure(bar, onToggle) {
    handler = onToggle;
    if (!element) build();

    applyTemplate(findTemplate(bar));

    if (element.parentElement !== bar) bar.appendChild(element);
    return element;
  }

  function setLabel(text) {
    if (labelNode && labelNode.textContent !== text) labelNode.textContent = text;
  }

  function setActive(active) {
    if (!element) return;
    element.classList.toggle('ytu-chip--active', active);
    element.setAttribute('aria-pressed', String(active));
  }

  /** Detach on navigation away, keeping the node for reuse. */
  function remove() {
    if (element && element.parentElement) element.remove();
  }

  globalThis.YTUnwatched.chip = {
    ensure,
    setLabel,
    setActive,
    remove,
    get element() {
      return element;
    },
  };
})();
