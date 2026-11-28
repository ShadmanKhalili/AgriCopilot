/**
 * Builds netlify/functions/_shared/area-catalog.ts: the compact lists the
 * area-report server checks every report against (places, crops, diseases),
 * so the function does not have to bundle the full geo data or disease
 * knowledge base.
 *
 * Run from the project root after changing src/utils/geoData.ts,
 * src/data/diseaseKb.ts or src/utils/localPriceCrops.ts:
 *
 *   npx tsx scripts/gen-area-catalog.ts
 *
 * A unit test (netlify/functions/_shared/area-catalog.test.ts) fails when the
 * generated file is out of date.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAreaCatalog, renderAreaCatalogSource } from './area-catalog-build.ts';

const out = fileURLToPath(new URL('../netlify/functions/_shared/area-catalog.ts', import.meta.url));
writeFileSync(out, renderAreaCatalogSource(buildAreaCatalog()), 'utf8');
console.log(`Wrote ${out}`);
