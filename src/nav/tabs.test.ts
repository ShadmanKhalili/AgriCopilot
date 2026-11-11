import { describe, expect, it } from 'vitest';
import { HOME_TAB, TAB_IDS, TAB_LEVEL, hashForTab, isTabInMode, tabFromHash } from './tabs';

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
});
