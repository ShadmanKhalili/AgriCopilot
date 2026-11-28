/**
 * Reads the app's full place, crop and disease data and reduces it to the
 * small lists the area-report server needs. Used by gen-area-catalog.ts to
 * write the file, and by the catalog test to check the file is up to date.
 */

import { geoData } from '../src/utils/geoData.ts';
import { listDiseaseEntries } from '../src/utils/diseaseKey.ts';
import { LOCAL_PRICE_CROPS } from '../src/utils/localPriceCrops.ts';
import { cropNameFromSlug } from '../src/utils/areaWarningText.ts';
import { keySlug, slug } from '../netlify/functions/_shared/area-model.ts';

export interface AreaCatalog {
  /** District slug -> its upazila slugs (sorted). */
  places: Record<string, string[]>;
  /** Crop slug (as used in problem reports) -> display names. */
  crops: Record<string, { bn: string; en: string }>;
  /** Crop slugs a farmer may report a sale price for. */
  priceCrops: string[];
  /** keySlug(disease key) -> the real key and display names. */
  diseases: Record<string, { key: string; crop: string; bn: string; en: string }>;
}

const sortedObject = <T>(entries: Array<[string, T]>): Record<string, T> =>
  Object.fromEntries(entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));

export const buildAreaCatalog = (): AreaCatalog => {
  const places: Record<string, Set<string>> = {};
  for (const district of geoData) {
    const d = slug(district.name);
    if (!d) continue;
    places[d] ??= new Set();
    for (const upazila of district.upazilas) {
      const u = slug(upazila.name);
      if (u) places[d].add(u);
    }
  }

  const crops: AreaCatalog['crops'] = {};
  const diseases: AreaCatalog['diseases'] = {};
  for (const entry of listDiseaseEntries()) {
    const crop = slug(entry.cropId);
    crops[crop] ??= { bn: cropNameFromSlug(crop, 'bn'), en: cropNameFromSlug(crop, 'en') };
    diseases[keySlug(entry.key)] = { key: entry.key, crop, bn: entry.diseaseBn, en: entry.disease };
  }

  return {
    places: sortedObject(Object.entries(places).map(([d, set]) => [d, [...set].sort()] as [string, string[]])),
    crops: sortedObject(Object.entries(crops)),
    priceCrops: [...new Set(Object.values(LOCAL_PRICE_CROPS).map((value) => slug(value)))].sort(),
    diseases: sortedObject(Object.entries(diseases)),
  };
};

/** The source text of netlify/functions/_shared/area-catalog.ts. */
export const renderAreaCatalogSource = (catalog: AreaCatalog): string => {
  const line = (value: unknown) => JSON.stringify(value);
  const lines = (record: Record<string, unknown>) =>
    Object.entries(record)
      .map(([key, value]) => `  ${line(key)}: ${line(value)},`)
      .join('\n');
  return `/**
 * GENERATED FILE. Do not edit by hand: run \`npx tsx scripts/gen-area-catalog.ts\`.
 *
 * The places, crops and diseases the area-report server accepts, reduced from
 * src/utils/geoData.ts, src/data/diseaseKb.ts and src/utils/localPriceCrops.ts
 * so the function stays small. A test fails when this file is out of date.
 */

/** District slug -> its upazila slugs. */
export const AREA_PLACES: Record<string, string[]> = {
${lines(catalog.places)}
};

/** Crop slug (problem reports) -> display names. */
export const AREA_CROPS: Record<string, { bn: string; en: string }> = {
${lines(catalog.crops)}
};

/** Crop slugs a farmer may report a sale price for. */
export const AREA_PRICE_CROPS: string[] = ${line(catalog.priceCrops)};

/** keySlug(disease key) -> the real key and display names. */
export const AREA_DISEASES: Record<string, { key: string; crop: string; bn: string; en: string }> = {
${lines(catalog.diseases)}
};
`;
};
