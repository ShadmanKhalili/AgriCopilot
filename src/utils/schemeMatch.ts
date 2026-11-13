/**
 * Matches support schemes to a farmer.
 *
 * Each scheme can carry eligibility tags: the crops, districts, land sizes and
 * kinds of land holding it is limited to, and who runs it. A tag is only set
 * when the scheme's own text says so; a scheme without a limit is open to all.
 *
 * Pure: no React, no storage, so it runs under Vitest.
 */

export type SchemeProvider = 'government' | 'ngo' | 'private';
export type LandTenure = 'owner' | 'tenant';

export interface EligibilityTags {
  /** Only growers of these crops. Missing, empty or containing 'all' means any crop. */
  crops?: string[];
  /** Only farmers in these districts. Missing, empty or containing 'all' means anywhere. */
  districts?: string[];
  maxLandDecimals?: number;
  minLandDecimals?: number;
  /** Only farmers who own, or who rent/sharecrop, their land. */
  tenure?: LandTenure[];
  provider?: SchemeProvider;
}

export interface FarmerFacts {
  crop?: string | null;
  district?: string | null;
  landDecimals?: number | null;
  tenure?: LandTenure | null;
}

export type MatchLevel = 'strong' | 'possible' | 'general';

/**
 * Why a scheme is listed. The UI turns these keys into words in Bangla or
 * English. The `-unknown` keys mean the scheme has a limit the farmer has not
 * told us enough to check.
 */
export type MatchReason =
  | 'crop'
  | 'district'
  | 'land'
  | 'tenure'
  | 'crop-unknown'
  | 'district-unknown'
  | 'land-unknown'
  | 'tenure-unknown'
  | 'open-to-all';

export interface SchemeMatch<T> {
  scheme: T;
  level: MatchLevel;
  reasons: MatchReason[];
  /** The tags the match was made from, so the UI can word the reasons. */
  tags: EligibilityTags;
}

const PROVIDERS: readonly SchemeProvider[] = ['government', 'ngo', 'private'];
const TENURES: readonly LandTenure[] = ['owner', 'tenant'];

/** Old and new English spellings of the same district. */
const DISTRICT_ALIASES: Record<string, string> = {
  bogra: 'bogura',
  barisal: 'barishal',
  chittagong: 'chattogram',
  comilla: 'cumilla',
  jessore: 'jashore',
};

/** Other names for the crop ids used in src/data/mainCrops.ts. */
const CROP_ALIASES: Record<string, string> = {
  rice: 'paddy',
  chilli: 'chili',
  eggplant: 'brinjal',
  aubergine: 'brinjal',
};

const toKey = (value: unknown): string =>
  typeof value === 'string' ? value.toLowerCase().trim().replace(/[\s'’.\-_]+/g, '') : '';

export const normalizeDistrict = (value: unknown): string => {
  const key = toKey(value);
  return DISTRICT_ALIASES[key] ?? key;
};

export const normalizeCrop = (value: unknown): string => {
  const key = toKey(value);
  return CROP_ALIASES[key] ?? key;
};

/** A limit list in normal form, or null when it does not limit anything. */
const limitList = (list: readonly unknown[] | undefined, normalize: (v: unknown) => string): Set<string> | null => {
  if (!Array.isArray(list)) return null;
  const keys = list.map(normalize).filter(Boolean);
  if (keys.length === 0 || keys.includes('all')) return null;
  return new Set(keys);
};

const isLand = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** How one scheme fits the farmer, or null when its tags rule the farmer out. */
export function matchScheme<T>(scheme: T, tags: EligibilityTags | undefined, farmer: FarmerFacts): SchemeMatch<T> | null {
  const t = tags ?? {};
  const fits: MatchReason[] = [];
  const unknown: MatchReason[] = [];
  let limited = false;

  const crops = limitList(t.crops, normalizeCrop);
  if (crops) {
    limited = true;
    const crop = normalizeCrop(farmer.crop);
    if (!crop) unknown.push('crop-unknown');
    else if (crops.has(crop)) fits.push('crop');
    else return null;
  }

  const districts = limitList(t.districts, normalizeDistrict);
  if (districts) {
    limited = true;
    const district = normalizeDistrict(farmer.district);
    if (!district) unknown.push('district-unknown');
    else if (districts.has(district)) fits.push('district');
    else return null;
  }

  const min = isLand(t.minLandDecimals) ? t.minLandDecimals : null;
  const max = isLand(t.maxLandDecimals) ? t.maxLandDecimals : null;
  if (min !== null || max !== null) {
    limited = true;
    const land = farmer.landDecimals;
    if (!isLand(land)) unknown.push('land-unknown');
    else if ((min === null || land >= min) && (max === null || land <= max)) fits.push('land');
    else return null;
  }

  const tenure = Array.isArray(t.tenure) ? t.tenure.filter((v) => TENURES.includes(v)) : [];
  // A scheme open to both owners and tenants does not limit anyone.
  if (tenure.length > 0 && !TENURES.every((v) => tenure.includes(v))) {
    limited = true;
    if (!farmer.tenure) unknown.push('tenure-unknown');
    else if (tenure.includes(farmer.tenure)) fits.push('tenure');
    else return null;
  }

  if (!limited) return { scheme, level: 'general', reasons: ['open-to-all'], tags: t };
  return {
    scheme,
    level: unknown.length > 0 ? 'possible' : 'strong',
    reasons: [...fits, ...unknown],
    tags: t,
  };
}

const LEVEL_RANK: Record<MatchLevel, number> = { strong: 0, possible: 1, general: 2 };

/**
 * The schemes for this farmer: those their tags rule out are left out, the
 * rest come strongest first, keeping the given order within a level.
 */
export function matchSchemes<T>(
  schemes: readonly T[],
  farmer: FarmerFacts,
  getTags: (scheme: T) => EligibilityTags | undefined = (s) => (s as { eligibilityTags?: EligibilityTags }).eligibilityTags,
): SchemeMatch<T>[] {
  return schemes
    .map((scheme, index) => ({ match: matchScheme(scheme, getTags(scheme), farmer), index }))
    .filter((x): x is { match: SchemeMatch<T>; index: number } => x.match !== null)
    .sort((a, b) => LEVEL_RANK[a.match.level] - LEVEL_RANK[b.match.level] || a.index - b.index)
    .map((x) => x.match);
}

const stringList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return list.length > 0 ? list : undefined;
};

/**
 * Tags read from an untrusted record (Firestore, AI output), keeping only
 * well-formed fields. Undefined when nothing usable is there.
 */
export function sanitizeEligibilityTags(raw: unknown): EligibilityTags | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: EligibilityTags = {};
  const crops = stringList(r.crops);
  if (crops) out.crops = crops;
  const districts = stringList(r.districts);
  if (districts) out.districts = districts;
  if (isLand(r.maxLandDecimals)) out.maxLandDecimals = r.maxLandDecimals;
  if (isLand(r.minLandDecimals)) out.minLandDecimals = r.minLandDecimals;
  if (Array.isArray(r.tenure)) {
    const tenure = TENURES.filter((v) => (r.tenure as unknown[]).includes(v));
    if (tenure.length > 0) out.tenure = tenure;
  }
  if (typeof r.provider === 'string' && (PROVIDERS as readonly string[]).includes(r.provider)) {
    out.provider = r.provider as SchemeProvider;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

interface SchemeLike {
  id?: unknown;
  eligibilityTags?: unknown;
  crops?: unknown;
  districts?: unknown;
}

/**
 * The tags to match a scheme with:
 * 1. its own `eligibilityTags`, when well-formed;
 * 2. else the tags of the seeded scheme with the same id (Firestore records
 *    saved before tags existed);
 * 3. else its older `crops` / `districts` lists, when they name a limit;
 * 4. else none: open to all.
 */
export function resolveEligibilityTags(
  scheme: SchemeLike,
  seedTagsById: Record<string, EligibilityTags> = {},
): EligibilityTags {
  const own = sanitizeEligibilityTags(scheme.eligibilityTags);
  if (own) return own;

  const id = typeof scheme.id === 'string' ? scheme.id.toLowerCase().trim() : '';
  if (id) {
    const seedKey = Object.keys(seedTagsById).find((k) => k.toLowerCase().trim() === id);
    if (seedKey) return seedTagsById[seedKey];
  }

  const legacy: EligibilityTags = {};
  const crops = stringList(scheme.crops);
  if (crops && limitList(crops, normalizeCrop)) legacy.crops = crops;
  const districts = stringList(scheme.districts);
  if (districts && limitList(districts, normalizeDistrict)) legacy.districts = districts;
  return legacy;
}

export type ProviderFilter = 'all' | SchemeProvider;

/** Keeps the items run by the chosen kind of provider. Untagged items show only under 'all'. */
export function filterByProvider<T>(
  items: readonly T[],
  filter: ProviderFilter,
  getTags: (item: T) => EligibilityTags | undefined,
): T[] {
  if (filter === 'all') return [...items];
  return items.filter((item) => getTags(item)?.provider === filter);
}
