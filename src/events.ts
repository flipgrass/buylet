export type WtbEvent = 'wtb:view' | 'wtb:click';

export function emit(el: HTMLElement, name: WtbEvent, detail: Record<string, unknown>): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  const layer = (window as any).dataLayer;
  if (Array.isArray(layer)) layer.push({ event: name, ...detail });
}
