/**
 * What every AI prompt should know about where and when the farmer is asking.
 *
 * Before this module each prompt built its own location line, usually a bare
 * pair of GPS numbers. A district name, the district's known climate risks and
 * the cropping season tell the model far more than coordinates do, and having
 * one builder keeps every tool's answer consistent.
 */
import { findNearestLocation } from './geoData';
import { getDistrictClimateRisks, type StressType } from './climateZones';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type BdSeasonKey = 'rabi' | 'kharif1' | 'kharif2';

export interface BdSeason {
  key: BdSeasonKey;
  name: string;
  nameBn: string;
  /** Plain description used in prompts. */
  description: string;
}

const SEASONS: Record<BdSeasonKey, BdSeason> = {
  rabi: {
    key: 'rabi',
    name: 'Rabi',
    nameBn: 'রবি',
    description: 'Rabi, the dry winter season (mid-October to mid-March)',
  },
  kharif1: {
    key: 'kharif1',
    name: 'Kharif-1',
    nameBn: 'খরিফ-১',
    description: 'Kharif-1, the hot pre-monsoon season (mid-March to mid-July)',
  },
  kharif2: {
    key: 'kharif2',
    name: 'Kharif-2',
    nameBn: 'খরিফ-২',
    description: 'Kharif-2, the monsoon season (mid-July to mid-October)',
  },
};

/** Month (1-12) and day of a date as seen in Bangladesh. */
const dhakaMonthDay = (date: Date): { month: number; day: number } => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    if (month && day) return { month, day };
  } catch {
    // Fall through to the device's own calendar.
  }
  return { month: date.getMonth() + 1, day: date.getDate() };
};

/**
 * Bangladesh's cropping season for a date: Rabi 16 Oct to 15 Mar, Kharif-1
 * 16 Mar to 15 Jul, Kharif-2 16 Jul to 15 Oct.
 */
export const seasonForDate = (date: Date = new Date()): BdSeason => {
  const { month, day } = dhakaMonthDay(date);
  const dayOfYear = month * 100 + day;
  if (dayOfYear >= 316 && dayOfYear <= 715) return SEASONS.kharif1;
  if (dayOfYear >= 716 && dayOfYear <= 1015) return SEASONS.kharif2;
  return SEASONS.rabi;
};

export interface FarmerPlace {
  district: string;
  districtBn: string;
  /** Only set when the nearest upazila has its own coordinates in the dataset. */
  upazila?: string;
  upazilaBn?: string;
  /** District-level risks, strongest first. Empty when the district has none mapped. */
  risks: StressType[];
}

/** The district (and upazila, when reliable) for a position inside Bangladesh. */
export const describePlace = (coords: Coordinates | null | undefined): FarmerPlace | null => {
  if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return null;
  const nearest = findNearestLocation(coords.latitude, coords.longitude, 'en');
  if (!nearest.isWithinBangladesh) return null;

  const { district, upazila } = nearest;
  // Many upazila entries copy their district's coordinates, so the "nearest"
  // one is then only the first in the list. Trust it only when it has its own.
  const upazilaIsDistinct =
    !!upazila &&
    (Math.abs(upazila.lat - district.lat) > 0.001 || Math.abs(upazila.lng - district.lng) > 0.001);

  return {
    district: district.name,
    districtBn: district.bn_name,
    upazila: upazilaIsDistinct ? upazila!.name : undefined,
    upazilaBn: upazilaIsDistinct ? upazila!.bn_name : undefined,
    risks: getDistrictClimateRisks(district.name),
  };
};

const RISK_LABEL: Record<StressType, string> = {
  salinity: 'soil and water salinity',
  flood: 'flooding',
  drought: 'drought',
  cold: 'winter cold waves',
};

export interface LocationContextOptions {
  /** Leave the season line out for prompts that already state the date their own way. */
  includeSeason?: boolean;
  date?: Date;
}

/**
 * The location and season lines for a prompt. With no usable position it says
 * so plainly, so the model gives general Bangladesh advice instead of guessing
 * a place.
 */
export const buildLocationContext = (
  coords: Coordinates | null | undefined,
  options: LocationContextOptions = {}
): string => {
  const { includeSeason = true, date = new Date() } = options;
  const lines: string[] = [];
  const place = describePlace(coords);

  if (place && coords) {
    const where = place.upazila
      ? `${place.upazila} upazila, ${place.district} district`
      : `${place.district} district`;
    lines.push(
      `Location: ${where}, Bangladesh (GPS ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}).`
    );
    if (place.risks.length > 0) {
      lines.push(
        `Known climate risks in this district: ${place.risks.map((r) => RISK_LABEL[r]).join(', ')}. ` +
          `These are district-wide; they may not apply to this particular field.`
      );
    }
  } else {
    lines.push('Location: Bangladesh (exact area not known; give advice that holds across the country).');
  }

  if (includeSeason) {
    lines.push(`Cropping season now: ${seasonForDate(date).description}.`);
  }
  return lines.join('\n');
};
