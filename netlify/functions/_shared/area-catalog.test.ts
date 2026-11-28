import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AREA_CROPS, AREA_DISEASES, AREA_PLACES, AREA_PRICE_CROPS } from './area-catalog.ts';
import { buildAreaCatalog, renderAreaCatalogSource } from '../../../scripts/area-catalog-build.ts';
import { keySlug } from './area-model.ts';

describe('area-catalog.ts', () => {
  it('is up to date with geoData, the disease knowledge base and the price crops', () => {
    // If this fails, run: npx tsx scripts/gen-area-catalog.ts
    const file = readFileSync(fileURLToPath(new URL('./area-catalog.ts', import.meta.url)), 'utf8');
    expect(file.replace(/\r\n/g, '\n')).toBe(renderAreaCatalogSource(buildAreaCatalog()));
  });

  it('holds every district with at least one upazila, and stays small', () => {
    expect(Object.keys(AREA_PLACES).length).toBeGreaterThanOrEqual(60);
    for (const list of Object.values(AREA_PLACES)) expect(list.length).toBeGreaterThan(0);
    expect(AREA_PLACES.pabna).toContain('ishurdi');
    const size = readFileSync(fileURLToPath(new URL('./area-catalog.ts', import.meta.url))).length;
    expect(size).toBeLessThan(40_000);
  });

  it('maps every disease to a known crop, with both names, under its own slug', () => {
    for (const [slug, disease] of Object.entries(AREA_DISEASES)) {
      expect(keySlug(disease.key)).toBe(slug);
      expect(Object.keys(AREA_CROPS)).toContain(disease.crop);
      expect(disease.key.startsWith(`${disease.crop.replace(/_/g, '-')}:`)).toBe(true);
      expect(disease.en.length).toBeGreaterThan(2);
      expect(disease.bn).toMatch(/[ঀ-৿]/);
    }
  });

  it('gives every crop a Bangla and an English name, and price crops are known crops', () => {
    for (const names of Object.values(AREA_CROPS)) {
      expect(names.bn).toMatch(/[ঀ-৿]/);
      expect(names.en).toMatch(/^[a-z ]+$/);
    }
    for (const crop of AREA_PRICE_CROPS) expect(Object.keys(AREA_CROPS)).toContain(crop);
  });
});
