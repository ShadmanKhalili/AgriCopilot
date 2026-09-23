/**
 * Offline Cache & Resilience Engine for Rural Agriculture
 * Specially optimized for low-connectivity coastal and rural zones of Cox's Bazar
 * (Chakaria, Ramu, Teknaf, Ukhia, Cox's Bazar Sadar, Maheshkhali, Pekua, Kutubdia).
 */

const WEATHER_CACHE_PREFIX = 'agri_cached_weather_';
const MARKET_CACHE_PREFIX = 'agri_cached_market_';
const GLOBAL_SYNC_KEY = 'agri_last_sync_timestamp';
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 72; // 72 hours cache retention

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  locationKey: string;
  isFallback?: boolean;
}

/**
 * Pre-seeded emergency fallback weather data for rural Cox's Bazar
 * when both network and user cache are unavailable.
 */
export const COX_BAZAR_OFFLINE_WEATHER: Record<string, any> = {
  temp: 28,
  condition: 'Partly Cloudy',
  humidity: 78,
  windSpeed: 14,
  rainfall: 0,
  rainChance: 25,
  uvIndex: 7,
  locationName: "কক্সবাজার উপকূলীয় কৃষি অঞ্চল (Cox's Bazar Coastal Zone)",
  soilMoisture: 0.28,
  evapotranspiration: 4.2,
  safeSprayingWindow: "সকাল ৬:৩০ - ৯:১৫ (বাতাস শান্ত ও পাতার আর্দ্রতা বালাইনাশক প্রয়োগের উপযুক্ত)",
  dewPoint: 22,
  fungalBlightRisk: 'Moderate',
  ensembleConfidence: 85,
  heavyRainRisk: 15,
  hourlyForecast: [
    { time: '6 AM', temp: 24, humidity: 86, rainProb: 10, wind: 8, condition: 'Sunny' },
    { time: '9 AM', temp: 27, humidity: 76, rainProb: 15, wind: 11, condition: 'Sunny' },
    { time: '12 PM', temp: 30, humidity: 68, rainProb: 20, wind: 15, condition: 'Partly Cloudy' },
    { time: '3 PM', temp: 29, humidity: 72, rainProb: 25, wind: 16, condition: 'Partly Cloudy' },
    { time: '6 PM', temp: 27, humidity: 80, rainProb: 20, wind: 12, condition: 'Partly Cloudy' },
    { time: '9 PM', temp: 25, humidity: 85, rainProb: 10, wind: 9, condition: 'Clear' }
  ]
};

/**
 * Pre-seeded emergency fallback market insights for major crops in Cox's Bazar regional mandis.
 */
export const COX_BAZAR_OFFLINE_MARKET: Record<string, any> = {
  potato: {
    insights: `### 🥔 আলুর সামগ্রিক বাজার বিশ্লেষণ (মোকাম বনাম সুপারমার্কেট)
* **কারওয়ান বাজার পাইকারি আড়ৎ**: ৳২৮ - ৳৩৩ / কেজি
* **কস্তুরী ঘাট পাইকারি আড়ৎ (সদর)**: ৳২৯ - ৳৩২ / কেজি
* **স্বপ্ন (Shwapno) সুপারমার্কেট**: ৳৫০ / কেজি (প্রিমিয়াম গ্রেডেড প্যাকেট)
* **মীনা বাজার (Meena Bazar)**: ৳৫২ / কেজি (নেট ব্যাগ)
* **আগোরা (Agora) সুপারমার্কেট**: ৳৫৫ / কেজি
* **চালডাল (Chaldal)**: ৳৪৮ / কেজি

**বাজারের গতিপ্রকৃতি**: উত্তরাঞ্চল থেকে নিয়মিত ট্রাক সরবরাহ আসায় পাইকারি মোকামে দাম স্থিতিশীল। তবে সুপারমার্কেট ও রিটেইল চেইনে গ্রেডিং ও প্যাকেজিংয়ের কারণে প্রায় ৬৮% বেশি মূল্যে বিক্রি হচ্ছে।`,
    priceRange: { min: 28, max: 33, avg: 31, unit: 'kg' },
    trend: 'stable',
    wholesaleRates: { minPriceBdt: 28, maxPriceBdt: 33, avgPriceBdt: 31, unit: 'kg', primaryMarket: 'কারওয়ান বাজার (ঢাকা)', trend: 'স্থিতিশীল' },
    supermarketRates: { minPriceBdt: 48, maxPriceBdt: 55, avgPriceBdt: 51, unit: 'kg', trend: 'স্থিতিশীল' },
    supermarkets: [
      { name: 'স্বপ্ন (Shwapno)', pricePerKgBdt: 50, packagingType: 'প্রিমিয়াম গ্রেডেড প্যাকেট', stockStatus: 'পর্যাপ্ত মজুদ', websiteUrl: 'shwapno.com' },
      { name: 'মীনা বাজার (Meena Bazar)', pricePerKgBdt: 52, packagingType: 'নেট ব্যাগ প্যাক', stockStatus: 'ইন স্টক', websiteUrl: 'meenabazaronline.com' },
      { name: 'আগোরা (Agora)', pricePerKgBdt: 55, packagingType: 'বাছাইকৃত খোলা', stockStatus: 'ইন স্টক', websiteUrl: 'agorasuperstores.com' },
      { name: 'চালডাল (Chaldal)', pricePerKgBdt: 48, packagingType: 'রেগুলার ১ কেজি', stockStatus: 'দ্রুত ডেলিভারি', websiteUrl: 'chaldal.com' }
    ],
    mandiHubs: [
      { mandiName: 'কারওয়ান বাজার (ঢাকা)', wholesalePriceBdt: 31, arrivalVolume: 'পর্যাপ্ত (২৫+ ট্রাক)', trend: 'স্থিতিশীল' },
      { mandiName: 'শ্যামবাজার (ঢাকা)', wholesalePriceBdt: 30, arrivalVolume: 'স্বাভাবিক', trend: 'স্থিতিশীল' },
      { mandiName: 'খাতুনগঞ্জ (চট্টগ্রাম)', wholesalePriceBdt: 32, arrivalVolume: 'মাঝারি', trend: 'স্থিতিশীল' },
      { mandiName: 'কস্তুরী ঘাট (কক্সবাজার সদর)', wholesalePriceBdt: 32, arrivalVolume: 'নিয়মিত চালান', trend: 'স্থিতিশীল' }
    ],
    marginSpread: {
      spreadPercentage: 65,
      middlemanMarkupEstimate: 'পাইকারি মোকাম থেকে সুপারমার্কেটের শেলফ পর্যন্ত প্রায় ৬৫% মূল্যবৃদ্ধি ঘটে গ্রেডিং ও কোল্ড স্টোরেজের কারণে।',
      farmerDirectOpportunity: 'গ্রেড-১ আলু সরাসরি সুপারমার্কেটের কন্ট্রাক্ট ফার্মিং ভেন্ডরকে দিলে কেজিতে ৳৮-৳১০ বেশি পাওয়া যায়।'
    },
    priceDrivers: [
      'উত্তরাঞ্চলের হিমাগার থেকে নিয়মিত আলু সরবরাহ বহাল',
      'পরিবহন ভাড়া স্থিতিশীল থাকায় মোকামে সরবরাহ স্বাভাবিক',
      'সুপারশপগুলোতে গ্রেডেড ও ধোয়া আলুর ধারাবাহিক চাহিদা'
    ],
    farmerActionTips: [
      'মাঠেই গ্রেডিং করে বড় ও দাগমুক্ত আলু আলাদা করলে প্রিমিয়াম দর নিশ্চিত হবে।',
      'আড়তে পাঠানোর জন্য মধ্যরাতের আগে ট্রাক লোডিং সম্পন্ন করুন।'
    ]
  },
  tomato: {
    insights: `### 🍅 টমেটোর বাজারদর ও সুপারমার্কেট ট্রেন্ড
* **কারওয়ান বাজার পাইকারি আড়ৎ**: ৳৩৫ - ৳৪২ / কেজি
* **চকরিয়া কাঁচাবাজার আড়ৎ**: ৳৩৫ - ৳৪০ / কেজি
* **স্বপ্ন (Shwapno)**: ৳৬৫ / কেজি (সালাদ টমেটো)
* **মীনা বাজার (Meena Bazar)**: ৳৬৮ / কেজি
* **আগোরা (Agora)**: ৳৭০ / কেজি
* **চালডাল (Chaldal)**: ৳৬২ / কেজি

**বাজারের গতিপ্রকৃতি**: স্থানীয় মাতামুহুরী নদী অববাহিকার নতুন শীতকালীন টমেটোর চাহিদা চাঙ্গা। সুপারমার্কেটে পাকা উজ্জ্বল লাল টমেটো আকর্ষণীয় মূল্যে বিক্রি হচ্ছে।`,
    priceRange: { min: 35, max: 42, avg: 39, unit: 'kg' },
    trend: 'up',
    wholesaleRates: { minPriceBdt: 35, maxPriceBdt: 42, avgPriceBdt: 39, unit: 'kg', primaryMarket: 'কারওয়ান বাজার', trend: 'উর্ধ্বমুখী' },
    supermarketRates: { minPriceBdt: 62, maxPriceBdt: 70, avgPriceBdt: 66, unit: 'kg', trend: 'উর্ধ্বমুখী' },
    supermarkets: [
      { name: 'স্বপ্ন (Shwapno)', pricePerKgBdt: 65, packagingType: 'সালাদ স্পেশাল প্যাকেট', stockStatus: 'ইন স্টক', websiteUrl: 'shwapno.com' },
      { name: 'মীনা বাজার (Meena Bazar)', pricePerKgBdt: 68, packagingType: 'প্রিমিয়াম বাছাই', stockStatus: 'ইন স্টক', websiteUrl: 'meenabazaronline.com' },
      { name: 'আগোরা (Agora)', pricePerKgBdt: 70, packagingType: 'ট্রে প্যাক', stockStatus: 'ইন স্টক', websiteUrl: 'agorasuperstores.com' },
      { name: 'চালডাল (Chaldal)', pricePerKgBdt: 62, packagingType: 'ফ্রেশ ১ কেজি', stockStatus: 'দ্রুত ডেলিভারি', websiteUrl: 'chaldal.com' }
    ],
    mandiHubs: [
      { mandiName: 'কারওয়ান বাজার (ঢাকা)', wholesalePriceBdt: 39, arrivalVolume: 'মাঝারি', trend: 'উর্ধ্বমুখী' },
      { mandiName: 'শ্যামবাজার (ঢাকা)', wholesalePriceBdt: 38, arrivalVolume: 'মাঝারি', trend: 'উর্ধ্বমুখী' },
      { mandiName: 'চকরিয়া কাঁচাবাজার', wholesalePriceBdt: 37, arrivalVolume: 'স্থানীয় ফলন', trend: 'স্থিতিশীল' },
      { mandiName: 'খাতুনগঞ্জ (চট্টগ্রাম)', wholesalePriceBdt: 41, arrivalVolume: 'উচ্চ চাহিদা', trend: 'উর্ধ্বমুখী' }
    ],
    marginSpread: {
      spreadPercentage: 69,
      middlemanMarkupEstimate: 'কাঁচামাল নষ্ট হওয়ার ঝুঁকি (পোস্ট-হারভেস্ট লস) ও কুলিং ভ্যানের ব্যয়ের কারণে রিটেইল চেইনে ৬৯% ব্যবধান।',
      farmerDirectOpportunity: 'প্লাস্টিক ক্রেটে গ্রেডিং করে সরাসরি সুপারমার্কেট সাপ্লাই চেইনে দিলে নষ্ট হওয়ার হার ৮০% কমে যায়।'
    },
    priceDrivers: [
      'শীতকালীন শেষ প্রান্তের পাকা টমেটোর তীব্র খুচরা চাহিদা',
      'সুপারমার্কেটে দাগহীন ফ্রেশ গ্রেড-১ টমেটোর জন্য প্রিমিয়াম বিড',
      'দূরবর্তী জেলায় পরিবহনে কুলিং ক্রেটের সংকট'
    ],
    farmerActionTips: [
      'আধাপাকা (টপ পিংক) অবস্থায় হারভেস্ট করুন যাতে পরিবহনে নষ্ট না হয়।',
      'পাটের বস্তার পরিবর্তে প্লাস্টিক ক্রেট ব্যবহার করে আড়তদারের কাছে ভালো দর দাবি করুন।'
    ]
  },
  paddy: {
    insights: `### 🌾 ধান ও চালের পাইকারি মোকাম পরিস্থিতি
* **কারওয়ান বাজার চালের আড়ৎ**: ৳৫৮ - ৳৬৫ / কেজি (মিনিকেট/নাজিরশাইল পাইকারি)
* **খাতুনগঞ্জ বাণিজ্যিক আড়ৎ**: ৳৫৭ - ৳৬৩ / কেজি
* **চকরিয়া মাতামুহুরী ধান আড়ৎ**: ৳১,২০০ - ৳১,২৭০ / মণ (৪০ কেজি)
* **স্বপ্ন (Shwapno)**: ৳৭৮ / কেজি (প্যাকেটজাত প্রিমিয়াম চাল)
* **মীনা বাজার (Meena Bazar)**: ৳৮২ / কেজি
* **চালডাল (Chaldal)**: ৳৭৫ / কেজি

**বাজারের গতিপ্রকৃতি**: চালকল মিলারদের সক্রিয় ক্রয়ের কারণে মোটা ও মাঝারি ধানের পাইকারি মোকাম চাঙ্গা। সুপারমার্কেটে ব্র্যান্ডেড পলিব্যাগ চাল উচ্চ মূল্যে স্থিতিশীল।`,
    priceRange: { min: 1180, max: 1270, avg: 1225, unit: 'maund' },
    trend: 'up',
    wholesaleRates: { minPriceBdt: 30, maxPriceBdt: 34, avgPriceBdt: 32, unit: 'kg', primaryMarket: 'খাতুনগঞ্জ ও চকরিয়া', trend: 'উর্ধ্বমুখী' },
    supermarketRates: { minPriceBdt: 75, maxPriceBdt: 82, avgPriceBdt: 78, unit: 'kg', trend: 'স্থিতিশীল' },
    supermarkets: [
      { name: 'স্বপ্ন (Shwapno)', pricePerKgBdt: 78, packagingType: '৫ কেজি ব্র‍্যান্ডেড ব্যাগ', stockStatus: 'ইন স্টক', websiteUrl: 'shwapno.com' },
      { name: 'মীনা বাজার (Meena Bazar)', pricePerKgBdt: 82, packagingType: 'প্রিমিয়াম সিলড ব্যাগ', stockStatus: 'ইন স্টক', websiteUrl: 'meenabazaronline.com' },
      { name: 'আগোরা (Agora)', pricePerKgBdt: 80, packagingType: 'অ্যারোমেটিক সিলড প্যাক', stockStatus: 'ইন স্টক', websiteUrl: 'agorasuperstores.com' },
      { name: 'চালডাল (Chaldal)', pricePerKgBdt: 75, packagingType: 'স্ট্যান্ডার্ড ৫ কেজি', stockStatus: 'পর্যাপ্ত মজুদ', websiteUrl: 'chaldal.com' }
    ],
    mandiHubs: [
      { mandiName: 'খাতুনগঞ্জ (চট্টগ্রাম)', wholesalePriceBdt: 33, arrivalVolume: 'পর্যাপ্ত চালান', trend: 'উর্ধ্বমুখী' },
      { mandiName: 'কারওয়ান বাজার (ঢাকা)', wholesalePriceBdt: 32, arrivalVolume: 'নিয়মিত', trend: 'উর্ধ্বমুখী' },
      { mandiName: 'চকরিয়া মাতামুহুরী মোকাম', wholesalePriceBdt: 31, arrivalVolume: 'স্থানীয় হাট', trend: 'স্থিতিশীল' }
    ],
    marginSpread: {
      spreadPercentage: 140,
      middlemanMarkupEstimate: 'ধান মিলিং, পলিশিং, ব্র্যান্ডিং এবং সুপারশপ লিস্টিং ফির কারণে ধান থেকে খুচরা চালের মূল্যে ১৪০% বিস্তার তৈরি হয়।',
      farmerDirectOpportunity: 'কৃষক সমিতি তৈরি করে স্থানীয় অটো রাইস মিলে কাস্টম মিলিং করালে ২০-২৫% বেশি লাভ অর্জিত হয়।'
    },
    priceDrivers: [
      'সরকারি সংগ্রহ অভিযান ও মিলারদের প্রতিযোগিতা',
      'শুকনা চিকন ধানের পাইকারি মজুদে বড় করপোরেটদের সক্রিয়তা'
    ],
    farmerActionTips: [
      'আর্দ্রতা ১৪% এর নিচে না নামা পর্যন্ত ধান রোদে শুকিয়ে বায়ুরোধী ড্রামে সংরক্ষণ করুন।',
      'আড়তে বিক্রির সময় আর্দ্রতা পরিমাপক যন্ত্র দিয়ে মেপে ন্যায্য মূল্য নিশ্চিত করুন।'
    ]
  },
  brinjal: {
    insights: `### 🍆 বেগুন মোকাম ও সুপারমার্কেট দর
* **কারওয়ান বাজার পাইকারি আড়ৎ**: ৳৪২ - ৳৫০ / কেজি
* **শ্যামবাজার পাইকারি মোকাম**: ৳৪০ - ৳৪৬ / কেজি
* **স্বপ্ন (Shwapno)**: ৳৭০ / কেজি
* **মীনা বাজার (Meena Bazar)**: ৳৭২ / কেজি
* **আগোরা (Agora)**: ৳৭৫ / কেজি
* **চালডাল (Chaldal)**: ৳৬৮ / কেজি

**বাজারের গতিপ্রকৃতি**: চকচকে গোল বেগুনের পাইকারি চাহিদা বেশি। সুপারমার্কেটে পোকার ছিদ্রমুক্ত প্রিমিয়াম গোল বেগুন প্রায় ৭৫% বেশি মূল্যে বিক্রি হচ্ছে।`,
    priceRange: { min: 40, max: 50, avg: 45, unit: 'kg' },
    trend: 'stable',
    wholesaleRates: { minPriceBdt: 40, maxPriceBdt: 50, avgPriceBdt: 45, unit: 'kg', primaryMarket: 'কারওয়ান বাজার', trend: 'স্থিতিশীল' },
    supermarketRates: { minPriceBdt: 68, maxPriceBdt: 75, avgPriceBdt: 71, unit: 'kg', trend: 'স্থিতিশীল' },
    supermarkets: [
      { name: 'স্বপ্ন (Shwapno)', pricePerKgBdt: 70, packagingType: 'বাছাইকৃত খোলা', stockStatus: 'ইন স্টক', websiteUrl: 'shwapno.com' },
      { name: 'মীনা বাজার (Meena Bazar)', pricePerKgBdt: 72, packagingType: 'প্রিমিয়াম প্যাক', stockStatus: 'ইন স্টক', websiteUrl: 'meenabazaronline.com' },
      { name: 'আগোরা (Agora)', pricePerKgBdt: 75, packagingType: 'গ্রেড-১ নেট ব্যাগ', stockStatus: 'ইন স্টক', websiteUrl: 'agorasuperstores.com' },
      { name: 'চালডাল (Chaldal)', pricePerKgBdt: 68, packagingType: 'রেগুলার ফ্রেশ', stockStatus: 'পর্যাপ্ত মজুদ', websiteUrl: 'chaldal.com' }
    ],
    mandiHubs: [
      { mandiName: 'কারওয়ান বাজার (ঢাকা)', wholesalePriceBdt: 46, arrivalVolume: 'পর্যাপ্ত', trend: 'স্থিতিশীল' },
      { mandiName: 'শ্যামবাজার (ঢাকা)', wholesalePriceBdt: 43, arrivalVolume: 'নিয়মিত', trend: 'স্থিতিশীল' },
      { mandiName: 'কস্তুরী ঘাট (কক্সবাজার)', wholesalePriceBdt: 45, arrivalVolume: 'মাঝারি', trend: 'স্থিতিশীল' }
    ],
    marginSpread: {
      spreadPercentage: 58,
      middlemanMarkupEstimate: 'সুপারশপে কঠোর গুণমান ফিল্টারিংয়ের কারণে পাইকারি থেকে ৫৮% দামের ব্যবধান থাকে।',
      farmerDirectOpportunity: 'ক্ষতিকর রাসায়নিকমুক্ত সার্টিফিকেট থাকলে সুপারশপ ভেন্ডররা সরাসরি খেত থেকেই অগ্রিম তুলে নেয়।'
    },
    priceDrivers: [
      'পোকা-মুক্ত চকচকে গোল বেগুনের রেস্তোরাঁ ও রিটেইল চাহিদা',
      'বিকেলের হারভেস্টের তাজা বেগুন রাতের মোকামে প্রিমিয়াম দরে বিক্রি'
    ],
    farmerActionTips: [
      'বিকালের দিকে তুলে ছায়াযুক্ত স্থানে ঠান্ডা করে রাতের ট্রাকে পাঠান।'
    ]
  },
  chili: {
    insights: `### 🌶️ কাঁচা মরিচ বাজারদর ও সুপারমার্কেট বিশ্লেষণ
* **কারওয়ান বাজার পাইকারি আড়ৎ**: ৳৯০ - ৳১১০ / কেজি
* **খাতুনগঞ্জ আড়ৎ**: ৳৯৫ - ৳১১৫ / কেজি
* **স্বপ্ন (Shwapno)**: ৳১৬০ / কেজি (প্যাকেট ২৫০ গ্রাম ৳৪০)
* **মীনা বাজার (Meena Bazar)**: ৳১৬৫ / কেজি
* **আগোরা (Agora)**: ৳১৭০ / কেজি
* **চালডাল (Chaldal)**: ৳১৫০ / কেজি

**বাজারের গতিপ্রকৃতি**: কাঁচা মরিচের দাম খুচরা ও সুপারমার্কেটে চড়া। বোঁটাযুক্ত তাজা সবুজ মরিচ সর্বোচ্চ মূল্যে বিক্রি হচ্ছে।`,
    priceRange: { min: 90, max: 110, avg: 100, unit: 'kg' },
    trend: 'up',
    wholesaleRates: { minPriceBdt: 90, maxPriceBdt: 110, avgPriceBdt: 100, unit: 'kg', primaryMarket: 'কারওয়ান বাজার', trend: 'উর্ধ্বমুখী' },
    supermarketRates: { minPriceBdt: 150, maxPriceBdt: 170, avgPriceBdt: 161, unit: 'kg', trend: 'উর্ধ্বমুখী' },
    supermarkets: [
      { name: 'স্বপ্ন (Shwapno)', pricePerKgBdt: 160, packagingType: '২৫০ গ্রাম সিথ্রু পাউচ', stockStatus: 'ইন স্টক', websiteUrl: 'shwapno.com' },
      { name: 'মীনা বাজার (Meena Bazar)', pricePerKgBdt: 165, packagingType: 'গ্রেড-১ এয়ার প্যাক', stockStatus: 'ইন স্টক', websiteUrl: 'meenabazaronline.com' },
      { name: 'আগোরা (Agora)', pricePerKgBdt: 170, packagingType: 'সিলেক্টেড গ্রিন', stockStatus: 'ইন স্টক', websiteUrl: 'agorasuperstores.com' },
      { name: 'চালডাল (Chaldal)', pricePerKgBdt: 150, packagingType: 'ফ্রেশ প্যাক ৫০০ গ্রাম', stockStatus: 'দ্রুত ডেলিভারি', websiteUrl: 'chaldal.com' }
    ],
    mandiHubs: [
      { mandiName: 'কারওয়ান বাজার (ঢাকা)', wholesalePriceBdt: 105, arrivalVolume: 'মাঝারি', trend: 'উর্ধ্বমুখী' },
      { mandiName: 'খাতুনগঞ্জ (চট্টগ্রাম)', wholesalePriceBdt: 110, arrivalVolume: 'স্বল্প', trend: 'উর্ধ্বমুখী' },
      { mandiName: 'চকরিয়া পাইকারি বাজার', wholesalePriceBdt: 98, arrivalVolume: 'নিয়মিত', trend: 'উর্ধ্বমুখী' }
    ],
    marginSpread: {
      spreadPercentage: 60,
      middlemanMarkupEstimate: 'খুচরা সুপারশপে ২৫০ গ্রাম ছোট প্যাকে বিক্রি হওয়ায় প্রতি কেজিতে ৳৫০-৳৬০ মার্জিন যোগ হয়।',
      farmerDirectOpportunity: 'বোঁটা অক্ষত রেখে শুকনা প্যাকিং করলে সুপারশপ সরবরাহকারীরা ২০% বাড়তি দর অফার করে।'
    },
    priceDrivers: [
      'উপকূলীয় অঞ্চলে স্থানীয় সরবরাহ সীমিত',
      'বৃষ্টিপাত না থাকায় শুকনা ঝাল মরিচের চমৎকার সেলফ লাইফ'
    ],
    farmerActionTips: [
      'ভেজা অবস্থায় মরিচ বস্তায় ভরবেন না; শুকনা অবস্থায় ছিদ্রযুক্ত প্লাস্টিক জুরিতে বাজারজাত করুন।'
    ]
  },
  watermelon: {
    insights: `### 🍉 তরমুজ পাইকারি মোকাম ও সুপারমার্কেট দর
* **কারওয়ান বাজার তরমুজ আড়ৎ**: ৳৩০ - ৳৩৮ / কেজি
* **কস্তুরী ঘাট পাইকারি বাজার**: ৳৩৩ - ৳৩৯ / কেজি
* **স্বপ্ন (Shwapno)**: ৳৫৫ / কেজি (মিষ্টি কাটিং গ্যারান্টি)
* **মীনা বাজার (Meena Bazar)**: ৳৫৮ / কেজি
* **আগোরা (Agora)**: ৳৬০ / কেজি
* **চালডাল (Chaldal)**: ৳৫২ / কেজি

**বাজারের গতিপ্রকৃতি**: গ্রীষ্মের শুরুতে তরমুজের চাহিদা তুঙ্গে। সুপারমার্কেটে ৫ কেজির উপরের তরমুজ কেজি প্রতি ৫৫-৬০ টাকায় বিক্রি হচ্ছে।`,
    priceRange: { min: 30, max: 38, avg: 34, unit: 'kg' },
    trend: 'up',
    wholesaleRates: { minPriceBdt: 30, maxPriceBdt: 38, avgPriceBdt: 34, unit: 'kg', primaryMarket: 'কারওয়ান বাজার', trend: 'উর্ধ্বমুখী' },
    supermarketRates: { minPriceBdt: 52, maxPriceBdt: 60, avgPriceBdt: 56, unit: 'kg', trend: 'উর্ধ্বমুখী' },
    supermarkets: [
      { name: 'স্বপ্ন (Shwapno)', pricePerKgBdt: 55, packagingType: 'গ্রেডেড পুরো তরমুজ', stockStatus: 'উচ্চ চাহিদা', websiteUrl: 'shwapno.com' },
      { name: 'মীনা বাজার (Meena Bazar)', pricePerKgBdt: 58, packagingType: 'মিষ্টি গ্যারান্টি প্যাক', stockStatus: 'ইন স্টক', websiteUrl: 'meenabazaronline.com' },
      { name: 'আগোরা (Agora)', pricePerKgBdt: 60, packagingType: 'সিলেক্টেড প্রিমিয়াম', stockStatus: 'ইন স্টক', websiteUrl: 'agorasuperstores.com' },
      { name: 'চালডাল (Chaldal)', pricePerKgBdt: 52, packagingType: 'গোটা পিস ওজনে', stockStatus: 'পর্যাপ্ত মজুদ', websiteUrl: 'chaldal.com' }
    ],
    mandiHubs: [
      { mandiName: 'কারওয়ান বাজার (ঢাকা)', wholesalePriceBdt: 36, arrivalVolume: 'উচ্চ চালান', trend: 'উর্ধ্বমুখী' },
      { mandiName: 'চকরিয়া পাইকারি মোকাম', wholesalePriceBdt: 34, arrivalVolume: 'মাঝারি', trend: 'উর্ধ্বমুখী' },
      { mandiName: 'কক্সবাজার পৌর পাইকারি বাজার', wholesalePriceBdt: 35, arrivalVolume: 'পর্যটন চাহিদা', trend: 'উর্ধ্বমুখী' }
    ],
    marginSpread: {
      spreadPercentage: 64,
      middlemanMarkupEstimate: 'পরিবহনে ফেটে যাওয়া ও ওজনের ঘাটতির ঝুঁকি কাভার করতে রিটেইল চেইনে ৬৪% মার্জিন রাখা হয়।',
      farmerDirectOpportunity: 'সরাসরি ওজন স্কেলে মেপে পাইকারদের সঙ্গে চুক্তি করুন, পিস হিসেবে বিক্রি পরিহার করুন।'
    },
    priceDrivers: [
      'তীব্র রোদ ও রমজান/গ্রীষ্মকালীন বাড়তি তরল চাহিদা',
      '৪-৬ কেজি ওজনের তরমুজের জন্য বড় সুপারমার্কেটের আগাম বুকিং'
    ],
    farmerActionTips: [
      'খেতে পাকা তরমুজ সকালে তাপমাত্রা বাড়ার আগেই হারভেস্ট করুন।'
    ]
  }
};

export function recordGlobalSync(timestamp: number = Date.now()): void {
  try {
    localStorage.setItem(GLOBAL_SYNC_KEY, timestamp.toString());
  } catch (err) {
    console.warn('Failed to record global sync time:', err);
  }
}

/**
 * Save weather data into localStorage with timestamp and coordinates identifier
 */
export function saveCachedWeather(locationKey: string, data: any): void {
  try {
    const now = Date.now();
    const entry: CacheEntry<any> = {
      data,
      timestamp: now,
      locationKey,
      isFallback: false
    };
    localStorage.setItem(WEATHER_CACHE_PREFIX + locationKey, JSON.stringify(entry));
    // Also store as latest default cache
    localStorage.setItem(WEATHER_CACHE_PREFIX + 'latest', JSON.stringify(entry));
    recordGlobalSync(now);
  } catch (err) {
    console.warn('Failed to cache weather to localStorage:', err);
  }
}

/**
 * Retrieve cached weather data. If key doesn't match or network is unavailable,
 * returns latest cache or the emergency Cox's Bazar offline model.
 */
export function getCachedWeather(locationKey: string): CacheEntry<any> | null {
  try {
    const exact = localStorage.getItem(WEATHER_CACHE_PREFIX + locationKey);
    if (exact) {
      const parsed: CacheEntry<any> = JSON.parse(exact);
      if (Date.now() - parsed.timestamp < MAX_CACHE_AGE_MS) {
        return parsed;
      }
    }

    const latest = localStorage.getItem(WEATHER_CACHE_PREFIX + 'latest');
    if (latest) {
      const parsed: CacheEntry<any> = JSON.parse(latest);
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read cached weather:', err);
  }

  // Emergency rural Cox's Bazar fallback
  return {
    data: COX_BAZAR_OFFLINE_WEATHER,
    timestamp: Date.now() - (1000 * 60 * 35), // marked as 35 mins ago
    locationKey: 'cox_bazar_default',
    isFallback: true
  };
}

/**
 * Save market insights to localStorage
 */
export function saveCachedMarket(cropKey: string, locationKey: string, data: any): void {
  try {
    const now = Date.now();
    const storageKey = `${MARKET_CACHE_PREFIX}${cropKey.toLowerCase()}_${locationKey}`;
    const entry: CacheEntry<any> = {
      data,
      timestamp: now,
      locationKey,
      isFallback: false
    };
    localStorage.setItem(storageKey, JSON.stringify(entry));
    localStorage.setItem(`${MARKET_CACHE_PREFIX}${cropKey.toLowerCase()}_latest`, JSON.stringify(entry));
    recordGlobalSync(now);
  } catch (err) {
    console.warn('Failed to cache market insights:', err);
  }
}

/**
 * Retrieve cached market insights
 */
export function getCachedMarket(cropKey: string, locationKey: string): CacheEntry<any> | null {
  const normCrop = cropKey.toLowerCase();
  try {
    const exactKey = `${MARKET_CACHE_PREFIX}${normCrop}_${locationKey}`;
    const exact = localStorage.getItem(exactKey);
    if (exact) {
      const parsed: CacheEntry<any> = JSON.parse(exact);
      return parsed;
    }

    const latest = localStorage.getItem(`${MARKET_CACHE_PREFIX}${normCrop}_latest`);
    if (latest) {
      const parsed: CacheEntry<any> = JSON.parse(latest);
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read cached market insights:', err);
  }

  // Check pre-seeded fallback
  const fallback = COX_BAZAR_OFFLINE_MARKET[normCrop];
  if (fallback) {
    return {
      data: fallback,
      timestamp: Date.now() - (1000 * 60 * 60 * 2), // 2 hours ago
      locationKey: 'cox_bazar_default',
      isFallback: true
    };
  }

  // Generic fallback if crop isn't pre-seeded
  return {
    data: {
      insights: `### 🌾 কক্সবাজার আঞ্চলিক বাজার পর্যবেক্ষণ (অফলাইন মোড)\n* স্থানীয় চকরিয়া ও কস্তুরী ঘাট আড়তে এ ফসলের চাহিদা মাঝারি থেকে স্থিতিশীল।\n* অনলাইন সংযোগ পাওয়া মাত্রই রিয়েল-টাইম এআই অ্যানালাইসিস স্বয়ংক্রিয়ভাবে আপডেট হবে।`,
      priceRange: { min: 30, max: 40, avg: 35, unit: 'kg' },
      trend: 'stable'
    },
    timestamp: Date.now() - (1000 * 60 * 60 * 3),
    locationKey: 'cox_bazar_default',
    isFallback: true
  };
}

/**
 * User-friendly relative time formatter in Bengali and English
 */
export function formatCacheAge(timestamp: number, lang: 'bn' | 'en'): string {
  const diffMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / (1000 * 60)));
  
  if (diffMinutes < 60) {
    return lang === 'bn' 
      ? `${toBengaliDigits(diffMinutes)} মিনিট আগের ক্যাশ` 
      : `Cached ${diffMinutes}m ago`;
  }
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return lang === 'bn' 
      ? `${toBengaliDigits(diffHours)} ঘণ্টা আগের ক্যাশ` 
      : `Cached ${diffHours}h ago`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  return lang === 'bn' 
    ? `${toBengaliDigits(diffDays)} দিন আগের ক্যাশ` 
    : `Cached ${diffDays}d ago`;
}

function toBengaliDigits(num: number): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().split('').map(d => bnDigits[parseInt(d, 10)] ?? d).join('');
}

/**
 * Returns the most recent synchronization timestamp from localStorage
 */
export function getLastSyncTimestamp(): number | null {
  try {
    const saved = localStorage.getItem(GLOBAL_SYNC_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    // Inspect weather or market cache timestamps
    let maxTs = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(WEATHER_CACHE_PREFIX) || key.startsWith(MARKET_CACHE_PREFIX))) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item && item.timestamp && item.timestamp > maxTs) {
            maxTs = item.timestamp;
          }
        } catch (_) {}
      }
    }
    return maxTs > 0 ? maxTs : null;
  } catch (err) {
    console.warn('Failed to get last sync timestamp:', err);
    return null;
  }
}

export interface CacheSummary {
  lastSyncTimestamp: number | null;
  weatherEntriesCount: number;
  marketEntriesCount: number;
  totalEntries: number;
  estimatedSizeKb: number;
  isOnline: boolean;
  hasServiceWorkerCache: boolean;
}

/**
 * Inspects all local cache entries and sizes for the Data Status view
 */
export async function getCacheSummary(): Promise<CacheSummary> {
  let weatherCount = 0;
  let marketCount = 0;
  let totalBytes = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        if (key.startsWith(WEATHER_CACHE_PREFIX)) {
          weatherCount++;
          const val = localStorage.getItem(key) || '';
          totalBytes += (key.length + val.length) * 2;
        } else if (key.startsWith(MARKET_CACHE_PREFIX)) {
          marketCount++;
          const val = localStorage.getItem(key) || '';
          totalBytes += (key.length + val.length) * 2;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading localStorage keys for cache summary:', e);
  }

  let hasSwCache = false;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      hasSwCache = keys.some(k => k.includes('agri-') || k.includes('workbox'));
    } catch (_) {}
  }

  return {
    lastSyncTimestamp: getLastSyncTimestamp(),
    weatherEntriesCount: weatherCount,
    marketEntriesCount: marketCount,
    totalEntries: weatherCount + marketCount,
    estimatedSizeKb: Math.max(1, Math.round(totalBytes / 1024)),
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasServiceWorkerCache: hasSwCache
  };
}

/**
 * Manually flushes local caches and service worker caches, then notifies active components to re-sync
 */
export async function forceRefreshLocalCaches(): Promise<{ clearedCount: number; newSyncTimestamp: number }> {
  let clearedCount = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(WEATHER_CACHE_PREFIX) || key.startsWith(MARKET_CACHE_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      clearedCount++;
    });

    // Reset or invalidate service worker caches for API routes
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await window.caches.keys();
        for (const name of cacheNames) {
          if (name.includes('weather') || name.includes('agri-')) {
            await window.caches.delete(name);
          }
        }
      } catch (cacheErr) {
        console.warn('Could not clear browser CacheStorage:', cacheErr);
      }
    }
  } catch (err) {
    console.warn('Error clearing local caches:', err);
  }

  const now = Date.now();
  recordGlobalSync(now);

  // Dispatch custom broadcast event so active views (WeatherAdvisory, MarketConnect, etc.) immediately refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agri:force-refresh-cache', { detail: { timestamp: now } }));
  }

  return {
    clearedCount,
    newSyncTimestamp: now
  };
}

/**
 * Formats full readable date & time in Bengali and English
 */
export function formatExactSyncTime(timestamp: number | null, lang: 'bn' | 'en'): string {
  if (!timestamp) {
    return lang === 'bn' ? 'কোনো পূর্ববর্তী সিঙ্ক রেকর্ড নেই' : 'No previous sync record';
  }

  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const isPM = hours >= 12;
  const standardHours = hours % 12 || 12;

  if (lang === 'bn') {
    const period = hours < 6 ? 'রাত' : hours < 12 ? 'সকাল' : hours < 16 ? 'দুপুর' : hours < 19 ? 'বিকেল' : 'রাত';
    const day = toBengaliDigits(date.getDate());
    const monthNamesBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
    const month = monthNamesBn[date.getMonth()];
    const timeStr = `${period} ${toBengaliDigits(standardHours)}:${toBengaliDigits(parseInt(minutes, 10))}`;
    return `${day} ${month}, ${timeStr}`;
  }

  const period = isPM ? 'PM' : 'AM';
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${monthNamesEn[date.getMonth()]}, ${standardHours}:${minutes} ${period}`;
}

