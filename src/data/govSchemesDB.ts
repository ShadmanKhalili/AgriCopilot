export interface GovScheme {
  id: string;
  title: {
    en: string;
    bn: string;
  };
  description: {
    en: string;
    bn: string;
  };
  eligibility: {
    en: string;
    bn: string;
  };
  howToApply: {
    en: string;
    bn: string;
  };
  crops: string[]; // e.g., ['paddy', 'tomato', 'all']
  districts: string[]; // e.g., ['dhaka', 'rajshahi', 'all']
  sourceLinks: string[];
}

export const govSchemesDB: GovScheme[] = [
  {
    id: "dae-fertilizer-subsidy",
    title: {
      en: "BADC Fertilizer Subsidy Program",
      bn: "বিএডিসি সার ভর্তুকি কর্মসূচি"
    },
    description: {
      en: "Government subsidized fertilizers (Urea, TSP, MoP, DAP) provided to registered farmers to reduce production costs and increase yield.",
      bn: "কৃষকদের উৎপাদন খরচ কমাতে এবং ফলন বাড়াতে সরকার নিবন্ধিত কৃষকদের ভর্তুকি মূল্যে সার (ইউরিয়া, টিএসপি, এমওপি, ডিএপি) প্রদান করে।"
    },
    eligibility: {
      en: "Must be a registered farmer with a valid Krishi Card (Agriculture Card). Applicable for all major crops.",
      bn: "অবশ্যই বৈধ কৃষি কার্ডধারী নিবন্ধিত কৃষক হতে হবে। সকল প্রধান ফসলের জন্য প্রযোজ্য।"
    },
    howToApply: {
      en: "Contact your local Sub-Assistant Agriculture Officer (SAAO) or BCIC approved fertilizer dealers with your Krishi Card and NID.",
      bn: "আপনার কৃষি কার্ড এবং এনআইডি সহ স্থানীয় উপ-সহকারী কৃষি কর্মকর্তা (SAAO) বা বিসিআইসি অনুমোদিত সার ডিলারের সাথে যোগাযোগ করুন।"
    },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["http://www.badc.gov.bd/", "http://krishi.gov.bd/"]
  },
  {
    id: "bb-low-interest-loan",
    title: {
      en: "Bangladesh Bank 4% Agricultural Loan",
      bn: "বাংলাদেশ ব্যাংকের ৪% কৃষি ঋণ"
    },
    description: {
      en: "Special low-interest (4%) loan scheme for farmers cultivating import-substitute crops like pulses, oilseeds, spices, and maize.",
      bn: "ডাল, তেলবীজ, মসলা এবং ভুট্টার মতো আমদানি-বিকল্প ফসল চাষকারী কৃষকদের জন্য বিশেষ স্বল্প সুদের (৪%) ঋণ প্রকল্প।"
    },
    eligibility: {
      en: "Farmers cultivating specific crops (chili, onion, etc.). Must have cultivable land and a valid bank account.",
      bn: "নির্দিষ্ট ফসল (মরিচ, পেঁয়াজ ইত্যাদি) চাষকারী কৃষক। চাষযোগ্য জমি এবং একটি বৈধ ব্যাংক অ্যাকাউন্ট থাকতে হবে।"
    },
    howToApply: {
      en: "Apply through any state-owned commercial bank or specialized agricultural banks (like Bangladesh Krishi Bank).",
      bn: "যেকোনো রাষ্ট্রীয় মালিকানাধীন বাণিজ্যিক ব্যাংক বা বিশেষায়িত কৃষি ব্যাংকের (যেমন বাংলাদেশ কৃষি ব্যাংক) মাধ্যমে আবেদন করুন।"
    },
    crops: ["chili", "onion", "potato"],
    districts: ["all"],
    sourceLinks: ["https://www.bb.org.bd/en/index.php/financialactivity/agrifinance", "https://www.krishibank.org.bd/"]
  },
  {
    id: "dae-machinery-subsidy",
    title: {
      en: "Agricultural Machinery Subsidy (Up to 70%)",
      bn: "কৃষি যন্ত্রপাতি ভর্তুকি (৭০% পর্যন্ত)"
    },
    description: {
      en: "Financial assistance to purchase modern agricultural machinery like combined harvesters, reapers, and transplanters. 70% subsidy for Haor/coastal areas, 50% for others.",
      bn: "কম্বাইন্ড হারভেস্টার, রিপার এবং ট্রান্সপ্লান্টারের মতো আধুনিক কৃষি যন্ত্রপাতি কেনার জন্য আর্থিক সহায়তা। হাওর/উপকূলীয় এলাকার জন্য ৭০% এবং অন্যান্য এলাকার জন্য ৫০% ভর্তুকি।"
    },
    eligibility: {
      en: "Individual farmers or farmers' groups. Priority given to paddy and wheat cultivators.",
      bn: "স্বতন্ত্র কৃষক বা কৃষক দল। ধান ও গম চাষিদের অগ্রাধিকার দেওয়া হয়।"
    },
    howToApply: {
      en: "Submit an application to the Upazila Agriculture Officer. Selection is done through the Upazila Agricultural Machinery Distribution Committee.",
      bn: "উপজেলা কৃষি কর্মকর্তার কাছে আবেদন জমা দিন। উপজেলা কৃষি যন্ত্রপাতি বিতরণ কমিটির মাধ্যমে বাছাই করা হয়।"
    },
    crops: ["paddy"],
    districts: ["all"],
    sourceLinks: ["http://www.dae.gov.bd/", "http://www.moa.gov.bd/"]
  },
  {
    id: "bmd-weather-insurance",
    title: {
      en: "Weather Index-Based Crop Insurance",
      bn: "আবহাওয়া সূচক-ভিত্তিক শস্য বীমা"
    },
    description: {
      en: "Insurance coverage against crop loss due to extreme weather events like floods, droughts, or cyclones.",
      bn: "বন্যা, খরা বা ঘূর্ণিঝড়ের মতো চরম আবহাওয়ার কারণে ফসলের ক্ষতির বিরুদ্ধে বীমা কভারেজ।"
    },
    eligibility: {
      en: "Farmers in climate-vulnerable districts. Currently focused on specific regions like Rajshahi (drought) and coastal areas.",
      bn: "জলবায়ু-ঝুঁকিপূর্ণ জেলার কৃষকরা। বর্তমানে রাজশাহী (খরা) এবং উপকূলীয় অঞ্চলের মতো নির্দিষ্ট এলাকায় চালু আছে।"
    },
    howToApply: {
      en: "Enroll through participating NGOs, microfinance institutions, or Sadharan Bima Corporation branches.",
      bn: "অংশগ্রহণকারী এনজিও, ক্ষুদ্রঋণ প্রতিষ্ঠান বা সাধারণ বীমা কর্পোরেশনের শাখাগুলির মাধ্যমে নাম লেখান।"
    },
    crops: ["all"],
    districts: ["rajshahi", "khulna", "barisal", "sylhet", "chittagong"],
    sourceLinks: ["https://sbc.gov.bd/", "https://bmd.gov.bd/"]
  },
  {
    id: "horticulture-export-support",
    title: {
      en: "Horticulture Export Support Scheme",
      bn: "উদ্যানতত্ত্ব রপ্তানি সহায়তা প্রকল্প"
    },
    description: {
      en: "Support for farmers growing high-value fruits and vegetables for export, including training on Good Agricultural Practices (GAP) and certification assistance.",
      bn: "রপ্তানির জন্য উচ্চ মূল্যের ফল ও সবজি চাষকারী কৃষকদের সহায়তা, যার মধ্যে রয়েছে গুড এগ্রিকালচারাল প্র্যাকটিস (GAP) প্রশিক্ষণ এবং সার্টিফিকেশন সহায়তা।"
    },
    eligibility: {
      en: "Commercial farmers growing vegetables like tomato, brinjal, or cucumber for export markets.",
      bn: "বাণিজ্যিক কৃষক যারা রপ্তানি বাজারের জন্য টমেটো, বেগুন বা শসার মতো সবজি চাষ করেন।"
    },
    howToApply: {
      en: "Contact the Department of Agricultural Extension (Horticulture Wing) or local export processing zones.",
      bn: "কৃষি সম্প্রসারণ অধিদপ্তর (হর্টিকালচার উইং) বা স্থানীয় রপ্তানি প্রক্রিয়াকরণ অঞ্চলের সাথে যোগাযোগ করুন।"
    },
    crops: ["tomato", "brinjal", "cucumber", "watermelon"],
    districts: ["dhaka", "comilla", "bogra", "narsingdi"],
    sourceLinks: ["http://www.dae.gov.bd/", "http://www.bapex.com.bd/"]
  },
  {
    id: "idcol-solar-irrigation",
    title: {
      en: "IDCOL Solar Irrigation Pump Project",
      bn: "ইডকল সৌর সেচ পাম্প প্রকল্প"
    },
    description: {
      en: "Provides financial support and grants for installing solar-powered irrigation pumps, reducing dependency on diesel and grid electricity.",
      bn: "ডিজেল এবং গ্রিড বিদ্যুতের উপর নির্ভরতা হ্রাস করে সৌর-চালিত সেচ পাম্প স্থাপনের জন্য আর্থিক সহায়তা এবং অনুদান প্রদান করে।"
    },
    eligibility: {
      en: "Farmers, sponsors, or NGOs with suitable land for pump installation and a group of farmers willing to buy water.",
      bn: "পাম্প স্থাপনের জন্য উপযুক্ত জমি সহ কৃষক, স্পনসর বা এনজিও এবং জল কিনতে ইচ্ছুক একদল কৃষক।"
    },
    howToApply: {
      en: "Apply through IDCOL's Partner Organizations (POs) or directly via the IDCOL website.",
      bn: "ইডকলের পার্টনার অর্গানাইজেশন (PO) এর মাধ্যমে বা সরাসরি ইডকল ওয়েবসাইটের মাধ্যমে আবেদন করুন।"
    },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["https://idcol.org/home/solar_ir"]
  },
  {
    id: "badc-seed-distribution",
    title: {
      en: "BADC Quality Seed Distribution",
      bn: "বিএডিসি মানসম্পন্ন বীজ বিতরণ"
    },
    description: {
      en: "Distribution of high-yielding, climate-resilient, and disease-free seeds at subsidized rates to ensure food security.",
      bn: "খাদ্য নিরাপত্তা নিশ্চিত করতে উচ্চ ফলনশীল, জলবায়ু-সহনশীল এবং রোগমুক্ত বীজ ভর্তুকি মূল্যে বিতরণ।"
    },
    eligibility: {
      en: "All farmers are eligible. Priority is given to marginal and smallholder farmers.",
      bn: "সকল কৃষক যোগ্য। প্রান্তিক ও ক্ষুদ্র কৃষকদের অগ্রাধিকার দেওয়া হয়।"
    },
    howToApply: {
      en: "Purchase directly from BADC seed sales centers or authorized BADC seed dealers across the country.",
      bn: "সরাসরি বিএডিসি বীজ বিক্রয় কেন্দ্র বা সারা দেশে অনুমোদিত বিএডিসি বীজ ডিলারদের কাছ থেকে কিনুন।"
    },
    crops: ["paddy", "potato", "onion", "watermelon"],
    districts: ["all"],
    sourceLinks: ["http://www.badc.gov.bd/"]
  },
  {
    id: "krishi-bank-general-loan",
    title: {
      en: "Bangladesh Krishi Bank (BKB) Crop Loan",
      bn: "বাংলাদেশ কৃষি ব্যাংক (বিকেবি) শস্য ঋণ"
    },
    description: {
      en: "Short-term crop loans provided to farmers for purchasing seeds, fertilizers, pesticides, and bearing irrigation costs.",
      bn: "বীজ, সার, কীটনাশক ক্রয় এবং সেচ খরচ বহনের জন্য কৃষকদের স্বল্পমেয়াদী শস্য ঋণ প্রদান করা হয়।"
    },
    eligibility: {
      en: "Must be a genuine farmer with Krishi Card, NID, and land ownership documents (or sharecropping agreement).",
      bn: "কৃষি কার্ড, এনআইডি এবং জমির মালিকানার নথি (বা বর্গাচাষ চুক্তি) সহ একজন প্রকৃত কৃষক হতে হবে।"
    },
    howToApply: {
      en: "Visit the nearest Bangladesh Krishi Bank (BKB) branch with required documents and passport-size photographs.",
      bn: "প্রয়োজনীয় কাগজপত্র এবং পাসপোর্ট সাইজের ছবি সহ নিকটস্থ বাংলাদেশ কৃষি ব্যাংক (বিকেবি) শাখায় যান।"
    },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["https://www.krishibank.org.bd/crop-loan/"]
  }
];
