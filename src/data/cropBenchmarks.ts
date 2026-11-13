/**
 * Typical per-bigha costs, yields and prices for the profit calculator.
 *
 * These are rough typical figures for Bangladesh, not measurements of any one
 * farm and not today's market price. The screens must call them "typical"
 * and let the farmer replace them with their own numbers.
 */

export interface CropBenchmark {
  nameBn: string;
  nameEn: string;
  /** Short name for big buttons. */
  shortBn: string;
  shortEn: string;
  emoji: string;
  /** Typical harvest, mon (40 kg) per decimal (e.g. 0.65 mon/decimal = ~21 mon/bigha for boro). */
  defaultYieldPerDecimalMon: number;
  /** Typical farm price, BDT per mon (40 kg). Not a live market price. */
  defaultPricePerMon: number;
  /** Typical costs in BDT per bigha (33 decimals). */
  perBighaCosts: {
    tillage: number;
    seeds: number;
    fertilizer: number;
    irrigation: number;
    pesticide: number;
    labor: number;
    transport: number;
  };
}

export type CostItemKey = keyof CropBenchmark['perBighaCosts'];

export const COST_ITEM_KEYS: CostItemKey[] = [
  'tillage',
  'seeds',
  'fertilizer',
  'irrigation',
  'pesticide',
  'labor',
  'transport',
];

export const CROP_BENCHMARKS: Record<string, CropBenchmark> = {
  paddy_boro: {
    nameBn: 'বোরো ধান (উফশী/হাইব্রিড)',
    nameEn: 'Boro Rice (HYV/Hybrid)',
    shortBn: 'বোরো ধান',
    shortEn: 'Boro rice',
    emoji: '🌾',
    defaultYieldPerDecimalMon: 0.65, // ~21.5 Mon per Bigha
    defaultPricePerMon: 1150,
    perBighaCosts: {
      tillage: 2200,
      seeds: 1200,
      fertilizer: 4800,
      irrigation: 5500,
      pesticide: 1800,
      labor: 9000,
      transport: 1200,
    },
  },
  paddy_aman: {
    nameBn: 'রোপা আমন ধান',
    nameEn: 'T. Aman Rice',
    shortBn: 'আমন ধান',
    shortEn: 'Aman rice',
    emoji: '🌱',
    defaultYieldPerDecimalMon: 0.48, // ~16 Mon per Bigha
    defaultPricePerMon: 1250,
    perBighaCosts: {
      tillage: 2000,
      seeds: 1000,
      fertilizer: 3600,
      irrigation: 1800, // Rainfed mostly
      pesticide: 1500,
      labor: 7500,
      transport: 1000,
    },
  },
  potato: {
    nameBn: 'আলু (ডায়মন্ড/কার্ডিনাল)',
    nameEn: 'Potato (Diamond/Cardinal)',
    shortBn: 'আলু',
    shortEn: 'Potato',
    emoji: '🥔',
    defaultYieldPerDecimalMon: 2.2, // ~72 Mon per Bigha
    defaultPricePerMon: 850,
    perBighaCosts: {
      tillage: 2800,
      seeds: 16000, // Seed potato is costly
      fertilizer: 8500,
      irrigation: 4000,
      pesticide: 4500, // Blight fungicides
      labor: 11000,
      transport: 3500,
    },
  },
  tomato: {
    nameBn: 'টমেটো (শীতকালীন / গ্রীষ্মকালীন)',
    nameEn: 'Tomato (Hybrid)',
    shortBn: 'টমেটো',
    shortEn: 'Tomato',
    emoji: '🍅',
    defaultYieldPerDecimalMon: 2.5, // ~80 Mon per Bigha
    defaultPricePerMon: 1100,
    perBighaCosts: {
      tillage: 2500,
      seeds: 3500,
      fertilizer: 6500,
      irrigation: 3500,
      pesticide: 5000,
      labor: 12000,
      transport: 3000,
    },
  },
  onion: {
    nameBn: 'পেঁয়াজ (তাহেরপুরী / বারি)',
    nameEn: 'Onion (Taherpuri/BARI)',
    shortBn: 'পেঁয়াজ',
    shortEn: 'Onion',
    emoji: '🧅',
    defaultYieldPerDecimalMon: 1.3, // ~43 Mon per Bigha
    defaultPricePerMon: 1800,
    perBighaCosts: {
      tillage: 2600,
      seeds: 5500,
      fertilizer: 5800,
      irrigation: 3000,
      pesticide: 3200,
      labor: 10500,
      transport: 2200,
    },
  },
  brinjal: {
    nameBn: 'বেগুন (বারি / হাইব্রিড)',
    nameEn: 'Brinjal / Eggplant',
    shortBn: 'বেগুন',
    shortEn: 'Brinjal',
    emoji: '🍆',
    defaultYieldPerDecimalMon: 2.0, // ~66 Mon per Bigha
    defaultPricePerMon: 1200,
    perBighaCosts: {
      tillage: 2200,
      seeds: 2000,
      fertilizer: 5500,
      irrigation: 3500,
      pesticide: 6000, // Fruit and shoot borer
      labor: 11000,
      transport: 2500,
    },
  },
  chili: {
    nameBn: 'কাঁচা মরিচ',
    nameEn: 'Green Chili',
    shortBn: 'মরিচ',
    shortEn: 'Chilli',
    emoji: '🌶️',
    defaultYieldPerDecimalMon: 0.9, // ~30 Mon per Bigha
    defaultPricePerMon: 3000,
    perBighaCosts: {
      tillage: 2200,
      seeds: 2500,
      fertilizer: 5200,
      irrigation: 3200,
      pesticide: 4500,
      labor: 13000, // Multiple manual pickings
      transport: 2000,
    },
  },
  maize: {
    nameBn: 'ভুট্টা (হাইব্রিড)',
    nameEn: 'Hybrid Maize',
    shortBn: 'ভুট্টা',
    shortEn: 'Maize',
    emoji: '🌽',
    defaultYieldPerDecimalMon: 1.1, // ~36 Mon per Bigha
    defaultPricePerMon: 1050,
    perBighaCosts: {
      tillage: 2400,
      seeds: 3000,
      fertilizer: 6200,
      irrigation: 4000,
      pesticide: 1800,
      labor: 7500,
      transport: 1800,
    },
  },
};
