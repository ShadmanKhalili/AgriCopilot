/**
 * District-level climate risk profiles for the crop resilience guide.
 *
 * These are coarse agro-ecological groupings, not a soil test. A district can
 * legitimately face more than one stress (for example, coastal districts face
 * salinity and tidal/storm-surge flooding), so the order below is a priority
 * order: the first entry is the dominant risk shown first in the guide.
 *
 * Deliberately conservative: a district only appears for a risk where that
 * risk is a recognised concern for its farming areas. Unknown districts return
 * an empty list and the UI falls back to showing all varieties with an honest
 * "no district mapping" note.
 */

export type StressType = 'flood' | 'salinity' | 'drought' | 'cold';

const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, '');

// Coastal salinity belt (south-west, south-central and south-east coast).
const SALINE_DISTRICTS = new Set([
  'satkhira',
  'khulna',
  'bagerhat',
  'barguna',
  'patuakhali',
  'bhola',
  'pirojpur',
  'jhalokati',
  'barishal',
  'noakhali',
  'lakshmipur',
  'feni',
  'chattogram',
  'coxsbazar',
  'chandpur',
]);

// Riverine / haor / char / coastal flood-prone districts.
const FLOOD_DISTRICTS = new Set([
  // Haor and north-east
  'sylhet',
  'sunamganj',
  'habiganj',
  'moulvibazar',
  'netrokona',
  'kishoreganj',
  // Jamuna / Brahmaputra chars and floodplain
  'kurigram',
  'gaibandha',
  'sirajganj',
  'jamalpur',
  'tangail',
  'manikganj',
  'munshiganj',
  'faridpur',
  'madaripur',
  'shariatpur',
  'gopalganj',
  'rajbari',
  'bogura',
  'pabna',
  'kushtia',
  // Northern flash-flood pockets
  'lalmonirhat',
  'nilphamari',
  'dinajpur',
  // Coastal tidal / storm-surge flooding
  'satkhira',
  'khulna',
  'bagerhat',
  'barguna',
  'patuakhali',
  'bhola',
  'pirojpur',
  'jhalokati',
  'barishal',
  'noakhali',
  'lakshmipur',
  'feni',
  'chattogram',
  'coxsbazar',
]);

// Barind and western drought-prone districts.
const DROUGHT_DISTRICTS = new Set([
  'rajshahi',
  'chapainawabganj',
  'naogaon',
  'natore',
  'pabna',
  'bogura',
  'joypurhat',
  'dinajpur',
  'rangpur',
  'thakurgaon',
  'panchagarh',
  'kushtia',
  'meherpur',
  'chuadanga',
  'jhenaidah',
  'magura',
  'jashore',
]);

// North-western winter cold-wave belt.
const COLD_DISTRICTS = new Set([
  'panchagarh',
  'thakurgaon',
  'dinajpur',
  'nilphamari',
  'lalmonirhat',
  'rangpur',
  'kurigram',
  'gaibandha',
  'joypurhat',
  'naogaon',
  'chapainawabganj',
  'rajshahi',
  'bogura',
  'sirajganj',
]);

/**
 * Returns the relevant stresses for a district, strongest first.
 * Empty array means "no district-specific mapping".
 */
export function getDistrictClimateRisks(districtName: string): StressType[] {
  const key = normalize(districtName || '');
  if (!key) return [];

  const risks: StressType[] = [];

  if (SALINE_DISTRICTS.has(key)) {
    // The coast is defined by salinity first; tidal/storm-surge flooding is
    // a real secondary risk in the same fields.
    risks.push('salinity');
    if (FLOOD_DISTRICTS.has(key)) risks.push('flood');
  } else if (DROUGHT_DISTRICTS.has(key)) {
    // Barind/western districts lead with drought; river flood pockets are
    // secondary where present.
    risks.push('drought');
    if (FLOOD_DISTRICTS.has(key)) risks.push('flood');
  } else if (FLOOD_DISTRICTS.has(key)) {
    risks.push('flood');
  }

  if (COLD_DISTRICTS.has(key)) risks.push('cold');

  return risks;
}
