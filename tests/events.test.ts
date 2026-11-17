import { afterEach, describe, expect, it } from 'vitest';
import { emit } from '../src/events.ts';

afterEach(() => { delete (window as any).dataLayer; });

describe('emit', () => {
  it('dispatches a bubbling composed event with detail', () => {
    const el = document.createElement('div');
    document.body.append(el);
    let got: CustomEvent | undefined;
    document.addEventListener('wtb:click', (e) => (got = e as CustomEvent), { once: true });
    emit(el, 'wtb:click', { productId: 'p1' });
    expect(got?.detail).toEqual({ productId: 'p1' });
    expect(got?.bubbles && got?.composed).toBe(true);
  });
  it('pushes to dataLayer when present', () => {
    (window as any).dataLayer = [];
    emit(document.body, 'wtb:view', { productId: 'p1' });
    expect((window as any).dataLayer).toEqual([{ event: 'wtb:view', productId: 'p1' }]);
  });
  it('does not throw without dataLayer', () => {
    expect(() => emit(document.body, 'wtb:view', {})).not.toThrow();
  });
});
