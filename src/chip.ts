/**
 * The "Unwatched" chip that sits beside Latest / Popular / Oldest.
 *
 * Matching YouTube's chip is the whole problem here. The visible chip is not
 * the <button>: the button carries a *reset* class that strips its styling,
 * the pixels come from a div below it, and below that again sit unclassed
 * ripple elements. Today the chain is:
 *
 *   chip-view-model.ytChipViewModelHost
 *     chip-shape.ytChipShapeHost
 *       button.ytChipShapeButtonReset
 *         div.ytChipShapeChip.ytChipShapeInactive.ytChipShapeOnlyTextPadding
 *           (ripple elements, no classes)
 *
 * So rather than copy a class off one element, we rebuild the entire chain:
 * each element recreated with its class names, custom-element tags swapped
 * for plain divs. That keeps YouTube's class-based CSS painting our chip in
 * both themes, and avoids cloning a custom element -- a clone of one gets
 * upgraded by YouTube's runtime, which can re-bind YouTube's tap handler to
 * our element.
 *
 * Selected state is read the same way, by comparing chips rather than by
 * knowing any name: YouTube sets no aria-selected here, so the only signal
 * is that the selected chip's class tokens differ from everyone else's.
 * Whatever those tokens are, we swap them on click.
 *
 * If any of this fails we fall back to .ytu-chip--bare, a chip drawn from
 * scratch in content.css.
 */

import type { ChipBar } from './selectors';

interface ChipNodes {
  /** Outermost element: carries our click handler and marker attribute. */
  root: HTMLElement;
  /** The element the label text goes in. */
  label: HTMLElement;
  /** The focusable control, same as root when we built a bare chip. */
  button: HTMLElement;
  /** The element whose classes change between selected and unselected. */
  stateNode: HTMLElement | null;
  /** Our own wrapper imitating YouTube's, when the bar uses them. */
  wrapper: HTMLElement | null;
}

/** The class tokens that distinguish a selected chip from an unselected one. */
interface ChipStates {
  whenActive: string[];
  whenInactive: string[];
}

let nodes: ChipNodes | null = null;
let states: ChipStates | null = null;
let handler: (() => void) | null = null;
let builtFromChips = false;

/** Every class token anywhere inside a chip. */
function tokensOf(root: Element): Set<string> {
  const tokens = new Set<string>();

  const walk = (element: Element): void => {
    for (const token of element.classList) tokens.add(token);
    for (const child of element.children) walk(child);
  };

  walk(root);
  return tokens;
}

function signatureOf(chip: Element): string {
  return [...tokensOf(chip)].sort().join(' ');
}

/**
 * Split the chips into the selected one and the rest, without knowing what
 * "selected" is called: the class signature shared by most chips is the
 * unselected look, and a signature that differs is the selected one.
 */
function readStates(chips: HTMLElement[]): { template: HTMLElement; states: ChipStates | null } | null {
  const groups = new Map<string, HTMLElement[]>();

  for (const chip of chips) {
    const signature = signatureOf(chip);
    const group = groups.get(signature);
    if (group) group.push(chip);
    else groups.set(signature, [chip]);
  }

  const ranked = [...groups.values()].sort((a, b) => b.length - a.length);
  const majority = ranked[0]?.[0];
  if (!majority) return null;

  const minority = ranked[1]?.[0];
  if (!minority) return { template: majority, states: null };

  const inactive = tokensOf(majority);
  const active = tokensOf(minority);

  return {
    template: majority,
    states: {
      whenActive: [...active].filter((token) => !inactive.has(token)),
      whenInactive: [...inactive].filter((token) => !active.has(token)),
    },
  };
}

/**
 * Rebuild an element tree with its classes but without its custom elements.
 * Attributes are dropped -- they carry YouTube's ids and bookkeeping, and
 * the classes are the only part worth having.
 */
function rebuild(source: Element, found: { label: HTMLElement | null }): HTMLElement {
  const isCustom = source.tagName.includes('-');
  const element = document.createElement(isCustom ? 'div' : source.tagName.toLowerCase());
  element.className = source.className;

  for (const child of source.children) {
    element.appendChild(rebuild(child, found));
  }

  // Deepest element holding text wins, because children are visited first.
  const holdsText = [...source.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
  );
  if (holdsText && !found.label) found.label = element;

  return element;
}

function buildFromTemplate(template: HTMLElement, bar: ChipBar): ChipNodes {
  const found: { label: HTMLElement | null } = { label: null };
  const root = rebuild(template, found);

  let label = found.label;
  if (!label) {
    label = document.createElement('span');
    root.appendChild(label);
  }
  label.classList.add('ytu-chip__label');

  const button = root.querySelector('button') ?? root;
  if (button instanceof HTMLButtonElement) button.type = 'button';

  // The element carrying the unselected tokens is the one to swap on click.
  let stateNode: HTMLElement | null = null;
  if (states?.whenInactive.length) {
    const marker = states.whenInactive[0] as string;
    stateNode = root.classList.contains(marker)
      ? root
      : root.querySelector<HTMLElement>(`.${CSS.escape(marker)}`);
  }

  let wrapper: HTMLElement | null = null;
  if (bar.wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = `${bar.wrapper.className} ytu-chip-wrapper`;
    wrapper.appendChild(root);
  }

  return { root, label, button, stateNode, wrapper };
}

/** Last resort: a chip drawn entirely by our own stylesheet. */
function buildBare(): ChipNodes {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ytu-chip ytu-chip--bare';

  const label = document.createElement('span');
  label.className = 'ytu-chip__label';
  button.appendChild(label);

  return { root: button, label, button, stateNode: null, wrapper: null };
}

function build(bar: ChipBar): ChipNodes {
  const read = bar.chips.length ? readStates(bar.chips) : null;
  states = read?.states ?? null;

  const chip = read ? buildFromTemplate(read.template, bar) : buildBare();
  builtFromChips = Boolean(read);

  chip.root.classList.add('ytu-chip');
  chip.root.dataset['ytuChip'] = 'unwatched';
  chip.root.title = 'Hide videos you have already started watching';
  chip.button.setAttribute('aria-pressed', 'false');

  chip.root.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler?.();
  });

  return chip;
}

/**
 * Put the chip in the bar, building it on first call and re-attaching it
 * after YouTube replaces the bar (which it does on every sort change).
 */
export function ensure(bar: ChipBar, onToggle: () => void): HTMLElement {
  handler = onToggle;

  // If the chip was drawn from scratch and real chips have since rendered,
  // rebuild so a slow bar still ends up with a matching chip.
  if (nodes && !builtFromChips && bar.chips.length) {
    (nodes.wrapper ?? nodes.root).remove();
    nodes = null;
  }

  nodes ??= build(bar);

  const node = nodes.wrapper ?? nodes.root;
  if (node.parentElement !== bar.row) bar.row.appendChild(node);

  return nodes.root;
}

export function setLabel(text: string): void {
  if (nodes && nodes.label.textContent !== text) nodes.label.textContent = text;
}

export function setActive(active: boolean): void {
  if (!nodes) return;

  nodes.button.setAttribute('aria-pressed', String(active));

  // Prefer YouTube's own selected styling; fall back to our stylesheet when
  // the chips gave us no way to tell the two states apart.
  if (nodes.stateNode && states) {
    const add = active ? states.whenActive : states.whenInactive;
    const drop = active ? states.whenInactive : states.whenActive;
    nodes.stateNode.classList.remove(...drop);
    nodes.stateNode.classList.add(...add);
    return;
  }

  nodes.root.classList.toggle('ytu-chip--paint-active', active);
}

/** Detach on navigation away, keeping the node for reuse. */
export function remove(): void {
  if (!nodes) return;
  (nodes.wrapper ?? nodes.root).remove();
}

export function element(): HTMLElement | null {
  return nodes?.root ?? null;
}
