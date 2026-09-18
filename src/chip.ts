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

import { CHIP } from './selectors';

interface ChipNodes {
  button: HTMLButtonElement;
  label: HTMLSpanElement;
}

const SELECTED = /(^|[\s_-])selected([\s_-]|$)/i;

let nodes: ChipNodes | null = null;
let handler: (() => void) | null = null;

/** className we last borrowed, so an unchanged bar costs no DOM writes. */
let borrowedFrom: string | null = null;

/** True for the chip that is currently active, e.g. Latest. */
function isSelected(node: Element): boolean {
  return (
    node.getAttribute('aria-selected') === 'true' ||
    node.getAttribute('aria-pressed') === 'true' ||
    node.hasAttribute('selected') ||
    SELECTED.test(node.className)
  );
}

/**
 * An unselected YouTube chip whose styling we can borrow. Unselected
 * matters: copying the selected chip's classes would leave ours looking
 * permanently active.
 */
function findTemplate(bar: Element): HTMLElement | null {
  for (const chip of bar.querySelectorAll(CHIP)) {
    if (nodes && chip.contains(nodes.button)) continue;
    if (isSelected(chip)) continue;

    const button = chip.matches('button')
      ? (chip as HTMLElement)
      : chip.querySelector<HTMLElement>('button, .yt-spec-button-shape-next');

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
function applyTemplate(chip: ChipNodes, template: HTMLElement | null): void {
  const source = template ? template.className : '';
  if (source === borrowedFrom) return;
  borrowedFrom = source;

  if (!template) {
    chip.button.className = 'ytu-chip ytu-chip--bare';
    chip.label.className = '';
    return;
  }

  chip.button.className = `${source} ytu-chip`;

  const innerText = template.querySelector('[class*="text-content"], [class*="text"]');
  chip.label.className = innerText ? innerText.className : '';
}

function build(): ChipNodes {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset['ytuChip'] = 'unwatched';
  button.title = 'Hide videos you have already started watching';
  button.setAttribute('aria-pressed', 'false');

  const label = document.createElement('span');
  button.appendChild(label);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler?.();
  });

  return { button, label };
}

/**
 * Put the chip in the bar, creating it on first call and re-attaching it
 * after YouTube replaces the bar (which it does on every sort change).
 */
export function ensure(bar: Element, onToggle: () => void): HTMLButtonElement {
  handler = onToggle;
  nodes ??= build();

  applyTemplate(nodes, findTemplate(bar));

  if (nodes.button.parentElement !== bar) bar.appendChild(nodes.button);
  return nodes.button;
}

export function setLabel(text: string): void {
  if (nodes && nodes.label.textContent !== text) nodes.label.textContent = text;
}

export function setActive(active: boolean): void {
  if (!nodes) return;
  nodes.button.classList.toggle('ytu-chip--active', active);
  nodes.button.setAttribute('aria-pressed', String(active));
}

/** Detach on navigation away, keeping the node for reuse. */
export function remove(): void {
  nodes?.button.remove();
}

export function element(): HTMLButtonElement | null {
  return nodes?.button ?? null;
}
