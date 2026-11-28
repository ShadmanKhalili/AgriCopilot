import { describe, expect, it } from 'vitest';
import {
  HOME_TAB,
  TAB_IDS,
  TAB_LEVEL,
  hashForTab,
  isTabInMode,
  partitionTabsByMode,
  tabFromHash,
} from './tabs';

describe('tabFromHash', () => {
  it('treats an empty hash as home', () => {
    expect(tabFromHash('')).toBe(HOME_TAB);
    expect(tabFromHash('#')).toBe(HOME_TAB);
  });

  it('reads a tab id, ignoring case and spaces', () => {
    expect(tabFromHash('#weather-advisory')).toBe('weather-advisory');
    expect(tabFromHash('#Expert-Hub ')).toBe('expert-hub');
  });

  it('accepts the short names used in older links', () => {
    expect(tabFromHash('#copilot')).toBe('agri-copilot');
    expect(tabFromHash('#agri-copilot')).toBe('agri-copilot');
    expect(tabFromHash('#weather')).toBe('weather-advisory');
    expect(tabFromHash('#calculator')).toBe('krishi-profit');
  });

  it('returns null for a hash that names no tab', () => {
    expect(tabFromHash('#nothing-here')).toBeNull();
    expect(tabFromHash('#%E0%A4%A')).toBeNull();
  });
});

describe('hashForTab', () => {
  it('gives home no hash and every other tab its id', () => {
    expect(hashForTab(HOME_TAB)).toBe('');
    expect(hashForTab('gov-schemes')).toBe('#gov-schemes');
  });

  it('round-trips every tab', () => {
    for (const tab of TAB_IDS) expect(tabFromHash(hashForTab(tab))).toBe(tab);
  });
});

describe('tool layers', () => {
  it('gives every tab a layer', () => {
    for (const tab of TAB_IDS) expect(TAB_LEVEL[tab]).toMatch(/^(simple|full)$/);
  });

  it('shows every tool in full mode and only the core ones in simple mode', () => {
    for (const tab of TAB_IDS) expect(isTabInMode(tab, 'full')).toBe(true);
    expect(isTabInMode('agri-copilot', 'simple')).toBe(true);
    expect(isTabInMode('weather-advisory', 'simple')).toBe(true);
    expect(isTabInMode('admin-dashboard', 'simple')).toBe(false);
    expect(isTabInMode('smart-planting', 'simple')).toBe(false);
  });

  it('lists the six simple tools in simple mode', () => {
    const simple = TAB_IDS.filter((tab) => isTabInMode(tab, 'simple'));
    expect(simple).toEqual([
      'home',
      'agri-copilot',
      'market-connect',
      'weather-advisory',
      'expert-hub',
      'profile',
    ]);
  });
});

describe('partitionTabsByMode', () => {
  const items = TAB_IDS.map((id) => ({ id }));

  it('puts the simple tools first and the rest under "more" in simple mode', () => {
    const { main, more } = partitionTabsByMode(items, 'simple');
    expect(main.map((i) => i.id)).toEqual([
      'home',
      'agri-copilot',
      'market-connect',
      'weather-advisory',
      'expert-hub',
      'profile',
    ]);
    expect(more.map((i) => i.id)).toContain('smart-planting');
    expect(more.map((i) => i.id)).toContain('admin-dashboard');
    // Nothing is lost: every tool is in exactly one group.
    expect(main.length + more.length).toBe(items.length);
    expect(main.some((i) => more.includes(i))).toBe(false);
  });

  it('shows everything in main and nothing under "more" in full mode', () => {
    const { main, more } = partitionTabsByMode(items, 'full');
    expect(main).toHaveLength(items.length);
    expect(more).toEqual([]);
  });

  it('never invents the admin tool: it only appears when the caller passes it in', () => {
    const noAdmin = items.filter((i) => i.id !== 'admin-dashboard');
    for (const mode of ['simple', 'full'] as const) {
      const { main, more } = partitionTabsByMode(noAdmin, mode);
      expect([...main, ...more].some((i) => i.id === 'admin-dashboard')).toBe(false);
    }
  });
});
