/**
 * Crop calendars: fixed stage schedules, in days after sowing / transplanting.
 *
 * All schedules are general guidance pending agronomist review. Real timing
 * varies by variety, season, district and weather.
 *
 * Original entries (unchanged): paddy, potato, tomato, onion.
 * Added later from general BARI / BRRI / DAE practice (need review):
 *   brinjal, chili, maize, mustard, jute.
 */

export interface StageEvent {
  day: number;
  stageNameBn: string;
  stageNameEn: string;
  actionBn: string;
  actionEn: string;
  waterNeed: 'High' | 'Medium' | 'Low';
  riskBn: string;
  riskEn: string;
  type: 'fertilizer' | 'irrigation' | 'pesticide' | 'harvest';
}

export interface CropScheduleConfig {
  nameBn: string;
  nameEn: string;
  durationDays: number;
  stages: StageEvent[];
}

export const CROP_SCHEDULES: Record<string, CropScheduleConfig> = {
  'paddy': {
    nameBn: 'ধান (বোরো / আমন)',
    nameEn: 'Paddy / Rice',
    durationDays: 120,
    stages: [
      {
        day: 1,
        stageNameBn: 'চারা রোপণ / বীজতলা',
        stageNameEn: 'Transplanting / Nursery',
        actionBn: 'জমি তৈরিতে টিএসপি, এমপি ও জিপসাম প্রয়োগ। ২-৩ সেমি পানি বজায় রাখুন।',
        actionEn: 'Apply basal TSP, MOP & Gypsum during land prep. Maintain 2-3cm water.',
        waterNeed: 'High',
        riskBn: 'চারা শুকিয়ে যাওয়া রোধে হালকা সেচ দিন।',
        riskEn: 'Avoid moisture stress during root anchoring.',
        type: 'fertilizer'
      },
      {
        day: 15,
        stageNameBn: 'কুশি গজানো (Tillering)',
        stageNameEn: 'Early Tillering Stage',
        actionBn: 'ইউরিয়ার প্রথম কিস্তি (১/৩ অংশ) ও আগাছা দমন করুন।',
        actionEn: 'Apply 1st top-dressing of Urea (1/3rd dose) and mechanical weeding.',
        waterNeed: 'Medium',
        riskBn: 'মাজরা পোকা ও পাতা মোড়ানো পোকার আক্রমণ নজরদারি করুন।',
        riskEn: 'Scout for Stem Borer and Leaf Folder pests.',
        type: 'fertilizer'
      },
      {
        day: 40,
        stageNameBn: 'সর্বোচ্চ কুশি ও থোড় অবস্থা',
        stageNameEn: 'Panicle Initiation Stage',
        actionBn: 'ইউরিয়ার দ্বিতীয় কিস্তি ও পটাশ সার দিন। জমিতে ৫-৭ সেমি পানি রাখুন।',
        actionEn: 'Apply 2nd Urea top-dressing + Potassium. Maintain 5-7cm standing water.',
        waterNeed: 'High',
        riskBn: 'ব্লাস্ট ও খোলপোড়া রোগ প্রতিরোধে ট্রাইসাইক্লাজল বা হেক্সাকোনাজল স্প্রে।',
        riskEn: 'Preventive Tricyclazole/Hexaconazole spray for Neck Blast & Sheath Blight.',
        type: 'pesticide'
      },
      {
        day: 75,
        stageNameBn: 'ফুল ফোটা ও দুধ অবস্থা',
        stageNameEn: 'Flowering & Milking',
        actionBn: 'পানির স্তর বজায় রাখুন। কোনো রাসায়নিক স্প্রে সকালে করবেন না।',
        actionEn: 'Maintain adequate moisture. Avoid early-morning chemical sprays during anthesis.',
        waterNeed: 'High',
        riskBn: 'গান্ধী পোকা ও বাদামী গাছফড়িং (BPH) পর্যবেক্ষণ করুন।',
        riskEn: 'Scout plant base for Brown Plant Hopper (BPH).',
        type: 'irrigation'
      },
      {
        day: 110,
        stageNameBn: 'দানা পাকা ও ফসল কর্তন',
        stageNameEn: 'Maturity & Harvesting',
        actionBn: 'কাটার ১০-১২ দিন আগে জমির পানি নামিয়ে দিন। ৮০% শিষ সোনালী হলে কাটুন।',
        actionEn: 'Drain water 10-12 days before harvest. Cut when 80% grains turn golden.',
        waterNeed: 'Low',
        riskBn: 'বৃষ্টির পূর্বাভাস থাকলে দ্রুত ফসল কেটে মাড়াই করুন।',
        riskEn: 'Check monsoon forecast and expedite harvesting.',
        type: 'harvest'
      }
    ]
  },
  'potato': {
    nameBn: 'আলু',
    nameEn: 'Potato',
    durationDays: 90,
    stages: [
      {
        day: 1,
        stageNameBn: 'বীজ রোপণ',
        stageNameEn: 'Seed Tuber Sowing',
        actionBn: 'সুষম সার সহ বেড তৈরি ও শোধিত বীজ আলু রোপণ।',
        actionEn: 'Prepare raised furrows with balanced base manure & treated seed tubers.',
        waterNeed: 'Low',
        riskBn: 'বীজ পচা রোধে কার্বেনডাজিম দিয়ে শোধন করুন।',
        riskEn: 'Carbendazim seed dip to stop fungal rot.',
        type: 'fertilizer'
      },
      {
        day: 25,
        stageNameBn: 'গাছ বৃদ্ধি ও প্রথম গোড়া বাঁধা',
        stageNameEn: 'Vegetative & Earthing Up',
        actionBn: 'ইউরিয়া উপরিপ্রয়োগ ও প্রথম সেচ দিয়ে গাছের গোড়ায় মাটি তুলুন।',
        actionEn: 'First irrigation, top-dress Urea, and hill up soil around roots.',
        waterNeed: 'Medium',
        riskBn: 'কাটুই পোকার উপস্থিতি পর্যবেক্ষণ করুন।',
        riskEn: 'Check for cutworms in soil bed.',
        type: 'irrigation'
      },
      {
        day: 50,
        stageNameBn: 'আলু ধরা (Tuber Bulking)',
        stageNameEn: 'Tuber Bulking Stage',
        actionBn: 'দ্বিতীয় সেচ ও বোরন/পটাশ স্প্রে যাতে আলুর আকার বড় হয়।',
        actionEn: 'Second irrigation and foliar Potassium/Boron for uniform tuber sizing.',
        waterNeed: 'High',
        riskBn: 'কুয়াশাচ্ছন্ন আবহাওয়ায় লেট ব্লাইট (নাবি ধসা) প্রতিরোধে ম্যানকোজেব স্প্রে।',
        riskEn: 'High Late Blight risk during dense fog; apply prophylactic Mancozeb/Cymoxanil.',
        type: 'pesticide'
      },
      {
        day: 80,
        stageNameBn: 'গাছ উপড়ানো (De-haulming)',
        stageNameEn: 'De-haulming & Curing',
        actionBn: 'তোলার ১০ দিন আগে গাছের ডালপালা কেটে ফেলুন যাতে আলুর ত্বক শক্ত হয়।',
        actionEn: 'Cut stems 10 days before harvesting to allow skin curing.',
        waterNeed: 'Low',
        riskBn: 'মাটি অতিরিক্ত ভেজা অবস্থায় আলু তুলবেন না।',
        riskEn: 'Avoid lifting in waterlogged soil to prevent rotting.',
        type: 'harvest'
      }
    ]
  },
  'tomato': {
    nameBn: 'টমেটো',
    nameEn: 'Tomato',
    durationDays: 100,
    stages: [
      {
        day: 1,
        stageNameBn: 'চারা রোপণ',
        stageNameEn: 'Seedling Transplanting',
        actionBn: 'বেডে চারা রোপণ ও সাথে সাথে গোড়ায় হালকা সেচ দিন।',
        actionEn: 'Transplant 25-day seedlings into raised beds and give starter irrigation.',
        waterNeed: 'Medium',
        riskBn: 'ঢলে পড়া (Damping off) প্রতিরোধ।',
        riskEn: 'Damping off prevention.',
        type: 'irrigation'
      },
      {
        day: 20,
        stageNameBn: 'খুঁটি দেওয়া ও ডাল ছাঁটাই',
        stageNameEn: 'Staking & Trellising',
        actionBn: 'বাঁশের খুঁটি দিয়ে গাছ বেঁধে দিন এবং নিচের অপ্রয়োজনীয় শাখা ছাঁটুন।',
        actionEn: 'Tie plants to bamboo stakes and prune lower ground-touching suckers.',
        waterNeed: 'Medium',
        riskBn: 'সাদা মাছি (Whitefly) ও লিফ কার্ল ভাইরাস প্রতিরোধ।',
        riskEn: 'Monitor Whiteflies to stop Tomato Leaf Curl Virus.',
        type: 'pesticide'
      },
      {
        day: 45,
        stageNameBn: 'ফুল ও ফল ধরা',
        stageNameEn: 'Flowering & Fruit Set',
        actionBn: 'নিয়মিত ড্রিপ/হালকা সেচ এবং ক্যালসিয়াম ও বোরন স্প্রে (ফল ফাটা রোধে)।',
        actionEn: 'Regular uniform watering + Foliar Calcium & Boron to prevent fruit cracking.',
        waterNeed: 'High',
        riskBn: 'ফল ছিদ্রকারী পোকা ও আর্লি ব্লাইট প্রতিরোধ।',
        riskEn: 'Fruit Borer (Helicoverpa) and Early Blight scout.',
        type: 'fertilizer'
      },
      {
        day: 75,
        stageNameBn: 'ফল সংগ্রহ',
        stageNameEn: 'Harvesting Cycles',
        actionBn: 'রঙ হালকা গোলাপী বা লালচে হলে নিয়মিত বিরতিতে ফল তুলুন।',
        actionEn: 'Harvest at breaker/pink stage every 3-4 days for maximum market shelf-life.',
        waterNeed: 'Medium',
        riskBn: 'স্প্রে করার পর প্রি-হার্ভেস্ট ইন্টারভাল (PHI) মেনে চলুন।',
        riskEn: 'Respect PHI pesticide safety withholding period.',
        type: 'harvest'
      }
    ]
  },
  'onion': {
    nameBn: 'পেঁয়াজ',
    nameEn: 'Onion',
    durationDays: 90,
    stages: [
      {
        day: 1,
        stageNameBn: 'চারা / কন্দ রোপণ',
        stageNameEn: 'Planting / Transplanting',
        actionBn: 'সারি করে রোপণ ও প্রথম হালকা প্লাবন সেচ।',
        actionEn: 'Plant seedlings/sets in lines with light furrow irrigation.',
        waterNeed: 'Medium',
        riskBn: 'শিকড় পচা প্রতিরোধ।',
        riskEn: 'Root rot prevention.',
        type: 'irrigation'
      },
      {
        day: 30,
        stageNameBn: 'পাতা বৃদ্ধি ও আগাছা দমন',
        stageNameEn: 'Foliage Growth & Weeding',
        actionBn: 'নিড়ানি দিয়ে মাটি আলগা করা ও সালফার সার প্রয়োগ।',
        actionEn: 'Weed carefully and apply Sulphur for pungent quality & bulb firmness.',
        waterNeed: 'Medium',
        riskBn: 'থ্রিপস পোকা (পাতা রূপালী হয়ে যাওয়া) দমন।',
        riskEn: 'Scout for Onion Thrips causing silvery leaf patches.',
        type: 'pesticide'
      },
      {
        day: 60,
        stageNameBn: 'কন্দ বৃদ্ধি (Bulb Formation)',
        stageNameEn: 'Bulb Swelling Stage',
        actionBn: 'মাটিতে পরিমিত রস বজায় রাখুন। কন্দের উপর অতিরিক্ত মাটি সরাবেন না।',
        actionEn: 'Keep soil consistently moist but never waterlogged.',
        waterNeed: 'High',
        riskBn: 'পার্পল ব্লচ (বেগুনি দাগ) রোগ প্রতিরোধে ইপ্রোডিয়ন/ম্যানকোজেব স্প্রে।',
        riskEn: 'Purple Blotch fungal alert; spray Iprodione or Mancozeb.',
        type: 'pesticide'
      },
      {
        day: 85,
        stageNameBn: 'পাতা ভেঙে পড়া ও পরিপক্কতা',
        stageNameEn: 'Neck Fall & Curing',
        actionBn: '৫০-৭০% পাতা হেলে পড়লে সেচ বন্ধ করুন এবং তোলার পর ছায়ায় শুকান।',
        actionEn: 'Stop irrigation when 50-70% tops fall. Cure under shade for 7-10 days.',
        waterNeed: 'Low',
        riskBn: 'কাঁচা পেঁয়াজ গুদামে রাখবেন না।',
        riskEn: 'Ensure complete curing to avoid storage rot.',
        type: 'harvest'
      }
    ]
  },
  // ---- Added crops (general guidance, pending agronomist review) ----
  'brinjal': {
    nameBn: 'বেগুন',
    nameEn: 'Brinjal (Eggplant)',
    durationDays: 150,
    stages: [
      {
        day: 1,
        stageNameBn: 'চারা রোপণ',
        stageNameEn: 'Seedling Transplanting',
        actionBn: 'জমি তৈরিতে জৈব সার, টিএসপি ও এমওপি দিন। ২৫-৩০ দিনের সুস্থ চারা রোপণ করে হালকা সেচ দিন।',
        actionEn: 'Apply organic manure, TSP and MOP in land prep. Transplant healthy 25-30 day seedlings and irrigate lightly.',
        waterNeed: 'Medium',
        riskBn: 'গোড়া পচা ও কাটুই পোকা থেকে চারা রক্ষা করুন।',
        riskEn: 'Protect young plants from collar rot and cutworms.',
        type: 'irrigation'
      },
      {
        day: 25,
        stageNameBn: 'গাছ বৃদ্ধি ও আগাছা দমন',
        stageNameEn: 'Vegetative Growth & Weeding',
        actionBn: 'নিড়ানি দিন, ইউরিয়ার প্রথম কিস্তি দিয়ে গোড়ায় মাটি তুলুন এবং সেচ দিন।',
        actionEn: 'Weed, apply the 1st Urea top-dressing, earth up around the base and irrigate.',
        waterNeed: 'Medium',
        riskBn: 'জাব পোকা ও জ্যাসিড পোকা পর্যবেক্ষণ করুন।',
        riskEn: 'Scout for aphids and jassids.',
        type: 'fertilizer'
      },
      {
        day: 50,
        stageNameBn: 'ফুল ও ফল ধরা',
        stageNameEn: 'Flowering & Fruit Set',
        actionBn: 'ইউরিয়া ও পটাশের দ্বিতীয় কিস্তি দিন এবং নিয়মিত সেচ দিন। ডগা ও ফল ছিদ্রকারী পোকায় আক্রান্ত ডগা কেটে নষ্ট করুন।',
        actionEn: 'Apply the 2nd Urea and Potash dose and irrigate regularly. Cut and destroy shoots attacked by Shoot & Fruit Borer.',
        waterNeed: 'High',
        riskBn: 'ডগা ও ফল ছিদ্রকারী পোকার আক্রমণ সবচেয়ে বেশি; ফেরোমন ফাঁদ ব্যবহার করুন।',
        riskEn: 'Shoot & Fruit Borer is the main threat; use pheromone traps.',
        type: 'pesticide'
      },
      {
        day: 70,
        stageNameBn: 'ফল সংগ্রহ শুরু',
        stageNameEn: 'Harvest Begins',
        actionBn: 'ফল চকচকে ও কচি থাকতে ৪-৫ দিন পরপর তুলুন। প্রতি তোলার পর সেচ ও তৃতীয় কিস্তি সার দিন।',
        actionEn: 'Pick glossy, tender fruits every 4-5 days. Irrigate and give the 3rd fertiliser dose after pickings.',
        waterNeed: 'High',
        riskBn: 'স্প্রে করার পর নিরাপদ অপেক্ষার সময় মেনে ফল তুলুন।',
        riskEn: 'Respect the pesticide waiting period before picking.',
        type: 'harvest'
      }
    ]
  },
  'chili': {
    nameBn: 'মরিচ',
    nameEn: 'Chilli',
    durationDays: 150,
    stages: [
      {
        day: 1,
        stageNameBn: 'চারা রোপণ',
        stageNameEn: 'Seedling Transplanting',
        actionBn: 'জৈব সার, টিএসপি ও এমওপি দিয়ে জমি তৈরি করে ৩০-৩৫ দিনের চারা রোপণ ও হালকা সেচ দিন।',
        actionEn: 'Prepare land with organic manure, TSP and MOP. Transplant 30-35 day seedlings and irrigate lightly.',
        waterNeed: 'Medium',
        riskBn: 'চারা ঢলে পড়া ও গোড়া পচা রোধে জমিতে পানি জমতে দেবেন না।',
        riskEn: 'Do not let water stand; it causes damping off and collar rot.',
        type: 'irrigation'
      },
      {
        day: 25,
        stageNameBn: 'আগাছা দমন ও প্রথম উপরিপ্রয়োগ',
        stageNameEn: 'Weeding & 1st Top-dressing',
        actionBn: 'নিড়ানি দিয়ে আগাছা তুলুন, ইউরিয়ার প্রথম কিস্তি দিয়ে গোড়ায় মাটি তুলুন।',
        actionEn: 'Weed, apply the 1st Urea top-dressing and earth up around the base.',
        waterNeed: 'Medium',
        riskBn: 'থ্রিপস, মাকড় ও জাব পোকা পর্যবেক্ষণ করুন; পাতা কুঁকড়ে গেলে সতর্ক হোন।',
        riskEn: 'Scout for thrips, mites and aphids; curling leaves are a warning sign.',
        type: 'fertilizer'
      },
      {
        day: 50,
        stageNameBn: 'ফুল ও ফল ধরা',
        stageNameEn: 'Flowering & Fruit Set',
        actionBn: 'ইউরিয়া ও পটাশের দ্বিতীয় কিস্তি দিন এবং ১০-১৫ দিন পরপর হালকা সেচ দিন।',
        actionEn: 'Apply the 2nd Urea and Potash dose and irrigate lightly every 10-15 days.',
        waterNeed: 'High',
        riskBn: 'এনথ্রাকনোজ (ফল পচা) ও পাতা কোঁকড়ানো ভাইরাস নজরে রাখুন।',
        riskEn: 'Watch for Anthracnose (fruit rot) and leaf curl virus.',
        type: 'pesticide'
      },
      {
        day: 80,
        stageNameBn: 'সবুজ / পাকা মরিচ সংগ্রহ',
        stageNameEn: 'Green / Ripe Chilli Harvest',
        actionBn: 'সবুজ মরিচ ৭-১০ দিন পরপর তুলুন। শুকনো মরিচের জন্য পুরো লাল হলে তুলুন।',
        actionEn: 'Pick green chillies every 7-10 days. For dry chilli, pick when fully red.',
        waterNeed: 'Medium',
        riskBn: 'পাকা মরিচ রোদে শুকাতে বৃষ্টির আগে ঢেকে রাখুন।',
        riskEn: 'Cover drying chillies before rain to avoid mould.',
        type: 'harvest'
      }
    ]
  },
  'maize': {
    nameBn: 'ভুট্টা',
    nameEn: 'Maize',
    durationDays: 135,
    stages: [
      {
        day: 1,
        stageNameBn: 'বীজ বপন',
        stageNameEn: 'Sowing',
        actionBn: 'সারিতে বীজ বপন করুন এবং জমি তৈরিতে টিএসপি, এমওপি, জিপসাম ও ইউরিয়ার ১/৩ অংশ দিন।',
        actionEn: 'Sow seed in lines. Apply TSP, MOP, Gypsum and one third of Urea as basal dose.',
        waterNeed: 'Medium',
        riskBn: 'অঙ্কুরোদগমের জন্য মাটিতে রস থাকা জরুরি; প্রয়োজনে হালকা সেচ দিন।',
        riskEn: 'Soil must have enough moisture to germinate; irrigate lightly if dry.',
        type: 'fertilizer'
      },
      {
        day: 25,
        stageNameBn: 'হাঁটু উচ্চতা (৮-১০ পাতা)',
        stageNameEn: 'Knee-high Stage',
        actionBn: 'আগাছা দমন করে ইউরিয়ার দ্বিতীয় কিস্তি দিন, গোড়ায় মাটি তুলুন এবং সেচ দিন।',
        actionEn: 'Weed, apply the 2nd Urea dose, earth up around the base and irrigate.',
        waterNeed: 'Medium',
        riskBn: 'ফল আর্মিওয়ার্ম (পাতা কাটা পোকা) পাতার গুচ্ছে খুঁজে দেখুন।',
        riskEn: 'Check leaf whorls for Fall Armyworm.',
        type: 'fertilizer'
      },
      {
        day: 50,
        stageNameBn: 'মোচা বের হওয়ার আগে',
        stageNameEn: 'Pre-tasseling',
        actionBn: 'ইউরিয়ার তৃতীয় কিস্তি দিন এবং সেচ দিন।',
        actionEn: 'Apply the 3rd Urea dose and irrigate.',
        waterNeed: 'High',
        riskBn: 'ফল আর্মিওয়ার্ম ও মাজরা পোকার আক্রমণ পর্যবেক্ষণ করুন।',
        riskEn: 'Keep scouting for Fall Armyworm and stem borer.',
        type: 'pesticide'
      },
      {
        day: 70,
        stageNameBn: 'পুরুষ ফুল ও রেশম (সিল্কিং)',
        stageNameEn: 'Tasseling & Silking',
        actionBn: 'এই সময় পানির অভাব হলে দানা কমে যায়; জমিতে রস রাখতে সেচ দিন।',
        actionEn: 'Water shortage now reduces grain set; irrigate to keep soil moist.',
        waterNeed: 'High',
        riskBn: 'পাতা ঝলসানো ও মরিচা রোগের লক্ষণ দেখুন।',
        riskEn: 'Watch for leaf blight and rust.',
        type: 'irrigation'
      },
      {
        day: 130,
        stageNameBn: 'ভুট্টা সংগ্রহ',
        stageNameEn: 'Harvest',
        actionBn: 'ভুট্টার খোসা শুকিয়ে খড়ের রঙ হলে এবং দানা শক্ত হলে মোচা তুলুন; রোদে ভালো করে শুকান।',
        actionEn: 'Harvest when husks turn straw-coloured and grains are hard. Dry the cobs well in the sun.',
        waterNeed: 'Low',
        riskBn: 'সংরক্ষণের আগে দানা ভালোভাবে শুকান, না হলে ছত্রাক ও বিষাক্ত পদার্থ হয়।',
        riskEn: 'Dry grain well before storage to avoid mould and aflatoxin.',
        type: 'harvest'
      }
    ]
  },
  'mustard': {
    nameBn: 'সরিষা',
    nameEn: 'Mustard',
    durationDays: 90,
    stages: [
      {
        day: 1,
        stageNameBn: 'বীজ বপন',
        stageNameEn: 'Sowing',
        actionBn: 'জমি তৈরিতে টিএসপি, এমওপি, জিপসাম, জিংক ও বোরন সার দিন। সারিতে বা ছিটিয়ে বীজ বপন করুন।',
        actionEn: 'Apply TSP, MOP, Gypsum, Zinc and Boron in land prep. Sow seed in lines or broadcast.',
        waterNeed: 'Low',
        riskBn: 'জমিতে রস কম থাকলে বপনের আগে হালকা সেচ দিন।',
        riskEn: 'If the soil is dry, irrigate lightly before sowing.',
        type: 'fertilizer'
      },
      {
        day: 20,
        stageNameBn: 'চারা পাতলা করা ও আগাছা দমন',
        stageNameEn: 'Thinning & Weeding',
        actionBn: 'ঘন চারা পাতলা করুন, আগাছা তুলুন এবং ইউরিয়ার উপরিপ্রয়োগ করে হালকা সেচ দিন।',
        actionEn: 'Thin crowded plants, weed, top-dress Urea and irrigate lightly.',
        waterNeed: 'Medium',
        riskBn: 'করাত মাছি ও পাতা খেকো পোকা পর্যবেক্ষণ করুন।',
        riskEn: 'Scout for sawfly and leaf-eating caterpillars.',
        type: 'fertilizer'
      },
      {
        day: 40,
        stageNameBn: 'ফুল ধরা',
        stageNameEn: 'Flowering',
        actionBn: 'ফুল আসার সময় দ্বিতীয় সেচ দিন। অতিরিক্ত সেচ দেবেন না।',
        actionEn: 'Give the second irrigation at flowering. Avoid over-watering.',
        waterNeed: 'High',
        riskBn: 'জাব পোকা (এফিড) ডগা ও ফুলে লক্ষ্য করুন; আক্রমণ হলে দ্রুত দমন করুন।',
        riskEn: 'Check tips and flowers for aphids and control them quickly.',
        type: 'pesticide'
      },
      {
        day: 60,
        stageNameBn: 'শুঁটি ভরা',
        stageNameEn: 'Pod Filling',
        actionBn: 'প্রয়োজনে একবার হালকা সেচ দিন। এই সময় আগাছা মুক্ত রাখুন।',
        actionEn: 'Give one light irrigation if the soil is dry. Keep the field free of weeds.',
        waterNeed: 'Medium',
        riskBn: 'আলটারনারিয়া পাতা ও শুঁটির দাগ রোগ ও জাব পোকা নজরে রাখুন।',
        riskEn: 'Watch for Alternaria leaf and pod spot and for aphids.',
        type: 'irrigation'
      },
      {
        day: 85,
        stageNameBn: 'পরিপক্কতা ও ফসল কর্তন',
        stageNameEn: 'Maturity & Harvest',
        actionBn: '৭৫-৮০% শুঁটি বাদামী বা হলুদ হলে গাছ কেটে রোদে শুকিয়ে মাড়াই করুন।',
        actionEn: 'Cut when 75-80% of pods turn brown or yellow. Sun-dry, then thresh.',
        waterNeed: 'Low',
        riskBn: 'বেশি দেরি করলে শুঁটি ফেটে বীজ ঝরে যায়।',
        riskEn: 'Late harvest causes pods to shatter and seed loss.',
        type: 'harvest'
      }
    ]
  },
  'jute': {
    nameBn: 'পাট',
    nameEn: 'Jute',
    durationDays: 120,
    stages: [
      {
        day: 1,
        stageNameBn: 'বীজ বপন',
        stageNameEn: 'Sowing',
        actionBn: 'ভালো করে চাষ দিয়ে মাটি ঝুরঝুরে করে বীজ বপন করুন। জমি তৈরিতে টিএসপি, এমওপি ও জৈব সার দিন।',
        actionEn: 'Prepare a fine seedbed and sow seed. Apply TSP, MOP and organic manure in land prep.',
        waterNeed: 'Medium',
        riskBn: 'বপনের পর বৃষ্টি না হলে হালকা সেচ দিন।',
        riskEn: 'Irrigate lightly after sowing if there is no rain.',
        type: 'fertilizer'
      },
      {
        day: 20,
        stageNameBn: 'চারা পাতলা করা ও প্রথম নিড়ানি',
        stageNameEn: 'Thinning & First Weeding',
        actionBn: 'চারা পাতলা করে গাছে গাছে ৫-৮ সেমি দূরত্ব রাখুন, নিড়ানি দিন এবং ইউরিয়ার প্রথম কিস্তি দিন।',
        actionEn: 'Thin to 5-8 cm between plants, weed and apply the 1st Urea dose.',
        waterNeed: 'Medium',
        riskBn: 'বিছা পোকা (লোমশ পোকা) ও বাকল ছিদ্রকারী পোকা পর্যবেক্ষণ করুন।',
        riskEn: 'Scout for hairy caterpillar and stem weevil.',
        type: 'fertilizer'
      },
      {
        day: 45,
        stageNameBn: 'দ্রুত বৃদ্ধি ও দ্বিতীয় নিড়ানি',
        stageNameEn: 'Rapid Growth & Second Weeding',
        actionBn: 'দ্বিতীয় নিড়ানি দিন এবং ইউরিয়ার দ্বিতীয় কিস্তি দিন।',
        actionEn: 'Do the second weeding and apply the 2nd Urea dose.',
        waterNeed: 'Medium',
        riskBn: 'খরা হলে হালকা সেচ দিন; জমিতে পানি জমতে দেবেন না।',
        riskEn: 'Irrigate lightly in drought; do not let water stand.',
        type: 'fertilizer'
      },
      {
        day: 75,
        stageNameBn: 'পোকা ও মাকড় নজরদারি',
        stageNameEn: 'Pest & Mite Scouting',
        actionBn: 'হলুদ মাকড়, বিছা পোকা ও ঘোড়া পোকার জন্য জমি দেখুন; আক্রান্ত পাতা তুলে নষ্ট করুন।',
        actionEn: 'Check for yellow mite, hairy caterpillar and semilooper. Remove and destroy attacked leaves.',
        waterNeed: 'Medium',
        riskBn: 'ছত্রাক রোগে কাণ্ড পচা ও ডগা মরা দেখা দিতে পারে।',
        riskEn: 'Stem rot and tip dieback can appear.',
        type: 'pesticide'
      },
      {
        day: 110,
        stageNameBn: 'পাট কাটা ও জাগ দেওয়া',
        stageNameEn: 'Harvest & Retting',
        actionBn: 'গাছে ফুল আসা শুরু বা ছোট ফল হলে পাট কাটুন। আঁটি বেঁধে ৩-৪ দিন পাতা ঝরিয়ে পরিষ্কার পানিতে জাগ দিন।',
        actionEn: 'Cut at flowering or small pod stage. Bundle, let leaves drop 3-4 days, then ret in clean water.',
        waterNeed: 'Low',
        riskBn: 'ঘোলা বা নোংরা পানিতে জাগ দিলে আঁশের মান খারাপ হয়।',
        riskEn: 'Retting in dirty water lowers fibre quality.',
        type: 'harvest'
      }
    ]
  }
};
