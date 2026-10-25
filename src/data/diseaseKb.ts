/**
 * Curated Bangladesh crop-disease reference.
 *
 * WHY THIS EXISTS
 * ---------------
 * The strongest measured result in plant-disease prompting is that the gap
 * is knowledge and structure, not model size: GPT-4o zero-shot scored 45.9%
 * on leaf-disease identification and 88.9% once it was given a disease
 * description database plus scoring rules — and removing just the scoring
 * rules dropped it back to 51.8%. A second study found that adding symptom
 * knowledge alone lifted accuracy by 16.2 percentage points.
 *
 * So this file is the "disease description database" for the crops the app
 * supports in Bangladesh. It is deliberately short and specific per crop:
 * a trimmed reference is more useful to the model than the full catalogue,
 * and it keeps the prompt small enough that context caching is not worth the
 * extra API surface (a per-crop entry is roughly 2,000 tokens, which is
 * about $0.0006 at Gemini 3.5 Flash-Lite input pricing).
 *
 * SAFETY RULES BAKED IN
 * ---------------------
 * - Only DAE-registered modern compounds are named. The banned and
 *   restricted list (Paraquat, Endosulfan, Monocrotophos, Dichlorvos,
 *   Phosphamidon, Carbofuran) appears nowhere in this file.
 * - Every entry ends with the PHI and "consult the local SAAO" instruction,
 *   because a photo diagnosis cannot establish a safe spray interval.
 * - "Look-alike" is on every entry. Telling the model what a disease
 *   resembles is what makes the differential diagnosis real rather than
 *   decorative.
 */

export interface KbDisease {
  /** English disease name. */
  disease: string;
  /** Bangla disease name. */
  diseaseBn: string;
  /** Causal organism. */
  pathogen: string;
  /** English symptoms as seen on the plant. */
  symptomsEn: string;
  /** Bangla symptoms. */
  symptomsBn: string;
  /** What this is commonly mistaken for, and the thing that separates them. */
  lookAlike: string;
  /** Short management note. */
  managementEn: string;
  /** Bangla management note. */
  managementBn: string;
  /** Low | Medium | High */
  severity: 'Low' | 'Medium' | 'High';
}

export interface CropKnowledge {
  diseases: KbDisease[];
}

const SAAO_EN =
  'Always state the Pre-Harvest Interval and confirm with the local DAE Sub-Assistant Agriculture Officer (SAAO) before spraying.';
const SAAO_BN =
  'স্প্রে করার আগে অপেক্ষমাণ সময় (PHI) উল্লেখ করুন এবং স্থানীয় উপ-সহকারী কৃষি কর্মকর্তা (SAAO) এর পরামর্শ নিন।';

/**
 * Keyed by the English crop names used in `translations.en.crops`, because
 * that is what the diagnosis prompt sends to the model.
 */
export const CROP_KNOWLEDGE: Record<string, CropKnowledge> = {
  Paddy: {
    diseases: [
      {
        disease: 'Bacterial leaf blight',
        diseaseBn: 'ব্যাকটেরিয়া পাতা পোড়া',
        pathogen: 'Xanthomonas oryzae pv. oryzae',
        symptomsEn:
          'Wavy yellow-white lesions starting at the leaf tip and running down the margin; lesions have a grey-green centre and the blade may later dry and roll.',
        symptomsBn:
          'পাতার ডগা থেকে শুরু হয়ে ঢেউয়ে ঢেউয়ে হলুদ-সাদা দাগ পাতার আকার ধরে নামে; মাঝখানে ধূসর-সবুজ হয় এবং পরে পাতা শুকিয়ে গুটিয়ে যায়।',
        lookAlike:
          'Rice blast has spindle-shaped brown spots with grey centres and NO yellow halo; bacterial blight is always wavy with a yellow-white margin. Herbicide damage is uniformly distributed, not tip-first.',
        managementEn:
          'Use certified seed, avoid excess nitrogen, drain the field, and apply a registered copper or Cartap-based foliar spray at early lesion stage.',
        managementBn:
          'প্রত্যয়িত বীজ ব্যবহার করুন, অতিরিক্ত নাইট্রোজেন এড়িয়ে চলুন, জমি নিষ্কাশন করুন এবং প্রাথমিক ধাপে রেজিস্টার্ড কপার বা কার্টাপ স্প্রে করুন।',
        severity: 'High',
      },
      {
        disease: 'Rice blast',
        diseaseBn: 'ধানের ব্লাস্ট',
        pathogen: 'Magnaporthe oryzae',
        symptomsEn:
          'Spindle-shaped lesions with grey-brown centres and darker margins; in the neck of the panicle it causes "collar rot", producing empty or partly filled grains.',
        symptomsBn:
          'চৌড়া আকৃতির দাগ, মাঝখানে ধূসর-বাদামি এবং কিনারা গাঢ়; আঁটির গোড়ায় আক্রমণ হলে "কলার রট" হয়, ফলে চাল ফাঁকা বা অর্ধেক ভরা হয়।',
        lookAlike:
          'Brown spot (Bipolaris) has round, sesame-seed sized brown spots evenly scattered over the whole leaf, not spindle-shaped ones from the tip.',
        managementEn:
          'Split nitrogen into three doses, keep the field drained at tillering, avoid dense seeding, and spray a registered tricyclazole or azoxystrobin product.',
        managementBn:
          'নাইট্রোজেন তিন ভাগে দিন, কলিপড়ের সময় জমি নিষ্কাশন রাখুন, ঘন বীজ বপন এড়িয়ে চলুন এবং ট্রাইসাইক্লোজল বা অ্যাজক্সিস্ট্রোবিন স্প্রে করুন।',
        severity: 'High',
      },
      {
        disease: 'Sheath blight',
        diseaseBn: 'ধানের পাতা পোড়া',
        pathogen: 'Rhizoctonia solani',
        symptomsEn:
          'Oval, water-soaked greenish-grey lesions on the sheath near the water line that turn straw-brown with a white mycelial mat and brown "sheath blight" lesions on the leaf.',
        symptomsBn:
          'পানির সমান্তরাল পাতা আবরণে সবুজাভ ও ভেজা গোলাকার দাগ, পরে হলুদ-বাদামি হয় এবং সাদা ছত্রাকের আঁশ ও পাতায় বাদামি দাগ দেখা যায়।',
        lookAlike:
          'Sheath blight lesions are oval with irregular brown borders on the SHEATH; bacterial blight is always wavy and yellow-white on the leaf blade.',
        managementEn:
          'Reduce seeding density, avoid continuous flooding, and apply a registered validamycin or hexaconazole foliar spray at the booting stage.',
        managementBn:
          'বীজ বপন ঘনত্ব কমান, ধারাবাহিক ভাসানো এড়িয়ে চলুন এবং বুটিং পর্যায়ে রেজিস্টার্ড ভ্যালিডামাইসিন বা হেক্সাকোনাজল স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Brown spot',
        diseaseBn: 'বাদামি গাছফড়িং',
        pathogen: 'Bipolaris oryzae',
        symptomsEn:
          'Round to oval dark brown spots, sesame-seed sized, scattered over the leaf; can also darken the panicle (false smut) and weaken the grain.',
        symptomsBn:
          'পাতায় ছোট বাদামি গোলাকার দাগ (তোলে-রেঙা) ছড়িয়ে থাকে; আঁটিতেও কালো দাগ হয় এবং ধানের ফলা দুর্বল হয়।',
        lookAlike:
          'Brown spot is round and evenly scattered; blast is spindle-shaped and starts from the tip. Brown spot on a potassium-deficient plant is easily confused with deficiency — check the whole field.',
        managementEn:
          'Apply a balanced potash fertiliser, drain standing water, and spray a registered propiconazole or Mancozeb product.',
        managementBn:
          'সুষম পটাশ সার প্রয়োগ করুন, পানি নিষ্কাশন করুন এবং রেজিস্টার্ড প্রপিকোনাজল বা ম্যাঙ্কোজেব স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },

  Tomato: {
    diseases: [
      {
        disease: 'Early blight',
        diseaseBn: 'আগাম পাতা পোড়া',
        pathogen: 'Alternaria solani',
        symptomsEn:
          'Dark brown circular spots with concentric rings (target board pattern) on the older lower leaves first, surrounded by a yellow halo; stems and fruit near the soil can darken.',
        symptomsBn:
          'নিচের পুরোনো পাতায় প্রথমে গাঢ় বাদামি গোলাকার দাগ, ভেতরে বৃত্তাকার রেখা (টার্গেট বোর্ডের মতো) এবং চারপাশে হলুদ আভা; ডগা ও ফলে কালচে দাগ হতে পারে।',
        lookAlike:
          'Septoria leaf spot has many SMALL spots with dark borders and black dots in the centre, and no target rings. Late blight has large, greasy, water-soaked patches that spread fast in wet weather.',
        managementEn:
          'Remove and bury infected lower leaves, mulch to stop soil splash, stake plants, and spray a registered Mancozeb or azoxystrobin product at the first lesion.',
        managementBn:
          'আক্রান্ত নিচের পাতা ছিঁটে মাটিতে পুঁড়ে ফেলুন, মালচিং দিন, গাছে সুরক্ষা দিন এবং প্রথম দাগ দেখামাত্র রেজিস্টার্ড ম্যাঙ্কোজেব বা অ্যাজক্সিস্ট্রোবিন স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Late blight',
        diseaseBn: 'পাতা পোড়া (লেট ব্লাইট)',
        pathogen: 'Phytophthora infestans',
        symptomsEn:
          'Large, irregular, water-soaked greasy patches on leaves that turn brown-black, often with a pale green border and white downy growth underneath in humid mornings; fruit gets firm brown greasy lesions.',
        symptomsBn:
          'পাতায় বড় অনিয়মিত ভেজা চিকচিকে দাগ, বাদামি-কালো হয়ে যায় এবং স্যাঁতসেঁতে সকালে নিচে সাদা ঝাঁসি পড়ে; ফলে শক্ত বাদামি দাগ হয়।',
        lookAlike:
          'Late blight spreads from the leaf edge and top down within days and is greasy; early blight is dry, round and target-ringed, and starts on the OLD leaves. Speed of spread decides it.',
        managementEn:
          'This is an emergency: remove infected plants and fruit, stop overhead irrigation, improve airflow, and spray a registered metalaxyl + Mancozeb mix immediately.',
        managementBn:
          'এটি জরুরি: আক্রান্ত গাছ ও ফল সরিয়ে ফেলুন, উপরে জল দেওয়া বন্ধ করুন, বাতাস চলাচল বাড়ান এবং সঙ্গে সঙ্গে রেজিস্টার্ড মেটালাক্সিল + ম্যাঙ্কোজেব মিশ্রণ স্প্রে করুন।',
        severity: 'High',
      },
      {
        disease: 'Tomato leaf curl',
        diseaseBn: 'পাতা পেঁয়ে আক্রান্ত',
        pathogen: 'Begomovirus (whitefly transmitted)',
        symptomsEn:
          'Leaves curl upwards, become small, leathery and yellow between the veins; the plant is stunted and yields very little.',
        symptomsBn:
          'পাতা উপরের দিকে গুটিয়ে যায়, ছোট ও শক্ত হয়, শিরার মাঝে হলুদ হয়; গাছ বিকশত হয় না ও ফলন খুব কম হয়।',
        lookAlike:
          'Physiological leaf roll (a variety problem) rolls the leaves but keeps them green and normal size and does not stunt the plant. Herbicide drift causes cupping with twisted stems.',
        managementEn:
          'Control whitefly with a registered yellow sticky trap and neem-based spray, rogue out infected plants early, and use a resistant variety.',
        managementBn:
          'সাদা মাছি নিয়ন্ত্রণে হলুদ ফাঁদ ও নিম-ভিত্তিক স্প্রে ব্যবহার করুন, আক্রান্ত গাছ দ্রুত সরান এবং রোগ প্রতিরোধী জাত ব্যবহার করুন।',
        severity: 'High',
      },
      {
        disease: 'Bacterial wilt',
        diseaseBn: 'ব্যাকটেরিয়া উইল্ট',
        pathogen: 'Ralstonia solanacearum',
        symptomsEn:
          'Sudden wilting of the whole plant while the leaves are still green, with darkened greasy stems; cutting the stem and floating it in clear water shows milky bacterial ooze.',
        symptomsBn:
          'পাতা সবুজ থাকাকালেই গাছ হঠাৎ শুকিয়ে যায়, ডগা কালচে ও চিকচিকে হয়; ডগা কেটে পরিষ্কার পানিতে ভাসালে দুধের মতো রস বের হয়।',
        lookAlike:
          'Fungal wilt (Fusarium/Verticillium) also wilts the plant, but the stem does NOT ooze and the cut stem does not produce the bacterial stream.',
        managementEn:
          'There is no cure: remove and destroy the plant, do not compost it, rotate away from solanaceous crops, and solarise the seed bed.',
        managementBn:
          'এর কোনো চিকিৎসা নেই: গাছটি তুলে ধ্বংস করুন, কম্পোস্ট করবেন না, সবানি ফসল থেকে ফরোটেশন করুন এবং বীজতলা সূর্য দিয়ে জীবাণুমুক্ত করুন।',
        severity: 'High',
      },
    ],
  },

  Brinjal: {
    diseases: [
      {
        disease: 'Phomopsis blight and fruit rot',
        diseaseBn: 'ফল পচা রোগ',
        pathogen: 'Phomopsis vexans',
        symptomsEn:
          'Circular grey-brown sunken spots on fruit that later turn black and shrivel; leaves carry pale spots with dark centres.',
        symptomsBn:
          'ফলে গোলাকার ধূসর-বাদামি ডুবে যাওয়া দাগ, পরে কালো হয়ে ফল শুকিয়ে যায়; পাতে হালকা দাগের মাঝে গাঢ় দাগ থাকে।',
        lookAlike:
          'Little leaf symptoms appear on new growth, not on the fruit. Bacterial soft rot makes the fruit collapse into a wet, foul-smelling mass.',
        managementEn:
          'Remove infected fruit, seed treatment with a registered fungicide, avoid wetting the foliage, and spray a registered carbendazim or azoxystrobin.',
        managementBn:
          'আক্রান্ত ফল সরান, পরীক্ষিত ছত্রাকনাশক দিয়ে বীজ শোধন করুন, পাতায় জল দেওয়া এড়িয়ে চলুন এবং কার্বেন্ডাজিম বা অ্যাজক্সিস্ট্রোবিন স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Little leaf',
        diseaseBn: 'পাতা ছোট হওয়া',
        pathogen: 'Phytoplasma (whitefly / leafhopper transmitted)',
        symptomsEn:
          'Very small, narrow, yellowish leaves on a bushy plant; internodes stay short so the plant looks like a small rosette.',
        symptomsBn:
          'গাছের পাতা খুব ছোট, সরু ও হলুদ হয়ে যায়; পাতার গোড়া কাছাকাছি হয়ে গাছ ঝোমখোর দেখায়।',
        lookAlike:
          'Herbicide damage and zinc deficiency also shrink leaves, but they do not produce the narrow, uniformly yellow, rosette-like plant this does.',
        managementEn:
          'No cure once infected. Control the vector with sticky traps, rogue out infected plants, and plant resistant seedlings.',
        managementBn:
          'আক্রান্ত হলে নিরাময় নেই। ফাঁদ দিয়ে ভেক্টর নিয়ন্ত্রণ করুন, আক্রান্ত গাছ সরান এবং রোগ প্রতিরোধী চারা ব্যবহার করুন।',
        severity: 'High',
      },
      {
        disease: 'Shoot and fruit borer',
        diseaseBn: 'ফল ছিদ্রকারী পোকা',
        pathogen: 'Leucinodes orbonalis',
        symptomsEn:
          'Larvae bore into shoots, making them wilt and break off, and into fruit, leaving round holes with frass and the flower stuck to the fruit tip.',
        symptomsBn:
          'শুকরি গাছের ডগায় ছিদ্র করে ঢোকে ফলে ছিদ্র করে, ফলের গোড়ায় ফুল আটকে থাকে এবং গাছ ডগা শুকিয়ে ভেঙে যায়।',
        lookAlike:
          'Fruit fly damage gives small puncture wounds with rotting around them, not a clean bore hole with frass and the withered flower attached.',
        managementEn:
          'Remove and destroy bored fruit, use pheromone traps, and spray a registered Cartap or Chlorantraniliprole product when the threshold is crossed.',
        managementBn:
          'ছিদ্রযুক্ত ফল সরিয়ে ধ্বংস করুন, ফেরোমন ফাঁদ ব্যবহার করুন এবং আক্রমণের সীমা পেরিয়ে গেলে রেজিস্টার্ড কার্টাপ বা ক্লোরান্ট্রানিলিপ্রল স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },

  Chili: {
    diseases: [
      {
        disease: 'Anthracnose / die-back',
        diseaseBn: 'অ্যানথ্রাকনোজ',
        pathogen: 'Colletotrichum spp.',
        symptomsEn:
          'Sunken, circular, dark brown to black spots on ripening fruit, often with concentric rings of pink spores; twig die-back from the tip.',
        symptomsBn:
          'পাকা ফলে গোলাকার গর্তে বসানো গাঢ় বাদামি থেকে কালো দাগ, ডগা মরে যাওয়া (ডাই-ব্যাক) দেখা যায়।',
        lookAlike:
          'Bacterial spot gives small raised corky spots on the fruit, not sunken ones. Sunscald makes a pale patch on the sun-facing side.',
        managementEn:
          'Pick healthy seed, remove infected twigs and fruit, avoid overhead watering, and spray a registered carbendazim or Chlorantraniliprole.',
        managementBn:
          'পরিষ্কার বীজ ব্যবহার করুন, আক্রান্ত ডগা ও ফল সরান, উপরে জল দেওয়া এড়িয়ে চলুন এবং রেজিস্টার্ড কার্বেন্ডাজিম বা ক্লোরান্ট্রানিলিপ্রল স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Bacterial wilt',
        diseaseBn: 'ব্যাকটেরিয়া উইল্ট',
        pathogen: 'Ralstonia solanacearum',
        symptomsEn:
          'Sudden wilt of the whole plant with leaves still green; the cut stem shows milky ooze in clear water.',
        symptomsBn:
          'পাতা সবুজ থাকতেই গাছ হঠাৎ শুকিয়ে যায়; ডগা কেটে পরিষ্কার পানিতে রাখলে দুধের মতো রস বের হয়।',
        lookAlike:
          'Phytoplasma wilt also wilts the plant but the stem does not ooze, and the leaves usually yellow before they droop.',
        managementEn:
          'No chemical cure. Remove the plant with its roots, do not plant susceptible crops there again, and rotate for at least three seasons.',
        managementBn:
          'কোনো রাসায়নিক চিকিৎসা নেই। গাছটি শিকড়সহ তুলে ফেলুন, এখানে আবার ঝুঁকিপূর্ণ ফসল লাগাবেন না এবং অন্তত তিন বছর ফরোটেশন করুন।',
        severity: 'High',
      },
      {
        disease: 'Leaf curl (whitefly)',
        diseaseBn: 'পাতা পেঁয়ে আক্রান্ত',
        pathogen: 'Begomovirus',
        symptomsEn:
          'Upward curling, smaller leaves, yellowing between the veins and a stunted bushy plant; sometimes a severe yield loss without any visible spots.',
        symptomsBn:
          'পাতা উপরে গুটিয়ে যায়, ছোট হয়, শিরার মাঝে হলুদ হয় এবং গাছ খোসসাঁট হয়ে বিকশত হয় না।',
        lookAlike:
          'Broad mite damage also curls new leaves but the leaves stay small and hard rather than yellow, and mites are visible with a hand lens.',
        managementEn:
          'Use a resistant variety, control whitefly with sticky traps and neem spray, and rogue out infected plants early.',
        managementBn:
          'রোগ প্রতিরোধী জাত ব্যবহার করুন, সাদা মাছি নিয়ন্ত্রণে ফাঁদ ও নিম স্প্রে দিন এবং আক্রান্ত গাছ দ্রুত সরান।',
        severity: 'High',
      },
    ],
  },

  Potato: {
    diseases: [
      {
        disease: 'Early blight',
        diseaseBn: 'আগাম পাতা পোড়া',
        pathogen: 'Alternaria solani',
        symptomsEn:
          'Dark brown spots with concentric rings on the older leaves, starting from the lowest leaves and moving up; the crop defoliates early.',
        symptomsBn:
          'নিচের পুরোনো পাতায় বৃত্তাকার রেখাযুক্ত গাঢ় বাদামি দাগ, ধীরে ধীরে উপরে ওঠে; গাছ আগেই পাতা হারায়।',
        lookAlike:
          'Late blight lesions are large, greasy, water-soaked and spread in a few days; early blight is dry with clear target rings.',
        managementEn:
          'Remove volunteer plants, rotate for three years, avoid excess nitrogen, and spray a registered Mancozeb or chlorothalonil.',
        managementBn:
          'অবশিষ্ট গাছ সরান, তিন বছর ফরোটেশন করুন, অতিরিক্ত নাইট্রোজেন এড়িয়ে চলুন এবং রেজিস্টার্ড ম্যাঙ্কোজেব বা ক্লোরোথালোনিল স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Late blight',
        diseaseBn: 'পাতা পোড়া (লেট ব্লাইট)',
        pathogen: 'Phytophthora infestans',
        symptomsEn:
          'Water-soaked dark patches on leaves and stems that expand rapidly in cool wet weather, with a white mouldy edge on the underside.',
        symptomsBn:
          'শীতল ও ভেজা আবহাওয়ায় পাতা ও ডগায় ভেজা গাঢ় দাগ দ্রুত ছড়ায় এবং নিচের দিকে সাদা ছত্রাক দেখা যায়।',
        lookAlike:
          'This is the fastest-moving potato disease — if it doubles in area within two days, treat it as late blight regardless of the lesion shape.',
        managementEn:
          'Act immediately: destroy infected plants, stop overhead irrigation, and spray a registered cymoxanil + Mancozeb mix.',
        managementBn:
          'সঙ্গে সঙ্গে ব্যবস্থা নিন: আক্রান্ত গাছ ধ্বংস করুন, উপরে জল দেওয়া বন্ধ করুন এবং রেজিস্টার্ড সাইমোক্সানিল + ম্যাঙ্কোজেব মিশ্রণ স্প্রে করুন।',
        severity: 'High',
      },
      {
        disease: 'Bacterial wilt',
        diseaseBn: 'ব্যাকটেরিয়া উইল্ট',
        pathogen: 'Ralstonia solanacearum',
        symptomsEn:
          'Sudden wilting of one or all stems with the leaves still green; cutting the stem and floating it shows a milky stream from the vascular ring.',
        symptomsBn:
          'পাতা সবুজ থাকতেই এক বা সব ডগা হঠাৎ শুকিয়ে যায়; ডগা কেটে ভাসালে নালীর গোলায় দুধের মতো রস দেখা যায়।',
        lookAlike:
          'Black scurf affects the tuber skin and stems but does not cause sudden green wilting.',
        managementEn:
          'No cure. Remove the plants, do not save the seed tubers, plant certified disease-free seed, and rotate out of solanaceous crops.',
        managementBn:
          'নিরাময় নেই। গাছ সরান, বীজ হিসেবে ফল রাখবেন না, প্রত্যয়িত রোগমুক্ত বীজ ব্যবহার করুন এবং সবানি ফসল থেকে ফরোটেশন করুন।',
        severity: 'High',
      },
    ],
  },

  Onion: {
    diseases: [
      {
        disease: 'Purple blotch',
        diseaseBn: 'বেগুনি দাগ রোগ',
        pathogen: 'Alternaria porri',
        symptomsEn:
          'Small white sunken spots that enlarge into brown-purple zonate lesions on the leaves, which then die back from the tip.',
        symptomsBn:
          'পাতায় ছোট সাদা গর্তযুক্ত দাগ ধীরে ধীরে বেগুনি-বাদামি বলয়াকার দাগে পরিণত হয় এবং পাতা ডগা থেকে শুকিয়ে মরে যায়।',
        lookAlike:
          'Downy mildew gives a fuzzy violet-grey growth on the leaf underside with yellow streaks above; purple blotch lesions are dry with concentric rings.',
        managementEn:
          'Rotate out of onion, use clean seed, avoid heavy nitrogen, and spray a registered Mancozeb or chlorothalonil.',
        managementBn:
          'পেঁয়াজ থেকে ফরোটেশন করুন, পরিষ্কার বীজ ব্যবহার করুন, ভারী নাইট্রোজেন এড়িয়ে চলুন এবং রেজিস্টার্ড ম্যাঙ্কোজেব বা ক্লোরোথালোনিল স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Downy mildew',
        diseaseBn: 'ডাউনি মিলডিউ',
        pathogen: 'Peronospora destructor',
        symptomsEn:
          'Pale yellow streaks on the leaf that later turn violet-grey and fuzzy on the underside; the leaf flattens and dies.',
        symptomsBn:
          'পাতায় হলুদ ডোগা, পরে নিচের দিকে বেগুনি-ধূসর লোমবর্তা হয়; পাতা চ্যাপ্টা হয়ে মরে যায়।',
        lookAlike:
          'Purple blotch lesions are dry and zonate; downy mildew always has the fuzzy violet growth on the underside in humid weather.',
        managementEn:
          'Use a resistant or treated seed, keep the field dry, and spray a registered metalaxyl + Mancozeb mix early.',
        managementBn:
          'প্রতিরোধী বা প্রক্রিয়াকৃত বীজ ব্যবহার করুন, জমি শুকনো রাখুন এবং আগেই রেজিস্টার্ড মেটালাক্সিল + ম্যাঙ্কোজেব স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },

  Watermelon: {
    diseases: [
      {
        disease: 'Fusarium wilt',
        diseaseBn: 'ফিউজারিয়াম উইল্ট',
        pathogen: 'Fusarium oxysporum f. sp. niveum',
        symptomsEn:
          'Vine growth slows, leaves wilt during the heat of the day and recover at night, then the whole vine dies; brown streaks run up the stem.',
        symptomsBn:
          'লতার বৃদ্ধি ধীর হয়, দুপুরে পাতা শুকিয়ে যায় এবং রাতে সুস্থ হয়ে পড়ে, পরে লতা মরে যায়; ডগায় বাদামি রেখা দেখা যায়।',
        lookAlike:
          'Bacterial wilt shows a milky ooze from the cut stem; fusarium wilt does not.',
        managementEn:
          'Plant on well-drained soil, use a resistant variety, rotate for three years, and treat seed with a registered fungicide.',
        managementBn:
          'ভালো নিষ্কাশনযোগ্য মাটিতে লাগান, রোগ প্রতিরোধী জাত ব্যবহার করুন, তিন বছর ফরোটেশন করুন এবং পরীক্ষিত ছত্রাকনাশক দিয়ে বীজ শোধন করুন।',
        severity: 'High',
      },
      {
        disease: 'Anthracnose',
        diseaseBn: 'অ্যানথ্রাকনোজ',
        pathogen: 'Colletotrichum orbiculare',
        symptomsEn:
          'Round brown-black spots on leaves and water-soaked dark lesions on the fruit rind that turn pinkish in the field.',
        symptomsBn:
          'পাতায় গোলাকার বাদামি-কালো দাগ এবং ফলের খোসায় ভেজা গাঢ় দাগ যা পাকার সময় গোলাপি হয়।',
        lookAlike:
          'Bacterial fruit blotch causes a narrow dark line on the rind and a whitish bacterial ooze on the fruit surface.',
        managementEn:
          'Rotate, remove crop residues, use a resistant variety, and spray a registered carbendazim or azoxystrobin.',
        managementBn:
          'ফরোটেশন করুন, আগের ফসলের অবশিষ্ট সরান, রোগ প্রতিরোধী জাত ব্যবহার করুন এবং রেজিস্টার্ড কার্বেন্ডাজিম বা অ্যাজক্সিস্ট্রোবিন স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },

  Cucumber: {
    diseases: [
      {
        disease: 'Downy mildew',
        diseaseBn: 'ডাউনি মিলডিউ',
        pathogen: 'Pseudoperonospora cubensis',
        symptomsEn:
          'Angular yellow patches bounded by the leaf veins, with grey-purple fuzz on the underside; the leaf dries and dies.',
        symptomsBn:
          'পাতার শিরা দিয়ে সীমান্তবদ্ধ হলুদ দাগ এবং নিচে ধূসর-বেগুনি লোম; পাতা শুকিয়ে মরে যায়।',
        lookAlike:
          'Powdery mildew is a white powdery coat on the UPPER surface and is not angular or vein-bounded.',
        managementEn:
          'Use a resistant variety, keep leaves dry, remove infected leaves, and spray a registered metalaxyl + Mancozeb mix early.',
        managementBn:
          'রোগ প্রতিরোধী জাত ব্যবহার করুন, পাতা শুকনো রাখুন, আক্রান্ত পাতা সরান এবং আগেই রেজিস্টার্ড মেটালাক্সিল + ম্যাঙ্কোজেব স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Bacterial wilt',
        diseaseBn: 'ব্যাকটেরিয়া উইল্ট',
        pathogen: 'Ralstonia solanacearum',
        symptomsEn:
          'The vine wilts suddenly and dies while the leaves are still green; a milky stream runs from the cut stem.',
        symptomsBn:
          'লতা পাতা সবুজ থাকতেই হঠাৎ শুকিয়ে মরে যায়; কাটা ডগা থেকে দুধের মতো রস বের হয়।',
        lookAlike:
          'Fusarium wilt wilts more gradually and shows vascular browning instead of milky ooze.',
        managementEn:
          'No cure. Remove the vine, avoid saving seed, disinfect stakes and tools, and rotate for at least three years.',
        managementBn:
          'নিরাময় নেই। লতা সরান, বীজ সংরক্ষণ করবেন না, খুঁটি ও যন্ত্র জীবাণুমুক্ত করুন এবং অন্তত তিন বছর ফরোটেশন করুন।',
        severity: 'High',
      },
    ],
  },

  Maize: {
    diseases: [
      {
        disease: 'Turcicum leaf blight',
        diseaseBn: 'পাতা পোড়া (টারসিকাম)',
        pathogen: 'Exserohilum turcicum',
        symptomsEn:
          'Long cigar-shaped grey-green lesions running along the leaf, which dry and tear, giving a ragged appearance.',
        symptomsBn:
          'পাতার দৈর্ঘ্যায় ধূসর-সবুজ সিগার আকৃতির দাগ, পরে শুকিয়ে ছিঁড়ে যায়।',
        lookAlike:
          'Northern leaf blight gives long cigar-shaped lesions too, but it is more grey and the lesions do not have the dark border of turcicum.',
        managementEn:
          'Rotate, use a resistant hybrid, and spray a registered azoxystrobin if it appears early.',
        managementBn:
          'ফরোটেশন করুন, রোগ প্রতিরোধী হাইব্রিড ব্যবহার করুন এবং শুরুতে দেখা দিলে রেজিস্টার্ড অ্যাজক্সিস্ট্রোবিন স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Maydis leaf blight',
        diseaseBn: 'পাতা পোড়া',
        pathogen: 'Bipolaris maydis',
        symptomsEn:
          'Cannon-shaped tan to brown lesions with dark borders on the leaves, and cigar-shaped lesions on the stalk and husk.',
        symptomsBn:
          'পাতায় বাদামি দাগের সঙ্গে গাঢ় কিনারা এবং ডগা ও খোসায় সিগার আকৃতির দাগ।',
        lookAlike:
          'Rust shows small raised cinnamon-brown pustules that rub off, rather than flat lesions.',
        managementEn:
          'Use a resistant hybrid, avoid dense planting, and spray a registered Mancozeb or azoxystrobin.',
        managementBn:
          'রোগ প্রতিরোধী হাইব্রিড ব্যবহার করুন, ঘন বপন এড়িয়ে চলুন এবং রেজিস্টার্ড ম্যাঙ্কোজেব বা অ্যাজক্সিস্ট্রোবিন স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },

  Wheat: {
    diseases: [
      {
        disease: 'Wheat blast',
        diseaseBn: 'গমের ব্লাস্ট',
        pathogen: 'Magnaporthe grisea',
        symptomsEn:
          'Spindle-shaped grey-brown lesions with grey centres on the leaves, and a black powdery mass on the spike that replaces the grain.',
        symptomsBn:
          'পাতায় চৌড়া আকৃতির ধূসর-বাদামি দাগ এবং আঁটিতে কালো গুঁড়ো আকারে ছড়িয়ে যায়, ফলে বীজ থাকে না।',
        lookAlike:
          'Leaf rust gives orange-brown pustules scattered over the leaf; blast lesions are spindle-shaped with a grey centre.',
        managementEn:
          'Avoid dense seeding, use resistant varieties, and spray a registered tricyclazole or azoxystrobin at the tillering-to-heading stage.',
        managementBn:
          'ঘন বপন এড়িয়ে চলুন, রোগ প্রতিরোধী জাত ব্যবহার করুন এবং কলিপড় থেকে আঁটি বের হওয়ার সময় রেজিস্টার্ড ট্রাইসাইক্লোজল বা অ্যাজক্সিস্ট্রোবিন স্প্রে করুন।',
        severity: 'High',
      },
      {
        disease: 'Rust',
        diseaseBn: 'রাস্ট',
        pathogen: 'Puccinia spp.',
        symptomsEn:
          'Orange, yellow or brown pustules in stripes or scattered over the leaf, which rub off leaving brown marks.',
        symptomsBn:
          'পাতায় কমলা, হলুদ বা বাদামি ফোঁটা দাগ, হাতে লাগলে উঠে যায় এবং বাদামি দাগ থেকে যায়।',
        lookAlike:
          'Blast and leaf scab do not produce raised pustules; rust pustules rub off onto the palm.',
        managementEn:
          'Sow early, use resistant varieties, and spray a registered propiconazole or tebuconazole when pustules appear.',
        managementBn:
          'আগে বপন করুন, রোগ প্রতিরোধী জাত ব্যবহার করুন এবং ফোঁটা দাগ দেখামাত্র রেজিস্টার্ড প্রপিকোনাজল বা টেবুকোনাজল স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },

  Mustard: {
    diseases: [
      {
        disease: 'White rust',
        diseaseBn: 'সাদা রাস্ট',
        pathogen: 'Albugo candida',
        symptomsEn:
          'Chalky white raised pustules on the underside of leaves, which bulge on the upper side; the leaves distort and the plant stays stunted.',
        symptomsBn:
          'পাতার নিচে চকের মতো সাদা ফোঁটা দাগ, উপরে ফোলা; পাতা বিকৃত হয়ে গাছ খোসসাঁট থাকে।',
        lookAlike:
          'Aphid whitefly wax looks similar but is on the surface and wipes off, while white rust pustules are embedded in the leaf.',
        managementEn:
          'Rotate, use resistant seed, and spray a registered Mancozeb or metalaxyl mix.',
        managementBn:
          'ফরোটেশন করুন, প্রতিরোধী বীজ ব্যবহার করুন এবং রেজিস্টার্ড ম্যাঙ্কোজেব বা মেটালাক্সিল মিশ্রণ স্প্রে করুন।',
        severity: 'Medium',
      },
      {
        disease: 'Alternaria blight',
        diseaseBn: 'অ্যানথ্রাকনোজ',
        pathogen: 'Alternaria brassicae',
        symptomsEn:
          'Round brown spots with concentric rings on the older leaves, which tear and drop out, giving a shot-hole look.',
        symptomsBn:
          'পুরোনো পাতায় বৃত্তাকার রেখাযুক্ত বাদামি দাগ, পরে ছিঁড়ে গর্তের মতো হয়ে যায়।',
        lookAlike:
          'White rust gives white pustules on the underside; alternaria gives brown target-ringed spots on the upper surface.',
        managementEn:
          'Rotate, remove residues, and spray a registered Mancozeb or chlorothalonil.',
        managementBn:
          'ফরোটেশন করুন, আগের ফসলের অবশিষ্ট সরান এবং রেজিস্টার্ড ম্যাঙ্কোজেব বা ক্লোরোথালোনিল স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },

  Pulse: {
    diseases: [
      {
        disease: 'Fusarium wilt',
        diseaseBn: 'ফিউজারিয়াম উইল্ট',
        pathogen: 'Fusarium oxysporum',
        symptomsEn:
          'Individual plants wilt and die in patches while the rest of the field stays healthy; the stem shows dark vascular streaking near the base.',
        symptomsBn:
          'জমির কিছু খান্ত জায়গায় গাছ আলাদা আলাদা শুকিয়ে মরে যায়; ডগার গোড়ায় নালীর গাঢ় রেখা দেখা যায়।',
        lookAlike:
          'Stem borer damage shows a hole and frass at the stem base; fusarium wilt has no hole.',
        managementEn:
          'Use resistant varieties, treat seed with a registered fungicide, and rotate with a non-host crop.',
        managementBn:
          'রোগ প্রতিরোধী জাত ব্যবহার করুন, পরীক্ষিত ছত্রাকনাশক দিয়ে বীজ শোধন করুন এবং অধিবৃত্তি ফসলের সঙ্গে ফরোটেশন করুন।',
        severity: 'High',
      },
      {
        disease: 'Stem borer',
        diseaseBn: 'ডগা ছিদ্রকারী পোকা',
        pathogen: 'Scissoroptilus / Sesamia spp.',
        symptomsEn:
          'A pinhole at the stem base with frass, dead heart in the shoot, and the plant breaking at the base in the wind.',
        symptomsBn:
          'ডগার গোড়ায় সূক্ষ্ম ছিদ্র ও মলমল, মাঝারি ভাঙা সুকি, এবং বাতাসে গাছ গোড়া থেকে ভেঙে যাওয়া।',
        lookAlike:
          'Fusarium wilt kills the plant without a bore hole; stem borer always has a hole and frass at the base.',
        managementEn:
          'Destroy stubble, use pheromone traps, and spray a registered Chlorantraniliprole or Cartap when egg-laying starts.',
        managementBn:
          'গাড়ির খড় সরিয়ে ফেলুন, ফেরোমন ফাঁদ ব্যবহার করুন এবং ডিম পাড়া শুরু হলে রেজিস্টার্ড ক্লোরান্ট্রানিলিপ্রল বা কার্টাপ স্প্রে করুন।',
        severity: 'High',
      },
    ],
  },

  Jute: {
    diseases: [
      {
        disease: 'Stem rot',
        diseaseBn: 'ডগা পচা রোগ',
        pathogen: 'Macrophomina phaseolina',
        symptomsEn:
          'The base of the stem darkens and rots, the bark peels in shreds, and the plant topples over from the ground up.',
        symptomsBn:
          'ডগার গোড়া কালচে হয়ে পচে যায়, বাক্স খসে খসে পড়ে এবং গাছ গোড়া থেকে ভেঙে পড়ে।',
        lookAlike:
          'Stem borer damage shows a bore hole higher up the stem; stem rot starts at the soil line and the tissue inside is shredded and grey.',
        managementEn:
          'Sow late, avoid dense planting, treat seed with a registered fungicide, and rotate for three years.',
        managementBn:
          'দেরিতে বপন করুন, ঘন বপন এড়িয়ে চলুন, পরীক্ষিত ছত্রাকনাশক দিয়ে বীজ শোধন করুন এবং তিন বছর ফরোটেশন করুন।',
        severity: 'High',
      },
    ],
  },

  Sugarcane: {
    diseases: [
      {
        disease: 'Red rot',
        diseaseBn: 'লাল পচা রোগ',
        pathogen: 'Colletotrichum falcatum',
        symptomsEn:
          'Red internal tissue in the cane with white patches, and the tops dry out ("top rot"); a sour alcoholic smell when the cane is cut.',
        symptomsBn:
          'আখের ভেতরে লাল রঙের টিস্যু ও সাদা ছোপ, আগা শুকিয়ে যায়; আখ কাটলে ভিন্ন গন্ধ আসে।',
        lookAlike:
          'Pokkah boeng causes the top to twist and malform; red rot shows the red internal discolouration with white patches.',
        managementEn:
          'Use disease-free setts, remove and destroy infected clumps, and spray a registered carbendazim or Mancozeb.',
        managementBn:
          'রোগমুক্ত সেট ব্যবহার করুন, আক্রান্ত গুচ্ছ সরিয়ে ধ্বংস করুন এবং রেজিস্টার্ড কার্বেন্ডাজিম বা ম্যাঙ্কোজেব স্প্রে করুন।',
        severity: 'High',
      },
      {
        disease: 'Smut',
        diseaseBn: 'স্মাট',
        pathogen: 'Sporisorium reilianum',
        symptomsEn:
          'A black powdery whip-like growth from the top of the cane, which is destroyed as the smut matures.',
        symptomsBn:
          'আখের ডগা থেকে কালো পাউডারের মতো শিউলি বের হয় এবং স্মাট পাকলে আখ নষ্ট হয়ে যায়।',
        lookAlike:
          'Red rot discolours the inside of the cane; smut is a black external growth from the tip.',
        managementEn:
          'Treat setts with a registered fungicide, remove infected clumps before the whip emerges, and rotate.',
        managementBn:
          'রেজিস্টার্ড ছত্রাকনাশক দিয়ে সেট শোধন করুন, শিউলি বের হওয়ার আগেই আক্রান্ত গুচ্ছ সরান এবং ফরোটেশন করুন।',
        severity: 'Medium',
      },
    ],
  },

  Tea: {
    diseases: [
      {
        disease: 'Blister blight',
        diseaseBn: 'ফোলা রোগ',
        pathogen: 'Exobasidium vexans',
        symptomsEn:
          'Translucent pale blisters on young leaves that turn white with a white powdery underside; young shoots and tea are distorted.',
        symptomsBn:
          'কচি পাতায় স্বচ্ছ ফোলা, পরে সাদা হয়ে নিচে সাদা গুঁড়ো; কচি ও চা পাতা বিকৃত হয়।',
        lookAlike:
          'Red rust (algal leaf spot) is a flat orange-brown patch on the upper leaf surface, not a raised blister.',
        managementEn:
          'Shade management, plucking infected shoots, and a registered copper or hexaconazole spray in the rainy season.',
        managementBn:
          'ছায়া ব্যবস্থাপনা করুন, আক্রান্ত চা ডগা তুলে ফেলুন এবং বর্ষাকালে রেজিস্টার্ড কপার বা হেক্সাকোনাজল স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },

  'Betel Leaf': {
    diseases: [
      {
        disease: 'Phytophthora foot rot',
        diseaseBn: 'শিকড় পচা রোগ',
        pathogen: 'Phytophthora palmivora',
        symptomsEn:
          'The vine base darkens and rots at the soil line, the leaves yellow and fall, and the vine wilts away from the ground up.',
        symptomsBn:
          'মাটির কাছে লতার গোড়া কালচে হয়ে পচে, পাতা হলুদ হয়ে পড়ে এবং লতা গোড়া থেকে শুকিয়ে মরে যায়।',
        lookAlike:
          'Quick wilt (Pythium) kills the vine suddenly in hot weather without the dark wet rot at the collar.',
        managementEn:
          'Improve drainage, mound soil around the base, remove infected vines, and apply a registered metalaxyl + Mancozeb drench.',
        managementBn:
          'নিষ্কাশন উন্নত করুন, গোড়ায় মাটি চাঁদ করুন, আক্রান্ত লতা সরান এবং রেজিস্টার্ড মেটালাক্সিল + ম্যাঙ্কোজেব দিয়ে ড্রেঞ্চ করুন।',
        severity: 'High',
      },
      {
        disease: 'Bacterial leaf spot',
        diseaseBn: 'ব্যাকটেরিয়া পাতার দাগ',
        pathogen: 'Xanthomonas campestris pv. betlicola',
        symptomsEn:
          'Small dark brown angular spots on the leaf that enlarge and turn black; badly affected leaves crack and drop.',
        symptomsBn:
          'পাতায় ছোট গাঢ় বাদামি চৌকো দাগ, পরে কালো হয়ে বড় হয়; আক্রান্ত পাতা ফেটে পড়ে।',
        lookAlike:
          'Anthracnose gives sunken circular spots; bacterial leaf spot is angular and bounded by the veins.',
        managementEn:
          'Remove infected leaves, avoid overhead irrigation, and spray a registered copper oxychloride.',
        managementBn:
          'আক্রান্ত পাতা সরান, উপরে জল দেওয়া এড়িয়ে চলুন এবং রেজিস্টার্ড কপার অক্সিক্লোরাইড স্প্রে করুন।',
        severity: 'Medium',
      },
    ],
  },
};

/**
 * Build the prompt block for one crop.
 *
 * Kept deliberately compact: a trimmed reference works better than the full
 * catalogue, and the closing instruction is what stops the model from simply
 * picking a name off the list.
 */
export const buildCropKnowledge = (cropName: string, lang: 'bn' | 'en'): string => {
  const key = (cropName || '').trim();
  const entry = CROP_KNOWLEDGE[key];
  if (!entry || !entry.diseases.length) return '';

  const lines: string[] = [];
  lines.push(`FIELD REFERENCE — the diseases below are the ones that actually occur on ${key} in Bangladesh.`);
  lines.push('');

  for (const d of entry.diseases) {
    lines.push(`• ${d.disease} (${d.diseaseBn})`);
    lines.push(`  Pathogen: ${d.pathogen}`);
    lines.push(`  Symptoms: ${lang === 'bn' ? d.symptomsBn : d.symptomsEn}`);
    lines.push(`  Often confused with: ${d.lookAlike}`);
    lines.push(`  Management: ${lang === 'bn' ? d.managementBn : d.managementEn}`);
    lines.push(`  Typical severity: ${d.severity}`);
    lines.push('');
  }

  lines.push(
    'Use this reference to CHECK your candidate list — not to pick a name off it. Only report a disease the IMAGE actually shows. If the image does not match any of the conditions above, say so plainly, list the symptoms you can actually see, and set your confidence low so the farmer is sent to an agronomist.'
  );
  lines.push(
    lang === 'bn'
      ? `ঔষধ প্রস্তাব দেওয়ার সময় অপেক্ষমাণ সময় (PHI) উল্লেখ করুন। ${SAAO_BN}`
      : `When you recommend a chemical, state the Pre-Harvest Interval. ${SAAO_EN}`
  );

  return lines.join('\n');
};
