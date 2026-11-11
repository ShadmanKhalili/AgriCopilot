/**
 * The one list of the app's tools (tabs).
 *
 * Every piece of navigation (the sidebar, the mobile bottom bar, the URL hash)
 * reads from here, so a tool is added, renamed or moved between the simple and
 * full layers in a single place.
 */

export const TAB_IDS = [
  'agri-copilot',
  'smart-grade',
  'smart-planting',
  'climate-resilience',
  'krishi-profit',
  'market-connect',
  'weather-advisory',
  'crop-health',
  'community-radar',
  'gov-schemes',
  'farmer-dossier',
  'expert-hub',
  'user-guide',
  'profile',
  'admin-dashboard',
] as const;

export type Tab = (typeof TAB_IDS)[number];

/** The tab shown when the address has no hash. */
export const HOME_TAB: Tab = 'agri-copilot';

export type Pillar = 'health' | 'weather' | 'economics' | 'support';
export type PillarKey = 'all' | Pillar;

/**
 * How much of the app a farmer sees.
 * - `simple`: the few tools a first-time farmer needs.
 * - `full`: every tool.
 */
export type UiMode = 'simple' | 'full';

/**
 * The layer each tool first appears in. A `simple` tool is shown to everyone;
 * a `full` tool is shown in full mode and stays reachable from "All services".
 */
export const TAB_LEVEL: Record<Tab, UiMode> = {
  'agri-copilot': 'simple',
  'weather-advisory': 'simple',
  'market-connect': 'simple',
  'expert-hub': 'simple',
  'profile': 'simple',
  'smart-grade': 'full',
  'smart-planting': 'full',
  'climate-resilience': 'full',
  'krishi-profit': 'full',
  'crop-health': 'full',
  'community-radar': 'full',
  'gov-schemes': 'full',
  'farmer-dossier': 'full',
  'user-guide': 'full',
  'admin-dashboard': 'full',
};

export const isTabInMode = (tab: Tab, mode: UiMode): boolean =>
  mode === 'full' || TAB_LEVEL[tab] === 'simple';

// Short names used by the sitemap and older shared links.
const TAB_HASH_ALIASES: Record<string, Tab> = {
  copilot: 'agri-copilot',
  weather: 'weather-advisory',
  calculator: 'krishi-profit',
};

/**
 * The tab a URL hash points at. An empty hash is the home tab; a hash that
 * names no tab returns null so the caller can leave the current tab alone.
 */
export const tabFromHash = (hash: string): Tab | null => {
  let key = hash.replace(/^#/, '').trim().toLowerCase();
  try {
    key = decodeURIComponent(key);
  } catch {
    // Keep the raw value; it simply will not match a tab.
  }
  if (!key) return HOME_TAB;
  if ((TAB_IDS as readonly string[]).includes(key)) return key as Tab;
  return TAB_HASH_ALIASES[key] || null;
};

/** The hash for a tab's address. Home has none. */
export const hashForTab = (tab: Tab): string => (tab === HOME_TAB ? '' : `#${tab}`);
