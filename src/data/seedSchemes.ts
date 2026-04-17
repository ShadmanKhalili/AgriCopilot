import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';

export const CURRENT_PDF_SCHEMES = [
  {
    id: "farmers-card",
    title: { en: "Farmers' Card", bn: "কৃষক কার্ড" },
    description: {
      en: "A multi-service digital identity and payments card providing fair-price inputs, easy-term credit, lower machinery costs, and direct subsidies.",
      bn: "একটি বহুমুখী ডিজিটাল পরিচয় এবং পেমেন্ট কার্ড যা নায্যমূল্যে উপকরণ, সহজ শর্তে ঋণ, কম খরচে যন্ত্রপাতি এবং সরাসরি ভর্তুকি প্রদান করে।"
    },
    provider: "Ministry of Agriculture + Sonali Bank",
    status: "Pre-pilot live; scaling planned",
    benefits: {
      en: "Direct cash subsidies into bank account, 50% discount on fertilizers, and low-interest crop loans.",
      bn: "সরাসরি ব্যাংক অ্যাকাউন্টে নগদ ভর্তুকি, সারে ৫০% ছাড় এবং স্বল্প সুদে ফসল ঋণ।"
    },
    deadline: {
      en: "Ongoing Registration",
      bn: "চলমান নিবন্ধন"
    },
    contactInfo: {
      en: "Visit nearest Sonali Bank or Upazila Agriculture Office.",
      bn: "নিকটস্থ সোনালী ব্যাংক বা উপজেলা কৃষি অফিসে যোগাযোগ করুন।"
    },
    tags: ["Finance", "Digital Identity"],
    eligibility: {
      en: "If you have a farmers card and own even a little land, you can get this.",
      bn: "আপনার যদি কৃষক কার্ড থাকে এবং সামান্য জমিও থাকে, তবে আপনি এটি পাবেন।"
    },
    howToApply: {
      en: "Talk to your local Krishi Officer (Sub-Assistant Agriculture Officer) or go to the nearest Government Bank with your NID card.",
      bn: "আপনার এলাকার উপ-সহকারী কৃষি কর্মকর্তার সাথে কথা বলুন অথবা এনআইডি কার্ড নিয়ে নিকটস্থ সরকারি ব্যাংকে যান।"
    },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["https://farmerscard.gov.bd/"]
  },
  {
    id: "agri-machinery-subsidy",
    title: { en: "Agricultural Machinery Subsidy", bn: "কৃষি যন্ত্রপাতি ভর্তুকি" },
    description: {
      en: "50%–70% subsidy for purchasing modern machinery like combine harvesters and transplanters.",
      bn: "কম্বাইন হারভেস্টার এবং ট্রান্সপ্লান্টারের মতো আধুনিক যন্ত্রপাতি কেনার জন্য ৫০%–৭০% ভর্তুকি।"
    },
    provider: "DAE / Ministry of Agriculture",
    status: "Live",
    benefits: {
      en: "Save up to 15-20 Lakh BDT on high-end harvesters. Massive reduction in labor costs.",
      bn: "উন্নত হারভেস্টারে ১৫-২০ লক্ষ টাকা পর্যন্ত সাশ্রয়। শ্রম ব্যয়ে ব্যাপক হ্রাস।"
    },
    deadline: {
      en: "Annual Call (usually before Boro season)",
      bn: "বার্ষিক আবেদন (সাধারণত বোরো মৌসুমের আগে)"
    },
    contactInfo: {
      en: "Upazila Agriculture Officer (UAO) or DAE Office.",
      bn: "উপজেলা কৃষি কর্মকর্তা (UAO) বা ডিএই অফিস।"
    },
    tags: ["Machinery", "Finance", "Tools"],
    eligibility: {
      en: "Any farmer who wants to buy machines for their field can apply for this big discount.",
      bn: "যেসব কৃষক তাদের জমির জন্য যন্ত্রপাতি কিনতে চান তারা এই বিশাল ছাড়ের জন্য আবেদন করতে পারেন।"
    },
    howToApply: {
      en: "Go and talk to your Upazila Agriculture Officer (UAO). They will help you fill the form for the machines.",
      bn: "আপনার উপজেলা কৃষি কর্মকর্তার (UAO) সাথে গিয়ে কথা বলুন। তারা আপনাকে যন্ত্রপাতির ফরম পূরণ করতে সাহায্য করবে।"
    },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["http://service.moa.gov.bd/"]
  },
  {
    id: "irrigation-scheme",
    title: { en: "Irrigation Scheme Service", bn: "সেচ স্কিম পরিষেবা" },
    description: {
      en: "Group access to irrigation equipment under designated government projects.",
      bn: "নির্ধারিত সরকারি প্রকল্পের অধীনে সেচ যন্ত্রপাতির গ্রুপ অ্যাক্সেস।"
    },
    provider: "Ministry of Agriculture",
    status: "Live",
    benefits: {
      en: "Reduced electricity rates for irrigation and shared machinery costs.",
      bn: "সেচের জন্য সুলভ বিদ্যুৎ দর এবং যন্ত্রপাতির খরচ ভাগাভাগি।"
    },
    deadline: {
      en: "Seasonal Registration",
      bn: "মৌসুমি নিবন্ধন"
    },
    contactInfo: {
      en: "BADC or Local Agriculture Office.",
      bn: "বিএডিসি বা স্থানীয় কৃষি অফিস।"
    },
    tags: ["Irrigation", "Resources", "Support"],
    eligibility: {
      en: "Groups of farmers (5 or more) who need water for their crops can get this support.",
      bn: "৫ জন বা তার বেশি কৃষকের দল যাদের ফসলের জন্য পানির প্রয়োজন, তারা এই সহায়তা পেতে পারেন।"
    },
    howToApply: {
      en: "Contact your local BADC office or talk to the local Krishi Officer about forming a group for irrigation.",
      bn: "আপনার স্থানীয় বিএডিসি অফিসে যোগাযোগ করুন অথবা সেচের জন্য দল গঠন সম্পর্কে স্থানীয় কৃষি কর্মকর্তার সাথে কথা বলুন।"
    },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["http://service.moa.gov.bd/"]
  },
  {
    id: "gov-paddy-procurement",
    title: { en: "Government Paddy/Rice Procurement", bn: "সরকারি ধান/চাল সংগ্রহ" },
    description: {
      en: "Sell seasonal produce directly to the government at official procurement rates.",
      bn: "অফিসিয়াল সংগ্রহের হার অনুযায়ী মৌসুমি পণ্য সরাসরি সরকারের কাছে বিক্রি করুন।"
    },
    provider: "Directorate General of Food",
    status: "Live seasonal channel",
    benefits: {
      en: "Higher-than-market rates guaranteed. Direct payment to bank accounts.",
      bn: "বাজারের চেয়ে উচ্চ মূল্যের নিশ্চয়তা। সরাসরি ব্যাংক অ্যাকাউন্টে পেমেন্ট।"
    },
    deadline: {
      en: "Seasonal (Aman/Boro cycles)",
      bn: "মৌসুমি (আমন/বোরো চক্র)"
    },
    contactInfo: {
      en: "Download 'Krishoker App' or visit Local Supply Depot (LSD).",
      bn: "'কৃষকের অ্যাপ' ডাউনলোড করুন বা স্থানীয় গুদামে (LSD) যোগাযোগ করুন।"
    },
    tags: ["Selling", "Market", "Paddy Support"],
    eligibility: {
      en: "Any farmer who has paddy to sell and is registered in the government list can sell here.",
      bn: "যে কোনো কৃষকের কাছে ধান বিক্রির জন্য থাকলে এবং সরকারি তালিকায় নাম থাকলে এখানে বিক্রি করতে পারেন।"
    },
    howToApply: {
      en: "Use the 'Krishoker App' on your phone to register your name or visit the local government food godown (LSD).",
      bn: "আপনার ফোনের 'কৃষকের অ্যাপ' ব্যবহার করে নাম নিবন্ধন করুন অথবা স্থানীয় সরকারি খাদ্য গুদামে (LSD) যোগাযোগ করুন।"
    },
    crops: ["paddy"],
    districts: ["all"],
    sourceLinks: ["https://dgfood.gov.bd/"]
  },
  {
    id: "krishi-call-centre",
    title: { en: "Krishi Call Centre (16123)", bn: "কৃষি কল সেন্টার (১৬১২৩)" },
    description: { en: "Immediate expert advice via phone on crops, pests, and farming techniques available 8 AM to 8 PM.", bn: "ফসল, পোকা এবং চাষাবাদ কৌশলের উপর ফোনের মাধ্যমে তাৎক্ষণিক বিশেষজ্ঞ পরামর্শ (সকাল ৮টা - রাত ৮টা)।" },
    provider: "Agricultural Information Service (AIS)",
    status: "Live",
    benefits: {
      en: "Free expert consultation and quick solutions to pest attacks.",
      bn: "বিনামূল্যে বিশেষজ্ঞ পরামর্শ এবং পোকা দমনে দ্রুত সমাধান।"
    },
    deadline: { en: "Active Daily (8 AM - 8 PM)", bn: "প্রতিদিন সক্রিয় (সকাল ৮টা - রাত ৮টা)" },
    contactInfo: { en: "Dial 16123", bn: "১৬১২৩ নম্বরে ডায়াল করুন" },
    tags: ["Assistance", "Support", "Helpline"],
    eligibility: { en: "Any farmer or citizen.", bn: "যেকোনো কৃষক বা নাগরিক।" },
    howToApply: { en: "Call 16123 from any mobile phone (charge 25 paisa/min).", bn: "যেকোনো মোবাইল ফোন থেকে ১৬১২৩ নম্বরে কল করুন (চার্জ ২৫ পয়সা/মিনিট)।" },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["https://ais.gov.bd/"]
  },
  {
    id: "loan-waiver-10k",
    title: { en: "Small Agri-Loan Waiver", bn: "স্বল্প কৃষি ঋণ মওকুফ" },
    description: { en: "Waiver of principal and interest on overdue agricultural loans up to Tk 10,000.", bn: "১০,০০০ টাকা পর্যন্ত বকেয়া কৃষি ঋণের আসল ও সুদ মওকুফ।" },
    provider: "Government / Banking System",
    status: "Approved",
    benefits: { en: "Debt relief for marginal farmers.", bn: "প্রান্তিক কৃষকদের জন্য ঋণ মুক্তি।" },
    tags: ["Finance", "Relief"],
    eligibility: { en: "Borrowers with overdue loans at or below Tk 10,000.", bn: "যাদের ১০,০০০ টাকা বা তার কম বকেয়া ঋণ রয়েছে এমন ঋণগ্রহীতা।" },
    howToApply: { en: "Processed through respective banks; check with your local bank branch.", bn: "সংশ্লিষ্ট ব্যাংকের মাধ্যমে প্রক্রিয়াজাত করা হয়; আপনার স্থানীয় ব্যাংক শাখায় যোগাযোগ করুন।" },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["https://bangla.bdnews24.com/bangladesh/88374bcbb0d2"]
  },
  {
    id: "fertilizer-subsidy",
    title: { en: "Fertilizer Price Subsidy", bn: "সার মূল্য ভর্তুকি" },
    description: { en: "Government provides Urea, TSP, DAP, and MOP fertilizers at highly subsidized prices through licensed dealers.", bn: "সরকার লাইসেন্সপ্রাপ্ত ডিলারদের মাধ্যমে ইউরিয়া, টিএসপি, ডিএপি এবং এমওপি সার অত্যন্ত ভর্তুকি মূল্যে প্রদান করে।" },
    provider: "Ministry of Agriculture / BADC",
    status: "Live",
    benefits: {
      en: "Pay only 25-40% of the international market price for essential fertilizers.",
      bn: "অপরিহার্য সারের জন্য আন্তর্জাতিক বাজার মূল্যের মাত্র ২৫-৪০% পরিশোধ করুন।"
    },
    tags: ["Inputs", "Finance", "Resources"],
    eligibility: { en: "All farmers with a valid Farmer Card.", bn: "বৈধ কৃষক কার্ডধারী সকল কৃষক।" },
    howToApply: { en: "Contact your local authorized fertilizer dealer with your Farmer Card.", bn: "আপনার কৃষক কার্ড নিয়ে স্থানীয় অনুমোদিত সার ডিলারের সাথে যোগাযোগ করুন।" },
    crops: ["all"],
    districts: ["all"],
    sourceLinks: ["http://www.badc.gov.bd/"]
  },
  {
    id: "disaster-relief-seeds",
    title: { en: "Disaster Recovery Seed Support", bn: "দুর্যোগ পরবর্তী বীজ সহায়তা" },
    description: { en: "Free distribution of seeds and fertilizers to victims of floods, cyclones, or prolonged droughts.", bn: "বন্যা, ঘূর্ণিঝড় বা দীর্ঘস্থায়ী খরায় ক্ষতিগ্রস্তদের মাঝে বিনামূল্যে বীজ ও সার বিতরণ।" },
    provider: "Department of Agricultural Extension (DAE)",
    status: "Active during disasters",
    benefits: {
      en: "Free high-quality seeds (Paddy, Wheat, Mustard) to restart farming after losses.",
      bn: "ক্ষয়ক্ষতির পর চাষাবাদ পুনরায় শুরু করতে বিনামূল্যে উচ্চমানের বীজ (ধান, গম, সরিষা) প্রদান।"
    },
    tags: ["Relief", "Seeds"],
    eligibility: { en: "Marginal farmers in disaster-affected districts verified by UAO.", bn: "ইউএও দ্বারা যাচাইকৃত দুর্যোগ-কবলিত জেলার প্রান্তিক কৃষকরা।" },
    howToApply: { en: "Register your name at the local Union Parishad or Upazila Agriculture Office immediately after a disaster.", bn: "দুর্যোগের পরপরই স্থানীয় ইউনিয়ন পরিষদ বা উপজেলা কৃষি অফিসে আপনার নাম নিবন্ধন করুন।" },
    crops: ["paddy", "wheat", "mustard"],
    districts: ["all"],
    sourceLinks: ["http://www.dae.gov.bd/"]
  }
];

export async function seedGovSchemes() {
  const batch = writeBatch(db);
  const colRef = collection(db, 'gov_schemes');
  
  CURRENT_PDF_SCHEMES.forEach((scheme) => {
    const docRef = doc(colRef, scheme.id);
    const { id, ...data } = scheme;
    batch.set(docRef, {
      ...data,
      lastUpdated: new Date().toISOString()
    });
  });
  
  await batch.commit();
}
