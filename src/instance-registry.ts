import type { Embedded } from './embedded';

const elements = new WeakMap<HTMLElement, Embedded>();
const instances = new Map<Embedded, { source: HTMLElement; container: HTMLElement }>();
let observer: MutationObserver | null = null;

export function findEmbed(element: HTMLElement): Embedded | undefined {
  return elements.get(element);
}

export function trackEmbed(embed: Embedded, source: HTMLElement, container: HTMLElement): void {
  elements.set(source, embed);
  elements.set(container, embed);
  instances.set(embed, { source, container });

  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((mutations) => {
    const removed: Node[] = [];
    for (const mutation of mutations) removed.push(...Array.from(mutation.removedNodes));
    for (const [instance, { container: root }] of instances) {
      // A removal can be a move; decide only after all synchronous DOM changes.
      if (!root.isConnected && removed.some(node => node === root || node.contains(root))) {
        instance.destroy();
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export function untrackEmbed(embed: Embedded): void {
  const record = instances.get(embed);
  if (!record) return;
  elements.delete(record.source);
  elements.delete(record.container);
  instances.delete(embed);
  if (!instances.size) {
    observer?.disconnect();
    observer = null;
  }
}

export function destroyEmbeds(): void {
  observer?.disconnect();
  observer = null;
  for (const embed of Array.from(instances.keys())) embed.destroy();
}
