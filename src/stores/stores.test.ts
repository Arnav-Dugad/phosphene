import { beforeEach, describe, expect, it } from 'vitest';
import { fragmentCount, useProgress } from './progress.ts';
import { DEFAULT_SETTINGS, resolveMotion, useSettings } from './settings.ts';

describe('progress', () => {
  beforeEach(() => useProgress.getState().reset());

  it('unlocks each fragment once', () => {
    const { unlock } = useProgress.getState();
    expect(unlock(4)).toBe(true);
    expect(unlock(4)).toBe(false);
    expect(fragmentCount(useProgress.getState().fragments)).toBe(1);
    expect(useProgress.getState().hasFragment(4)).toBe(true);
  });

  it('traces the path without repeating consecutive steps', () => {
    const { visit } = useProgress.getState();
    visit('/');
    visit('/');
    visit('/atlas');
    visit('/');
    expect(useProgress.getState().path).toEqual(['/', '/atlas', '/']);
  });

  it('keeps the path to a bounded length', () => {
    const { visit } = useProgress.getState();
    for (let i = 0; i < 200; i++) visit(`/archive/sr-${i}`);
    expect(useProgress.getState().path.length).toBeLessThanOrEqual(96);
    expect(useProgress.getState().path.at(-1)).toBe('/archive/sr-199');
  });

  it('keeps sigils short and trims blanks to nothing', () => {
    const { setSigil } = useProgress.getState();
    setSigil('   ');
    expect(useProgress.getState().sigil).toBeNull();
    setSigil('a'.repeat(80));
    expect(useProgress.getState().sigil).toHaveLength(32);
  });
});

describe('settings', () => {
  beforeEach(() => useSettings.getState().reset());

  it('starts silent, automatic and in Nocturne', () => {
    expect(DEFAULT_SETTINGS.sound).toBe(false);
    expect(DEFAULT_SETTINGS.quality).toBe('auto');
    expect(useSettings.getState().theme).toBe('nocturne');
  });

  it('updates one preference at a time', () => {
    useSettings.getState().set('grain', false);
    expect(useSettings.getState().grain).toBe(false);
    expect(useSettings.getState().cursor).toBe(DEFAULT_SETTINGS.cursor);
  });

  it('resolves explicit motion preferences directly', () => {
    expect(resolveMotion('gentle')).toBe('gentle');
    expect(resolveMotion('still')).toBe('still');
  });
});
