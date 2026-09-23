import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Leaf, Volume2, Sparkles, HelpCircle, Calendar, MapPin, Navigation, Send, User, Bot, MessageSquare, AlertTriangle, CheckCircle2, Plus, X, ShieldAlert, Search, Globe, Radar, ThumbsUp, ThumbsDown, Bug, Activity, Share2, Download, Image as ImageIcon, Copy, Calculator, TrendingUp, Waves, Satellite, Cloud, ArrowRight, ArrowUpRight, Mic, MicOff, Video, Compass, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toPng } from 'html-to-image';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { diagnoseCrop, deepDiagnoseCrop, generateSpeech, startAgriChat, translateText, summarizeConversation } from '../services/ai';
import { collection, addDoc, doc, updateDoc, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { translations, Language } from '../utils/translations';
import { resizeImage } from '../utils/imageOptimizer';
import { motion, AnimatePresence } from 'motion/react';
import Tooltip from './Tooltip';
import LocationDisplay from './LocationDisplay';
import { LiveExpertCall } from './LiveExpertCall';
import LiveVideoCopilot from './LiveVideoCopilot';
import DosageCalculator from './DosageCalculator';
import { geoData } from '../utils/geoData';
import { detectUserLocation } from '../utils/geolocation';
import { recordFarmerInteractionEvent } from '../utils/farmerProfiler';

const CROPS = ['tomato', 'brinjal', 'paddy', 'chili', 'watermelon', 'potato', 'onion', 'cucumber', 'betelLeaf', 'wheat', 'maize', 'jute', 'sugarcane', 'tea', 'pulse', 'mustard'];

const SAMPLE_DIAGNOSIS_CASES = [
  {
    crop: 'paddy',
    categoryBn: 'ধান',
    categoryEn: 'Paddy / Rice',
    titleBn: 'ধানের ব্লাস্ট ও পাতা পোড়া রোগ',
    titleEn: 'Rice Blast & Blight',
    descBn: 'পাতায় ডিম্বাকৃতি বাদামি দাগ ও নোড সংক্রমণ',
    descEn: 'Spindle-shaped brown lesions with ash center',
    sampleDiagnosis: {
      disease: 'Rice Blast (Magnaporthe oryzae)',
      diseaseBn: 'ধানের ব্লাস্ট রোগ (ম্যাগনাপর্থে ওরাইজি)',
      confidence: 94,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Fungal infection exacerbated by high humidity and excess nitrogen.',
      organicRemedy: 'Spray neem seed extract (50g/L water) or trichoderma harzianum suspension during early morning.',
      chemicalRemedy: 'Foliar application of Tricyclazole 75 WP @ 0.75g/L water or Nativo 75 WG @ 0.6g/L.',
      verificationAdvice: 'Inspect the leaf collar and panicle neck for characteristic diamond-shaped lesions.',
      symptomsBreakdown: [
        'Spindle-shaped spots with necrotic grey centers on leaf blade',
        'Brown to black discoloration at panicle nodes',
        'Premature leaf senescence and reduced grain filling'
      ]
    }
  },
  {
    crop: 'paddy',
    categoryBn: 'ধান',
    categoryEn: 'Paddy / Rice',
    titleBn: 'ধানের বাদামি গাছফড়িং (বিপিএইচ) ও খোল পোড়া',
    titleEn: 'Rice Brown Plant Hopper & Sheath Blight',
    descBn: 'গাছের গোড়ায় পোকার ঝাঁক ও হপারবার্ন ছোপ',
    descEn: 'Hopper burn circular drying patches with sheath lesions',
    sampleDiagnosis: {
      disease: 'Brown Plant Hopper (BPH) & Sheath Blight (Rhizoctonia solani)',
      diseaseBn: 'বাদামি গাছফড়িং (বিপিএইচ) ও খোল পোড়া রোগ',
      confidence: 92,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Dense planting, stagnant warm water, and excessive urea usage.',
      organicRemedy: 'Drain standing water for 3-4 days to expose base, encourage spiders/mirid bugs, and spray Beauveria bassiana.',
      chemicalRemedy: 'Pymetrozine (Chess 50 WDG) @ 0.6g/L or Dinotefuran 20 SG @ 0.4g/L directed strictly at the plant base.',
      verificationAdvice: 'Part the tillers near ground water level and vigorously shake plants over white paper to count falling nymphs.',
      symptomsBreakdown: [
        'Rapid circular yellowing and drying ("hopper burn") in field patches',
        'Serpentine snake-skin lesions on leaf sheaths just above waterline',
        'Honeydew secretion leading to black sooty mold at tiller bases'
      ]
    }
  },
  {
    crop: 'paddy',
    categoryBn: 'ধান',
    categoryEn: 'Paddy / Rice',
    titleBn: 'ধানের ব্যাক্টেরিয়াল পাতা পোড়া (বিএলবি)',
    titleEn: 'Rice Bacterial Leaf Blight (BLB)',
    descBn: 'পাতার কিনার থেকে ঢেউ খেলানো হলদে দাগ',
    descEn: 'Wavy water-soaked margins turning straw-yellow',
    sampleDiagnosis: {
      disease: 'Bacterial Leaf Blight (Xanthomonas oryzae)',
      diseaseBn: 'ধানের ব্যাক্টেরিয়াল পাতা পোড়া (বিএলবি)',
      confidence: 90,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Bacterial infection spread through storm winds, rain splashing, and injured leaves.',
      organicRemedy: 'Topdress with Muriate of Potash (MoP) 5kg/bigha, spray copper hydroxide 2g/L, and withhold urea application.',
      chemicalRemedy: 'Bismerthiazol (Bactroban) @ 1.5g/L + Copper Oxychloride @ 2g/L or Streptocycline @ 0.2g/L.',
      verificationAdvice: 'Cut freshly infected leaf edge, place in clear glass of water, and look for milky bacterial ooze streaming from cut vein.',
      symptomsBreakdown: [
        'Wavy, undulating lesion margins starting from leaf tips downward',
        'Translucent amber-colored bacterial droplets on early morning dew',
        'Straw-bleached leaves causing complete blighting of upper canopy'
      ]
    }
  },
  {
    crop: 'potato',
    categoryBn: 'আলু',
    categoryEn: 'Potato',
    titleBn: 'আলুর নাবী ধসা (লেসব্লাইট)',
    titleEn: 'Potato Late Blight',
    descBn: 'পাতার কিনারায় ভেজা জলছাপ ও সাদা ছত্রাক',
    descEn: 'Water-soaked lesions with white down on leaf underside',
    sampleDiagnosis: {
      disease: 'Late Blight (Phytophthora infestans)',
      diseaseBn: 'আলুর নাবী ধসা রোগ (ফাইটোপথোরা ইনফেস্ট্যান্স)',
      confidence: 95,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Cold humid weather with persistent fog and prolonged leaf wetness.',
      organicRemedy: 'Apply copper hydroxide dust or Bordeaux mixture (1%) as preventive barrier.',
      chemicalRemedy: 'Mancozeb (Indofil M-45) @ 2g/L or Metalaxyl+Mancozeb (Ridomil Gold) @ 2g/L water.',
      verificationAdvice: 'Check lower leaf undersides in the early morning for delicate white cottony fungal growth.',
      symptomsBreakdown: [
        'Irregular water-soaked spots turning rapidly dark brown to purplish-black',
        'White mildew ring on the underside of infected leaflets',
        'Rotting odor from severely affected foliage canopy'
      ]
    }
  },
  {
    crop: 'potato',
    categoryBn: 'আলু',
    categoryEn: 'Potato',
    titleBn: 'আলুর আগাম ধসা (আর্লি ব্লাইট)',
    titleEn: 'Potato Early Blight',
    descBn: 'পাতায় সমকেন্দ্রিক বলয়াকার বাদামি দাগ',
    descEn: 'Target-board concentric rings on older lower leaves',
    sampleDiagnosis: {
      disease: 'Early Blight (Alternaria solani)',
      diseaseBn: 'আলুর আগাম ধসা রোগ (অল্টারনারিয়া সোলানি)',
      confidence: 89,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Alternating wet and dry periods affecting mature or nitrogen-stressed plants.',
      organicRemedy: 'Apply Trichoderma harzianum or spray garlic extract; remove lower yellow senescent foliage.',
      chemicalRemedy: 'Azoxystrobin + Difenoconazole (Amistar Top) @ 1ml/L or Chlorothalonil @ 2g/L.',
      verificationAdvice: 'Examine dark spots under sunlight to observe clear circular rings like an archery target.',
      symptomsBreakdown: [
        'Dark brown necrotic spots surrounded by chlorotic yellow halos',
        'Characteristic concentric target-board ridges within lesions',
        'Premature defoliation of lower leaves moving upward'
      ]
    }
  },
  {
    crop: 'tomato',
    categoryBn: 'টমেটো',
    categoryEn: 'Tomato',
    titleBn: 'টমেটোর পাতা কোঁকড়ানো ভাইরাস (ToLCV)',
    titleEn: 'Tomato Leaf Curl Virus',
    descBn: 'পাতা উপরের দিকে কুঁকড়ে যাওয়া ও শিরা হলুদ',
    descEn: 'Upward leaf curling, thickening, and stunted terminal growth',
    sampleDiagnosis: {
      disease: 'Tomato Leaf Curl Virus (ToLCV)',
      diseaseBn: 'টমেটোর পাতা কোঁকড়ানো ভাইরাস (ToLCV)',
      confidence: 91,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Whitefly (Bemisia tabaci) transmission under dry warm conditions.',
      organicRemedy: 'Erect yellow sticky traps (1 trap/100 sq meters) and spray soap-water emulsion (5ml/L).',
      chemicalRemedy: 'Imidacloprid (Admire 200 SL) @ 0.5ml/L or Acetamiprid @ 0.5g/L to control vector.',
      verificationAdvice: 'Check young apical shoots for upward cupping and observe whitefly activity on undersides.',
      symptomsBreakdown: [
        'Severe upward curling and crinkling of young leaflets',
        'Interveinal chlorosis with prominent thickened vein networks',
        'Stunted internode elongation with bushy canopy cluster'
      ]
    }
  },
  {
    crop: 'tomato',
    categoryBn: 'টমেটো',
    categoryEn: 'Tomato',
    titleBn: 'টমেটোর নাবী ধসা ও ফল পচা',
    titleEn: 'Tomato Late Blight & Fruit Rot',
    descBn: 'কাঁচা ফলে তামাটে শক্ত দাগ ও পাতার ডগা পচন',
    descEn: 'Greasy bronze blotches on green fruit with stem rotting',
    sampleDiagnosis: {
      disease: 'Late Blight (Phytophthora infestans)',
      diseaseBn: 'টমেটোর নাবী ধসা ও ফল পচা রোগ',
      confidence: 93,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Continuous cloudy overcast skies, high humidity (>90%), and temperatures between 15-22°C.',
      organicRemedy: 'Remove and burn all infected green fruits and lower leaves immediately; spray copper oxychloride 2g/L.',
      chemicalRemedy: 'Dimethomorph + Mancozeb (Acrobat MZ) @ 2g/L or Cymoxanil + Mancozeb (Curzate) @ 2g/L.',
      verificationAdvice: 'Touch infected fruit spots — feel firm, greasy texture without immediate soft watery collapse.',
      symptomsBreakdown: [
        'Dark olivaceous greasy lesions on fruit shoulders',
        'Rapid brown girdling cankers along green stems',
        'White fungal bloom on fruit underside in damp conditions'
      ]
    }
  },
  {
    crop: 'brinjal',
    categoryBn: 'বেগুন',
    categoryEn: 'Brinjal / Eggplant',
    titleBn: 'বেগুনের ডগা ও ফল ছিদ্রকারী পোকা',
    titleEn: 'Brinjal Shoot & Fruit Borer (BSFB)',
    descBn: 'কচি ডগা নুয়ে পড়া ও ফলে ছোট ছিদ্র ও বিষ্ঠা',
    descEn: 'Wilting shoot tips and boreholes plugged with frass',
    sampleDiagnosis: {
      disease: 'Brinjal Fruit & Shoot Borer (Leucinodes orbonalis)',
      diseaseBn: 'বেগুনের ডগা ও ফল ছিদ্রকারী পোকা',
      confidence: 96,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Lepidopteran larvae boring into tender vegetative shoots and developing fruits.',
      organicRemedy: 'Clipping and burying wilted shoots weekly; install Lucin-lure sex pheromone traps @ 4-5 per bigha.',
      chemicalRemedy: 'Spinosad 45 SC (Tracer) @ 0.4ml/L or Chlorantraniliprole 18.5 SC (Coragen) @ 0.3ml/L.',
      verificationAdvice: 'Snap off bent wilted shoot tips — split open lengthwise to spot the pinkish caterpillar inside.',
      symptomsBreakdown: [
        'Sudden wilting and drooping of tender apical shoots',
        'Circular entry boreholes on maturing fruits surrounded by larval frass',
        'Deformed, unmarketable fruits with internal pulp hollowed out'
      ]
    }
  },
  {
    crop: 'brinjal',
    categoryBn: 'বেগুন',
    categoryEn: 'Brinjal / Eggplant',
    titleBn: 'বেগুনের ফোমোপসিস ব্লাইট ও ফল পচা',
    titleEn: 'Brinjal Phomopsis Blight',
    descBn: 'পাতায় বৃত্তাকার দাগ ও ফলে শুকনো বাদামি পচন',
    descEn: 'Concentric lesions with black pycnidia on leaves and fruit',
    sampleDiagnosis: {
      disease: 'Phomopsis Blight (Phomopsis vexans)',
      diseaseBn: 'বেগুনের ফোমোপসিস ব্লাইট ও ফল পচন রোগ',
      confidence: 88,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Fungal spores splashing from old debris under warm rainy conditions.',
      organicRemedy: 'Seed treatment with hot water (50°C for 25 min) and soil drenching with Trichoderma.',
      chemicalRemedy: 'Carbendazim 50 WP @ 1g/L or Mancozeb @ 2.5g/L sprayed every 10-12 days.',
      verificationAdvice: 'Use magnifying lens to see tiny pimple-like black dots (pycnidia) arranged inside leaf spots.',
      symptomsBreakdown: [
        'Circular clearly demarcated brown spots with pale centers on leaves',
        'Sunken brown rotting patches covering large sections of fruit',
        'Mummified black dry fruits clinging to the plant'
      ]
    }
  },
  {
    crop: 'chili',
    categoryBn: 'মরিচ',
    categoryEn: 'Chili / Pepper',
    titleBn: 'মরিচের অ্যানথ্রাকনোজ ও ডাইব্যাক (ফল পচা)',
    titleEn: 'Chili Anthracnose & Dieback',
    descBn: 'পাকা মরিচে গোল দাগ ও ডাল ওপর থেকে শুকানো',
    descEn: 'Sunken necrotic spots on ripe pods and branch dieback',
    sampleDiagnosis: {
      disease: 'Chili Anthracnose (Colletotrichum capsici)',
      diseaseBn: 'মরিচের অ্যানথ্রাকনোজ ও ডাইব্যাক রোগ',
      confidence: 93,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Fungus thriving during high moisture and rainfall when fruits reach turning/red ripe stage.',
      organicRemedy: 'Use disease-free treated seeds, practice 2-year crop rotation, and spray Pseudomonas fluorescens (5g/L).',
      chemicalRemedy: 'Azoxystrobin + Difenoconazole (Amistar Top) @ 1ml/L or Propiconazole (Tilt 250 EC) @ 0.5ml/L.',
      verificationAdvice: 'Inspect ripe pods for concentric rings of tiny black dots surrounded by straw-colored sunken rims.',
      symptomsBreakdown: [
        'Circular, sunken necrotic lesions on ripening and red chili pods',
        'Acervuli forming concentric rings of black dots inside fruit lesions',
        'Twigs drying backward from tip toward the stem axis ("dieback")'
      ]
    }
  },
  {
    crop: 'chili',
    categoryBn: 'মরিচ',
    categoryEn: 'Chili / Pepper',
    titleBn: 'মরিচের থ্রিপস ও মাকড় (পাতা কোঁকড়ানো)',
    titleEn: 'Chili Thrips & Mite Complex (Murda)',
    descBn: 'পাতা নৌকার মতো উল্টে কুঁকড়ে যাওয়া ও খর্বাকৃতি',
    descEn: 'Upward/downward leaf curling with bronzed underside',
    sampleDiagnosis: {
      disease: 'Chili Leaf Curl (Thrips & Yellow Mite Complex)',
      diseaseBn: 'মরিচের থ্রিপস ও মাকড় আক্রমণ (মুড়দা রোগ)',
      confidence: 91,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Combined feeding by tiny sap-sucking yellow mites and thrips in warm weather.',
      organicRemedy: 'Spray neem oil (5ml/L) with soap nut water; dust sulfur (80% WP) @ 2g/L for mites.',
      chemicalRemedy: 'Diafenthiuron 50 WP (Pegasus) @ 1g/L or Fipronil 5 SC @ 1.5ml/L + Abamectin 1.8 EC @ 1ml/L.',
      verificationAdvice: 'Look at the leaf curl: upward boat-shaped = thrips; downward inverted cup = mites.',
      symptomsBreakdown: [
        'Upward boat-shaped curling and brittle leaves caused by thrips',
        'Downward inverted spoon curling and bronzed underside caused by yellow mites',
        'Bud drop and clustering of small terminal rosettes'
      ]
    }
  },
  {
    crop: 'watermelon',
    categoryBn: 'তরমুজ',
    categoryEn: 'Watermelon',
    titleBn: 'তরমুজের আঠা ঝরা রোগ (গামি স্টেম ব্লাইট)',
    titleEn: 'Watermelon Gummy Stem Blight',
    descBn: 'কাণ্ড ফেটে বাদামি আঠালো রস নির্গমন ও পাতা শুকানো',
    descEn: 'Amber gummy exudate oozing from cracked stem crowns',
    sampleDiagnosis: {
      disease: 'Gummy Stem Blight (Didymella bryoniae)',
      diseaseBn: 'তরমুজের আঠা ঝরা রোগ (ডিডিমেলা ব্রায়োনি)',
      confidence: 92,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Soil-borne fungus invading stem wounds during warm temperatures (24-28°C) and high humidity.',
      organicRemedy: 'Avoid stem injuries during weeding; paste Trichoderma harzianum or Bordeaux paste directly onto stem lesions.',
      chemicalRemedy: 'Thiophanate Methyl 70 WP @ 1.5g/L or Tebuconazole + Trifloxystrobin (Nativo) @ 0.6g/L.',
      verificationAdvice: 'Check crown area just above ground line for characteristic cracked bark with dark reddish-brown sticky droplets.',
      symptomsBreakdown: [
        'Water-soaked circular lesions on leaves spreading from margins inward',
        'Stem cracking at ground level with gummy amber fluid exudation',
        'Sudden daytime vine collapse while roots remain structurally intact'
      ]
    }
  },
  {
    crop: 'betelLeaf',
    categoryBn: 'পান',
    categoryEn: 'Betel Leaf / Paan',
    titleBn: 'পানের গোড়া ও মূল পচা রোগ (ফুট রট)',
    titleEn: 'Betel Vine Foot & Root Rot',
    descBn: 'পানের লতা হলদে হয়ে ঢলে পড়া ও গোড়ায় কালো দাগ',
    descEn: 'Sudden vine wilting with black rotting girdles at collar',
    sampleDiagnosis: {
      disease: 'Foot Rot & Leaf Rot (Phytophthora parasitica var. piperina)',
      diseaseBn: 'পানের গোড়া ও লতা পচা রোগ',
      confidence: 94,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Excess dampness, poor drainage in Boroj (pan baroj), and contaminated cuttings.',
      organicRemedy: 'Ensure trench drainage outside Boroj; drench soil with Trichoderma-enriched mustard oil cake.',
      chemicalRemedy: 'Soil drenching with Metalaxyl + Mancozeb (Ridomil Gold) @ 2g/L or Fosetyl-Al (Aliette) @ 2.5g/L.',
      verificationAdvice: 'Gently pull the wilted vine — collar zone slips off easily showing shredded dark brown vascular strands.',
      symptomsBreakdown: [
        'Rapid yellowing and flaccid wilting of leaves from top to bottom',
        'Black collar rot just at soil line that emits foul rotting odor',
        'Wet-oil spot lesions expanding quickly across leaf blades in rainy months'
      ]
    }
  },
  {
    crop: 'onion',
    categoryBn: 'পেঁয়াজ',
    categoryEn: 'Onion',
    titleBn: 'পেঁয়াজের বেগুনি দাগ রোগ (পার্পল ব্লচ)',
    titleEn: 'Onion Purple Blotch',
    descBn: 'পাতায় লম্বাটে বেগুনি কেন্দ্রের দাগ ও ডগা ভাঙা',
    descEn: 'Sunken purplish-brown elliptical leaf spots',
    sampleDiagnosis: {
      disease: 'Purple Blotch (Alternaria porri)',
      diseaseBn: 'পেঁয়াজের বেগুনি দাগ রোগ (অল্টারনারিয়া পরি)',
      confidence: 91,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Spreads during foggy mornings, heavy dews, and temperatures between 21-30°C.',
      organicRemedy: 'Spray garlic clove extract (5%) or copper hydroxide dust; maintain proper furrow drainage.',
      chemicalRemedy: 'Rovral 50 WP (Iprodione) @ 2g/L or Difenoconazole (Score 250 EC) @ 0.5ml/L.',
      verificationAdvice: 'Observe the center of leaf lesions — distinctly purplish or dark violet surrounded by yellow halos.',
      symptomsBreakdown: [
        'Small sunken whitish spots rapidly turning purplish in center',
        'Spots enlarge and girdle the tubular leaf, causing it to snap over',
        'Bulb rot developing in storage starting from infected neck tissues'
      ]
    }
  },
  {
    crop: 'maize',
    categoryBn: 'ভুট্টা',
    categoryEn: 'Maize / Corn',
    titleBn: 'ভুট্টার ফল আর্মিওয়ার্ম কীড়া আক্রমণ',
    titleEn: 'Maize Fall Armyworm (FAW)',
    descBn: 'কচি শিষ ও পাতার গোছায় করাত দিয়ে কাটার মতো ক্ষত',
    descEn: 'Ragged shot-hole defoliation and dense sawdust-like frass in whorl',
    sampleDiagnosis: {
      disease: 'Fall Armyworm (Spodoptera frugiperda)',
      diseaseBn: 'ভুট্টার ফল আর্মিওয়ার্ম কীড়া আক্রমণ',
      confidence: 95,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Invasive noctuid moth larvae actively voracious on young corn whorls.',
      organicRemedy: 'Handpick egg masses; apply fine wood ash or dry sand mixed with neem powder directly inside whorls.',
      chemicalRemedy: 'Emamectin Benzoate 5 SG (Proclaim) @ 1g/L or Spinetoram 11.7 SC (Delegate) @ 0.5ml/L into the whorl.',
      verificationAdvice: 'Look inside the leaf whorl: spot the caterpillar with 4 dark spots arranged in a square on the 8th segment.',
      symptomsBreakdown: [
        'Extensive ragged windowing and "shot-hole" tears in unfurling leaves',
        'Large accumulation of coarse, moist sawdust-like frass inside the central funnel',
        'Bored husks and eaten kernels at the tip of developing ears'
      ]
    }
  },
  {
    crop: 'mustard',
    categoryBn: 'সরিষা',
    categoryEn: 'Mustard',
    titleBn: 'সরিষার জাবপোকা (এফিড) আক্রমণ',
    titleEn: 'Mustard Aphid Infestation',
    descBn: 'মুকুল ও কচি ফলে লাখ লাখ কালচে পোকার আস্তরণ',
    descEn: 'Dense clusters of greenish-black aphids on flowers and pods',
    sampleDiagnosis: {
      disease: 'Mustard Aphid (Lipaphis erysimi)',
      diseaseBn: 'সরিষার জাবপোকা আক্রমণ',
      confidence: 94,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Overcast, calm, cloudy weather with morning fog during flowering and pod development.',
      organicRemedy: 'Spray liquid dish soap solution (5ml/L) or tobacco leaf decoction; conserve ladybird beetles.',
      chemicalRemedy: 'Imidacloprid 200 SL @ 0.5ml/L or Dimethoate 40 EC (Rogor) @ 1.5ml/L in the late afternoon.',
      verificationAdvice: 'Gently shake the flowering twig: sticky honeydew glistening with thousands of tiny sap suckers.',
      symptomsBreakdown: [
        'Curled, yellowed inflorescences incapable of setting healthy pods',
        'Stunted, sickly plants coated with black sooty mold fungus',
        'Shriveled, light grains causing severe oil yield loss'
      ]
    }
  },
  {
    crop: 'cucumber',
    categoryBn: 'শসা ও করলা',
    categoryEn: 'Cucumber / Gourd',
    titleBn: 'শসার ডাউনি মিলডিউ (হলুদ ছোপ রোগ)',
    titleEn: 'Cucumber Downy Mildew',
    descBn: 'পাতার শিরা দিয়ে সীমাবদ্ধ চারকোনা হলুদ ছোপ',
    descEn: 'Angular chlorotic yellow patches delineated by leaf veins',
    sampleDiagnosis: {
      disease: 'Downy Mildew (Pseudoperonospora cubensis)',
      diseaseBn: 'শসা ও লাউ জাতীয় ফসলের ডাউনি মিলডিউ রোগ',
      confidence: 90,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Airborne sporangia germinating rapidly in the presence of free water or morning fog.',
      organicRemedy: 'Trellis vines off wet soil; spray baking soda (5g/L) + neem oil emulsion as preventive.',
      chemicalRemedy: 'Cymoxanil + Mancozeb (Curzate) @ 2g/L or Fenamidone + Mancozeb (Sectin) @ 2g/L.',
      verificationAdvice: 'Flip the leaf over: under every angular yellow spot on the top side, note grayish-purple fuzzy mildew underneath.',
      symptomsBreakdown: [
        'Angular, vein-delimited bright yellow patches on the upper leaf surface',
        'Purplish-brown downy fungal felt on the underside during humid mornings',
        'Leaves crisp and scorch brown, creating a "fired" canopy appearance'
      ]
    }
  },
  {
    crop: 'jute',
    categoryBn: 'পাট',
    categoryEn: 'Jute',
    titleBn: 'পাটের কাণ্ড পচা রোগ (স্টেম রট)',
    titleEn: 'Jute Stem Rot',
    descBn: 'পাটের কাণ্ডে বাদামি ছোপ ও আঁশ ফেটে নষ্ট হওয়া',
    descEn: 'Dark lesions on stem node resulting in shredding fibers',
    sampleDiagnosis: {
      disease: 'Jute Stem Rot (Macrophomina phaseolina)',
      diseaseBn: 'পাটের কাণ্ড পচা রোগ',
      confidence: 89,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Seed-borne and soil-borne fungus active in poorly drained soil during monsoon downpours.',
      organicRemedy: 'Seed treatment with Trichoderma; avoid dense broadcast sowing by line sowing with proper spacing.',
      chemicalRemedy: 'Carbendazim 50 WP (Autostin) @ 1.5g/L or Mancozeb @ 2.5g/L sprayed targeting stems.',
      verificationAdvice: 'Peel back bark at infected node: notice charcoal-like black sclerotia embedded in fiber bundles.',
      symptomsBreakdown: [
        'Brown, sunken necrotic spots centered on nodes along the green stem',
        'Fiber decay causing stem lodging and breakage during strong winds',
        'Shredded, black, brittle bark with lost fiber tensile strength'
      ]
    }
  },
  {
    crop: 'chili',
    categoryBn: 'মরিচ',
    categoryEn: 'Chili / Pepper',
    titleBn: 'মরিচের ডাই-ব্যাক ও অ্যানথ্রাকনোজ (ফল পচা)',
    titleEn: 'Chili Anthracnose & Die-back',
    descBn: 'ডাল শুকিয়ে যাওয়া ও পাকা মরিচে গোল গোল ক্ষত',
    descEn: 'Twig die-back starting from top with sunken fruit lesions',
    sampleDiagnosis: {
      disease: 'Chili Anthracnose & Die-back (Colletotrichum capsici)',
      diseaseBn: 'মরিচের অ্যানথ্রাকনোজ ও ডাল শুকিয়ে যাওয়া (ডাই-ব্যাক) রোগ',
      confidence: 93,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Fungal spores splashing from rain and dew during warm, humid conditions.',
      organicRemedy: 'Collect and burn dead twigs; spray garlic cloves extract (50g/L) or neem leaf extract.',
      chemicalRemedy: 'Azoxystrobin + Difenoconazole (Amistar Top) @ 1ml/L or Propiconazole (Tilt 250 EC) @ 0.5ml/L.',
      verificationAdvice: 'Look for sunken circular black spots with concentric rings on ripe chili pods.',
      symptomsBreakdown: [
        'Twig tips turn brown and dry downwards ("die-back")',
        'Sunken circular water-soaked spots on red and green chilies',
        'Premature fruit drop and black speckles on stems'
      ]
    }
  },
  {
    crop: 'chili',
    categoryBn: 'মরিচ',
    categoryEn: 'Chili / Pepper',
    titleBn: 'মরিচের পাতা কোঁকড়ানো (থ্রিপস ও মাইট)',
    titleEn: 'Chili Leaf Curl (Thrips & Mites)',
    descBn: 'পাতা নৌকা বা বাটির মতো কুঁকড়ে যাওয়া',
    descEn: 'Upward or downward boat-shaped curling with stunted growth',
    sampleDiagnosis: {
      disease: 'Chili Leaf Curl Complex (Thrips & Yellow Mite)',
      diseaseBn: 'মরিচের পাতা কোঁকড়ানো রোগ (চুষি পোকা ও লাল মাকড়)',
      confidence: 91,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Thrips feeding causes upward cupping; yellow mites cause downward inverted boat cupping.',
      organicRemedy: 'Spray neem oil (3ml/L) with liquid soap; place blue and yellow sticky traps in field.',
      chemicalRemedy: 'Fipronil (Ascend 5 SC) @ 1ml/L for thrips; Fenpyroximate or Abamectin @ 1.2ml/L for mites.',
      verificationAdvice: 'Hold curled leaves against sunlight to check for silvery scrape marks and minute mites.',
      symptomsBreakdown: [
        'Upward boat-shaped curl indicates thrips; downward curling indicates mite infestation',
        'Brittle, thickened foliage with bronzed appearance underneath',
        'Flower dropping and severely stunted bushy plant canopy'
      ]
    }
  },
  {
    crop: 'watermelon',
    categoryBn: 'তরমুজ',
    categoryEn: 'Watermelon',
    titleBn: 'তরমুজের ফিউজারিয়াম উইল্ট (লতা ঢলে পড়া)',
    titleEn: 'Watermelon Fusarium Wilt',
    descBn: 'হঠাৎ দুপুরের রোদে তরমুজের গাছ নুয়ে পড়ে শুকিয়ে যাওয়া',
    descEn: 'Sudden daytime wilting of runners followed by vine collapse',
    sampleDiagnosis: {
      disease: 'Fusarium Wilt (Fusarium oxysporum f. sp. niveum)',
      diseaseBn: 'তরমুজের ফিউজারিয়াম উইল্ট বা লতা ঢলে পড়া রোগ',
      confidence: 92,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Soil-borne fungal pathogen invading vascular roots in warm sandy soils.',
      organicRemedy: 'Soil solarization; drench root zone with Trichoderma viride enriched vermicompost.',
      chemicalRemedy: 'Carbendazim 50 WP @ 2g/L or Thiophanate-methyl (Topsin-M) @ 1.5g/L drenching around stem base.',
      verificationAdvice: 'Slice base of runner stem vertically: notice reddish-brown vascular discoloration inside.',
      symptomsBreakdown: [
        'Vines wilt during hot midday sun and temporarily recover at night',
        'Permanent yellowing and dry shriveling of runners within 3-4 days',
        'Brown vascular streaks inside stem xylem bundles'
      ]
    }
  },
  {
    crop: 'betelLeaf',
    categoryBn: 'পান পাতা',
    categoryEn: 'Betel Leaf / Paan',
    titleBn: 'পানের গোড়া পচা ও ডাঁটা পচা রোগ',
    titleEn: 'Betel Vine Foot Rot & Stem Rot',
    descBn: 'লতার গোড়ায় কালো পচন ও পাতা ঝরে বরজ ফাঁকা হওয়া',
    descEn: 'Dark basal stem rot leading to sudden vine wilting in boroj',
    sampleDiagnosis: {
      disease: 'Betel Leaf Foot & Stem Rot (Phytophthora parasitica & Sclerotium rolfsii)',
      diseaseBn: 'পানের গোড়া পচা ও বরজের ডাঁটা পচা রোগ',
      confidence: 95,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Excessive humidity inside betel conservatory (boroj) and poor root drainage.',
      organicRemedy: 'Improve boroj aeration; apply mustard oil cake with Trichoderma around vine bases.',
      chemicalRemedy: 'Drench soil with Bordeaux mixture (1%) or Metalaxyl + Mancozeb (Ridomil Gold) @ 2g/L.',
      verificationAdvice: 'Inspect stem base near soil line: soft brown water-soaked rotting with mustard-seed-like sclerotia.',
      symptomsBreakdown: [
        'Dark brown to black slimy rot on stem right at the soil line',
        'Rapid yellowing, drooping, and shedding of lush green betel leaves',
        'White fungal threads visible at moist base under dense shade'
      ]
    }
  },
  {
    crop: 'onion',
    categoryBn: 'পেঁয়াজ ও রসুন',
    categoryEn: 'Onion & Garlic',
    titleBn: 'পেঁয়াজের পার্পল ব্লচ (বেগুনি দাগ রোগ)',
    titleEn: 'Onion Purple Blotch',
    descBn: 'পাতায় ডিম্বাকার জলছাপ দাগের মাঝে বেগুনি কেন্দ্র',
    descEn: 'Sunken purplish-brown lesions on tubular leaves and seed stalks',
    sampleDiagnosis: {
      disease: 'Purple Blotch (Alternaria porri)',
      diseaseBn: 'পেঁয়াজের পার্পল ব্লচ বা বেগুনি দাগ রোগ',
      confidence: 90,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'High relative humidity (80-90%) and temperatures around 21-30°C.',
      organicRemedy: 'Crop rotation with non-allium crops; spray garlic extract and ensure wide spacing.',
      chemicalRemedy: 'Iprodione (Rovral 50 WP) @ 2g/L or Difenoconazole (Score 250 EC) @ 1ml/L + sticker.',
      verificationAdvice: 'Look for elongated purplish-brown spots surrounded by chlorotic yellow halos on leaves.',
      symptomsBreakdown: [
        'Small water-soaked lesions expanding into purplish-brown center',
        'Leaves snap and collapse at the lesion point during windy periods',
        'Premature drying of onion tops reducing bulb size and storage quality'
      ]
    }
  },
  {
    crop: 'wheat',
    categoryBn: 'গম',
    categoryEn: 'Wheat',
    titleBn: 'গমের ব্লাস্ট ও পাতা মরিচা রোগ',
    titleEn: 'Wheat Blast & Leaf Rust',
    descBn: 'শীষের কিছু অংশ সাদা হয়ে যাওয়া ও পাতায় বাদামি গুঁড়ো',
    descEn: 'Bleached white spikelets with rust pustules on leaf surface',
    sampleDiagnosis: {
      disease: 'Wheat Blast (Magnaporthe oryzae Triticum) & Leaf Rust (Puccinia triticina)',
      diseaseBn: 'গমের ব্লাস্ট ও পাতা মরিচা (রাস্ট) রোগ',
      confidence: 94,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Warm unseasonal rain and high humidity during wheat heading stage.',
      organicRemedy: 'Plant blast-resistant certified seeds (e.g. BARI Gom 33); timely early sowing.',
      chemicalRemedy: 'Nativo 75 WG (Tebuconazole + Trifloxystrobin) @ 0.6g/L applied at first heading.',
      verificationAdvice: 'Examine wheat ears: bleached white spikelets while rest of ear remains green.',
      symptomsBreakdown: [
        'Complete or partial bleaching of wheat ear above the infection point',
        'Grey fungal mold at the rachis node of the ear',
        'Shriveled, light grains causing drastic harvest loss'
      ]
    }
  },
  {
    crop: 'tea',
    categoryBn: 'চা পাতা',
    categoryEn: 'Tea',
    titleBn: 'চায়ের লাল মাকড় ও রেড রাস্ট (শ্যাওলা রোগ)',
    titleEn: 'Tea Red Spider Mite & Red Rust',
    descBn: 'পাতার উপরিভাগ তামাটে লাল ও ছোট ছোট শ্যাওলা দাগ',
    descEn: 'Bronzed leaf surface with orange algal patches on tea branches',
    sampleDiagnosis: {
      disease: 'Red Spider Mite (Oligonychus coffeae) & Red Rust (Cephaleuros parasiticus)',
      diseaseBn: 'চায়ের লাল মাকড় আক্রমণ ও রেড রাস্ট রোগ',
      confidence: 88,
      severity: 'Medium',
      qualitativeSeverity: 'Medium',
      cause: 'Dry spells and hot sunny exposed sections in tea gardens.',
      organicRemedy: 'Maintain shade trees; spray wettable sulfur (2g/L) during early morning.',
      chemicalRemedy: 'Propargite 57 EC (Omite) @ 2ml/L or Hexythiazox @ 1ml/L targeted under leaves.',
      verificationAdvice: 'Rub fingers on red leaf: orange stain left on skin indicates active mite colony.',
      symptomsBreakdown: [
        'Upper surface of mature leaves turns rusty bronze or brick-red',
        'Dull, dry appearance with reduced flushing of two leaves and a bud',
        'Defoliation of maintenance leaves during dry winter and pre-monsoon'
      ]
    }
  },
  {
    crop: 'pulse',
    categoryBn: 'ডাল ও মসুর',
    categoryEn: 'Pulses & Lentil',
    titleBn: 'মসুরের স্টেমফিলিয়াম ব্লাইট (পাতা পোড়া)',
    titleEn: 'Lentil Stemphylium Blight',
    descBn: 'গাছের ডালপালা ও পাতায় বাদামি দাগ হয়ে দ্রুত ঝরে পড়া',
    descEn: 'Small pinhead spots coalescing into brown foliage blight',
    sampleDiagnosis: {
      disease: 'Stemphylium Blight (Stemphylium botryosum)',
      diseaseBn: 'মসুরের স্টেমফিলিয়াম ব্লাইট বা পাতা ঝলসানো রোগ',
      confidence: 91,
      severity: 'High',
      qualitativeSeverity: 'High',
      cause: 'Overcast skies, heavy morning fog, and dense vegetative growth.',
      organicRemedy: 'Avoid dense seed broadcast; spray bio-fungicide Trichoderma suspension early.',
      chemicalRemedy: 'Iprodione (Rovral 50 WP) @ 2g/L or Azoxystrobin @ 1ml/L at first appearance of spots.',
      verificationAdvice: 'Check canopy during morning fog: leaves show water-soaked spots rapidly turning ash-grey.',
      symptomsBreakdown: [
        'Minute pinhead spots on leaflets rapidly expanding to blight the leaf',
        'Twigs and branches turn greyish-white and foliage drops prematurely',
        'Severe pod abortion resulting in empty or shriveled grains'
      ]
    }
  }
];

interface Props {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
  setGlobalLocation: (loc: { latitude: number; longitude: number }) => void;
  persistedImages?: { base64: string; mimeType: string }[];
  setPersistedImages?: (images: { base64: string; mimeType: string }[]) => void;
  persistedDiagnosis?: any | null;
  setPersistedDiagnosis?: (diagnosis: any | null) => void;
  persistedDeepDiagnosis?: any | null;
  setPersistedDeepDiagnosis?: (diagnosis: any | null) => void;
  persistedChatMessages?: { role: 'user' | 'model'; text: string }[];
  setPersistedChatMessages?: (messages: { role: 'user' | 'model'; text: string }[]) => void;
  persistedChatSession?: any | null;
  setPersistedChatSession?: (session: any | null) => void;
  persistedAudioUrl?: string | null;
  setPersistedAudioUrl?: (url: string | null) => void;
  persistedCropStage?: string;
  setPersistedCropStage?: (stage: string) => void;
  persistedCrop?: string;
  setPersistedCrop?: (crop: string) => void;
  persistedAnalysisType?: string;
  setPersistedAnalysisType?: (type: string) => void;
  persistedDescription?: string;
  setPersistedDescription?: (desc: string) => void;
  onNavigateTab?: (tab: any, payload?: any) => void;
}

export default function AgriCopilot({ 
  lang,
  globalLocation,
  setGlobalLocation,
  persistedImages,
  setPersistedImages,
  persistedDiagnosis,
  setPersistedDiagnosis,
  persistedDeepDiagnosis,
  setPersistedDeepDiagnosis,
  persistedChatMessages,
  setPersistedChatMessages,
  persistedChatSession,
  setPersistedChatSession,
  persistedAudioUrl,
  setPersistedAudioUrl,
  persistedCropStage,
  setPersistedCropStage,
  persistedCrop,
  setPersistedCrop,
  persistedAnalysisType,
  setPersistedAnalysisType,
  persistedDescription,
  setPersistedDescription,
  onNavigateTab
}: Props) {
  const [images, setImages] = useState<{ base64: string; mimeType: string }[]>(persistedImages || []);
  const [cropStage, setCropStage] = useState(persistedCropStage || '');
  const [crop, setCrop] = useState(persistedCrop || '');
  const [analysisType, setAnalysisType] = useState(persistedAnalysisType || '');
  const [description, setDescription] = useState(persistedDescription || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isFindingExpert, setIsFindingExpert] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any | null>(persistedDiagnosis || null);
  const [deepDiagnosis, setDeepDiagnosis] = useState<any | null>(persistedDeepDiagnosis || null);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(persistedAudioUrl || null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const isOnline = useNetworkStatus();
  const [selectedDistrict, setSelectedDistrict] = useState(geoData[0]?.id || '1');
  const [selectedUpazila, setSelectedUpazila] = useState(geoData[0]?.upazilas[0]?.id || '');
  const [locationAccuracy, setLocationAccuracy] = useState<number | undefined>(undefined);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>(persistedChatMessages || []);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const speechRecognitionRef = useRef<any>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  const [lastDiagnosisId, setLastDiagnosisId] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<any>(persistedChatSession || null);
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);
  const [copilotMode, setCopilotMode] = useState<'static_upload' | 'live_stream'>('live_stream');
  const [customContextText, setCustomContextText] = useState('');

  const scrollToContextSection = () => {
    const el = document.getElementById('agri-additional-context-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      const input = document.getElementById('custom-context-input-field');
      input?.focus();
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { canUse, incrementUsage, tier, currentUsage, limit } = useUsageTracking();
  const t = translations[lang];

  // Sync with persisted state
  React.useEffect(() => {
    if (setPersistedImages) setPersistedImages(images);
  }, [images, setPersistedImages]);

  useEffect(() => {
    if (setPersistedDiagnosis) setPersistedDiagnosis(diagnosis);
  }, [diagnosis, setPersistedDiagnosis]);

  useEffect(() => {
    if (setPersistedDeepDiagnosis) setPersistedDeepDiagnosis(deepDiagnosis);
  }, [deepDiagnosis, setPersistedDeepDiagnosis]);

  useEffect(() => {
    if (setPersistedChatMessages) setPersistedChatMessages(chatMessages);
  }, [chatMessages, setPersistedChatMessages]);

  useEffect(() => {
    if (setPersistedChatSession) setPersistedChatSession(chatSession);
  }, [chatSession, setPersistedChatSession]);

  useEffect(() => {
    if (setPersistedAudioUrl) setPersistedAudioUrl(audioUrl);
  }, [audioUrl, setPersistedAudioUrl]);

  useEffect(() => {
    if (setPersistedCropStage) setPersistedCropStage(cropStage);
  }, [cropStage, setPersistedCropStage]);

  useEffect(() => {
    if (setPersistedCrop) setPersistedCrop(crop);
  }, [crop, setPersistedCrop]);

  useEffect(() => {
    if (setPersistedAnalysisType) setPersistedAnalysisType(analysisType);
  }, [analysisType, setPersistedAnalysisType]);

  useEffect(() => {
    if (setPersistedDescription) setPersistedDescription(description);
  }, [description, setPersistedDescription]);

  const handleClearAll = () => {
    setImages([]);
    setCropStage('');
    setCrop('');
    setAnalysisType('');
    setDescription('');
    setDiagnosis(null);
    setDeepDiagnosis(null);
    setChatMessages([]);
    setChatSession(null);
    setAudioUrl(null);
    setChatSummary(null);
    setLastDiagnosisId(null);
    toast.success(lang === 'bn' ? 'ফলাফল মুছে নতুন রোগ নির্ণয়ের জন্য প্রস্তুত করা হয়েছে' : 'Ready for fresh diagnosis');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSampleDiagnosis = (sc: typeof SAMPLE_DIAGNOSIS_CASES[0]) => {
    setCrop(sc.crop);
    if (setPersistedCrop) setPersistedCrop(sc.crop);
    setDiagnosis(sc.sampleDiagnosis);
    if (setPersistedDiagnosis) setPersistedDiagnosis(sc.sampleDiagnosis);
    
    // Initialize active chat session for this sample
    const locationContext = globalLocation ? `GPS Coordinates: ${globalLocation.latitude}, ${globalLocation.longitude}` : "Bangladesh";
    const sampleDiagText = `${sc.sampleDiagnosis.diseaseBn} (${sc.sampleDiagnosis.disease}). Symptoms: ${sc.sampleDiagnosis.symptomsBreakdown.join(', ')}. Remedies: ${sc.sampleDiagnosis.chemicalRemedy}`;
    const session = startAgriChat(sampleDiagText, lang, locationContext);
    setChatSession(session);
    setChatMessages([]);
    setChatSummary(null);

    toast.success(lang === 'bn' ? `${sc.titleBn} নমুনা লোড হয়েছে` : `Loaded ${sc.titleEn} sample`);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const remainingSlots = 5 - images.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      try {
        const processedImages = await Promise.all(
          filesToProcess.map(async (file) => {
            const optimizedDataUrl = await resizeImage(file, 800);
            const base64Data = optimizedDataUrl.split(',')[1];
            return { base64: base64Data, mimeType: 'image/jpeg' };
          })
        );
        
        setImages(prev => [...prev, ...processedImages]);
        setDiagnosis(null);
        setDeepDiagnosis(null);
        setAudioUrl(null);
      } catch (error) {
        console.error("Error optimizing images:", error);
        toast.error(lang === 'bn' ? "ছবি প্রক্রিয়া করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" : "Failed to process one or more images. Please try again.");
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleVerifyWithExpert = () => {
    setIsFindingExpert(true);
    // Open maps directly with coordinates if available, otherwise general search
    let mapsUrl = '';
    if (globalLocation) {
      const query = encodeURIComponent("Department of Agricultural Extension");
      mapsUrl = `https://www.google.com/maps/search/${query}/@${globalLocation.latitude},${globalLocation.longitude},12z`;
    } else {
      const query = encodeURIComponent("Department of Agricultural Extension Bangladesh");
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    
    setTimeout(() => {
      window.open(mapsUrl, '_blank');
      setIsFindingExpert(false);
    }, 1500);
  };

  const activeDistrict = geoData.find(d => d.id === selectedDistrict);
  const activeUpazila = activeDistrict?.upazilas.find(u => u.id === selectedUpazila);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setLocationError(null);
    setIsManualLocation(false);

    try {
      const coords = await detectUserLocation();
      setGlobalLocation({
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      setLocationAccuracy(coords.accuracy);
      if (coords.permissionDenied) {
        setLocationError(lang === 'bn' ? "জিপিএস অনুমতি পাওয়া যায়নি; আঞ্চলিক কেন্দ্র ব্যবহার করা হচ্ছে।" : "GPS permission not granted; using approximate regional hub.");
      }
      setIsDetectingLocation(false);
    } catch (error: any) {
      const errorMsg = error?.message || (error?.code ? `Location error (code ${error.code})` : "Failed to detect location.");
      console.warn("Location detection notice in AgriCopilot:", errorMsg);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (error?.code === 1) msg = lang === 'bn' ? "জিপিএস অনুমতি দেওয়া হয়নি। ব্রাউজার পারমিশন চেক করুন অথবা ম্যানুয়ালি জেলা/উপজেলা নির্বাচন করুন।" : "Permission denied. Please allow location access in your browser or select your region manually.";
      else if (error?.code === 3) msg = lang === 'bn' ? "জিপিএস সংযোগ সময়সীমা অতিক্রম করেছে। অনুগ্রহ করে ম্যানুয়ালি এলাকা নির্বাচন করুন।" : "Location request timed out. Please select your region manually.";
      setLocationError(msg);
      setIsDetectingLocation(false);
      setIsManualLocation(true);
    }
  };

  const handleDistrictChange = (districtId: string) => {
    setSelectedDistrict(districtId);
    const dist = geoData.find(d => d.id === districtId);
    if (dist) {
      const firstUpazila = dist.upazilas[0];
      setSelectedUpazila(firstUpazila?.id || '');
      setGlobalLocation({
        latitude: firstUpazila?.lat || dist.lat,
        longitude: firstUpazila?.lng || dist.lng
      });
      setLocationAccuracy(undefined);
    }
  };

  const handleManualLocationChange = (upazilaId: string) => {
    setSelectedUpazila(upazilaId);
    const upazila = activeDistrict?.upazilas.find(u => u.id === upazilaId);
    if (upazila) {
      setGlobalLocation({
        latitude: upazila.lat,
        longitude: upazila.lng
      });
      setLocationAccuracy(undefined);
    }
  };

  const [isTranslating, setIsTranslating] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

  const handleTranslate = async () => {
    if (!diagnosis) return;
    setIsTranslating(true);
    try {
      const targetLang = lang === 'en' ? 'English' : 'Bengali';
      
      // Translate diagnosis
      const translatedDiagnosis = await translateText(diagnosis.diagnosis, targetLang);
      const translatedAdvice = await translateText(diagnosis.verificationAdvice, targetLang);
      
      setDiagnosis(prev => prev ? {
        ...prev,
        diagnosis: translatedDiagnosis,
        verificationAdvice: translatedAdvice
      } : null);

      // Generate new TTS
      try {
        const base64Audio = await generateSpeech(translatedDiagnosis);
        if (base64Audio) {
          const binary = atob(base64Audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          
          const blob = new Blob([bytes], { type: 'audio/wav' });
          setAudioUrl(URL.createObjectURL(blob));
        }
      } catch (ttsError) {
        console.error("TTS generation failed after translation:", ttsError);
      }
    } catch (error) {
      console.error("Translation error:", error);
      toast.error(lang === 'bn' ? "অনুবাদ করতে সমস্যা হয়েছে।" : "Failed to translate content.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChatMessage.trim() || isChatLoading) return;

    let activeSession = chatSession;
    if (!activeSession && diagnosis) {
      const diagText = diagnosis.disease || diagnosis.diseaseBn || diagnosis.diagnosis || 'Crop disease';
      const locationContext = globalLocation ? `GPS Coordinates: ${globalLocation.latitude}, ${globalLocation.longitude}` : "Bangladesh";
      activeSession = startAgriChat(diagText, lang, locationContext);
      setChatSession(activeSession);
    }
    if (!activeSession) return;

    const userMessage = currentChatMessage.trim();
    setCurrentChatMessage('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await activeSession.sendMessage({ message: userMessage });
      setChatMessages(prev => [...prev, { role: 'model', text: response.text || '' }]);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(t.tooltips.chatError);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleAddContextPrompt = async (contextSnippet: string) => {
    if (!diagnosis || isChatLoading) return;

    let activeSession = chatSession;
    if (!activeSession) {
      const diagText = diagnosis.disease || diagnosis.diseaseBn || diagnosis.diagnosis || 'Crop disease';
      const locationContext = globalLocation ? `GPS Coordinates: ${globalLocation.latitude}, ${globalLocation.longitude}` : "Bangladesh";
      activeSession = startAgriChat(diagText, lang, locationContext);
      setChatSession(activeSession);
    }

    const formattedPrompt = lang === 'bn'
      ? `আমার ফসলে নতুন লক্ষণ ও ফিল্ড পরিস্থিতি: "${contextSnippet}"। এই নতুন তথ্য অনুযায়ী আমার তাৎক্ষণিক কী সতর্কতা ও ব্যবস্থা নেওয়া উচিত?`
      : `Additional field context for this crop: "${contextSnippet}". Based on this specific condition, what immediate measures should I take and what should I apply or avoid?`;

    setChatMessages(prev => [...prev, { role: 'user', text: formattedPrompt }]);
    setIsChatLoading(true);

    try {
      const response = await activeSession.sendMessage({ message: formattedPrompt });
      setChatMessages(prev => [...prev, { role: 'model', text: response.text || '' }]);
      toast.success(lang === 'bn' ? 'নতুন তথ্যের আলোকে পরামর্শ যোগ করা হয়েছে' : 'Advisory updated with new context');
    } catch (error) {
      console.error("Chat context error:", error);
      toast.error(t.tooltips.chatError);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const toggleVoiceRecording = () => {
    if (isVoiceListening) {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (e) {}
      }
      setIsVoiceListening(false);
      return;
    }

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      toast.error(lang === 'bn' 
        ? 'আপনার ব্রাউজারে স্পিচ রিকগনিশন সমর্থিত নয়' 
        : 'Speech recognition is not supported in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsVoiceListening(true);
        setIsVoiceProcessing(false);
      };

      recognition.onresult = (event: any) => {
        setIsVoiceListening(false);
        setIsVoiceProcessing(true);
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setCurrentChatMessage(prev => prev ? `${prev} ${transcript}` : transcript);
        }
        setTimeout(() => {
          setIsVoiceProcessing(false);
        }, 600);
      };

      recognition.onerror = (event: any) => {
        setIsVoiceListening(false);
        setIsVoiceProcessing(false);
        if (event?.error !== 'no-speech') {
          toast.error(lang === 'bn' ? 'ভয়েস শনাক্ত করা যায়নি, আবার চেষ্টা করুন' : 'Could not detect voice, please try again');
        }
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
        setIsVoiceProcessing(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsVoiceListening(false);
      setIsVoiceProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  const handleSummarizeAndSave = async () => {
    if (chatMessages.length < 2 || isSummarizing) return;
    
    setIsSummarizing(true);
    try {
      const summary = await summarizeConversation(chatMessages, lang);
      setChatSummary(summary);
      
      if (user && lastDiagnosisId) {
        try {
          const diagRef = doc(db, 'diagnoses', lastDiagnosisId);
          await updateDoc(diagRef, {
            chatSummary: summary
          });
          toast.success(t.tooltips.summarySaved);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'diagnoses');
        }
      } else if (!user) {
        toast.success(lang === 'bn' ? 'সারাংশ তৈরি হয়েছে! সেভ করতে লগ-ইন করুন।' : 'Summary generated! Sign in to save permanently.');
      } else {
        toast.success(t.tooltips.summarySaved);
      }
    } catch (error) {
      console.error("Summarization Error:", error);
      toast.error(lang === 'bn' ? 'সারাংশ তৈরিতে সমস্যা হয়েছে।' : 'Failed to generate summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!diagnosis || isAudioGenerating) return;
    setIsAudioGenerating(true);
    try {
      const audioBase64 = await generateSpeech(diagnosis.diagnosis);
      if (audioBase64) {
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/wav' });
        setAudioUrl(URL.createObjectURL(blob));
      }
    } catch (error) {
      console.error("Audio generation failed, trying Web Speech fallback:", error);
      if ('speechSynthesis' in window) {
        try {
          const plainText = diagnosis.diagnosis.replace(/[*#_`]/g, '');
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(plainText);
          utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
          window.speechSynthesis.speak(utterance);
          toast.success(lang === 'bn' ? 'অডিও চালানো হচ্ছে...' : 'Playing voice advisory...');
        } catch (synthErr) {
          toast.error(lang === 'bn' ? 'অডিও তৈরিতে সমস্যা হয়েছে।' : 'Failed to generate audio advisory.');
        }
      } else {
        toast.error(lang === 'bn' ? 'অডিও তৈরিতে সমস্যা হয়েছে।' : 'Failed to generate audio advisory.');
      }
    } finally {
      setIsAudioGenerating(false);
    }
  };

  const handleDiagnose = async () => {
    if (images.length === 0) return;
    
    if (!isOnline) {
      toast.error(lang === 'bn' ? 'অফলাইনে কাজ হবে না। দয়া করে ইন্টারনেট সংযোগ চালু করুন।' : 'You are currently offline. Please connect to the internet to run this diagnosis.');
      return;
    }

    if (!canUse()) {
      toast.error(t.limitReached);
      return;
    }

    setIsLoading(true);
    setAudioUrl(null); // Reset audio for new diagnosis
    try {
      const analysisTypeStr = analysisType === 'disease' ? t.disease : analysisType === 'pest' ? t.pest : t.abiotic;
      // Use English values for the AI prompt to ensure consistency, but we can pass the translated ones too
      const cropName = translations.en.crops[crop as keyof typeof translations.en.crops];
      const stageName = translations.en.stages[cropStage as keyof typeof translations.en.stages];
      
      const result = await diagnoseCrop(
        images, 
        cropName, 
        stageName, 
        analysisTypeStr, 
        lang, 
        isAdvanced,
        globalLocation || undefined,
        description.trim() || undefined
      );
      setDiagnosis(result);
      
      // Initialize chat session
      const locationContext = globalLocation ? `GPS Coordinates: ${globalLocation.latitude}, ${globalLocation.longitude}` : "Bangladesh";
      const session = startAgriChat(result.diagnosis, lang, locationContext);
      setChatSession(session);
      setChatMessages([]);
      
      await incrementUsage();

      const allowedSeverities = ['Low', 'Medium', 'High'];
      const diagSeverity = allowedSeverities.includes(result.qualitativeSeverity) ? result.qualitativeSeverity : 'Medium';

      // Save to Firestore if user is logged in
      if (user) {
        try {
          const diagDoc = await addDoc(collection(db, 'diagnoses'), {
            userId: String(user.uid),
            crop: String(crop || ''),
            cropStage: String(cropStage || ''),
            analysisType: String(analysisType || ''),
            diagnosisText: String(result.diagnosis || 'No diagnosis provided'),
            qualitativeSeverity: String(diagSeverity),
            symptomsBreakdown: Array.isArray(result.symptomsBreakdown) ? result.symptomsBreakdown : [],
            verificationAdvice: String(result.verificationAdvice || 'Consult an expert.'),
            createdAt: new Date().toISOString()
          });
          setLastDiagnosisId(diagDoc.id);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'diagnoses');
        }
      }

      // Record in Farmer Credit & Insurance Dossier (both for logged in and guest users)
      const effectiveUid = user?.uid || 'guest_farmer_demo';
      const cropTitle = crop ? crop.trim() : '';
      recordFarmerInteractionEvent({
        userId: effectiveUid,
        fullName: user?.displayName || '',
        eventType: 'crop_diagnosis',
        title: cropTitle 
          ? (lang === 'bn' ? `${cropTitle} রোগ নির্ণয় ও স্বাস্থ্য মূল্যায়ন` : `${cropTitle} Disease Diagnosis & Health Scan`)
          : (lang === 'bn' ? 'ফসল রোগ নির্ণয় ও স্বাস্থ্য মূল্যায়ন' : 'Crop Health & Disease Evaluation'),
        summary: String(result.diagnosis || 'Diagnosis completed').substring(0, 1000),
        keyFacts: [
          ...(cropTitle ? [`ফসল: ${cropTitle}`] : []),
          `রোগের তীব্রতা: ${diagSeverity}`,
          `লক্ষণ: ${(result.symptomsBreakdown || []).slice(0, 2).join(', ') || 'পাতার দাগ/ক্ষতি'}`,
          `পরামর্শ: ${String(result.verificationAdvice || 'সঠিক বালাইনাশক ও সার ব্যবস্থাপনা').substring(0, 120)}`
        ],
        crop: cropTitle || undefined,
        district: selectedDistrict || undefined,
        insight: `নিয়মিত ফসলের স্বাস্থ্য পরীক্ষা করছেন (তীব্রতা: ${diagSeverity})`
      }).then(() => {
        toast.success(lang === 'bn' ? 'রোগ নির্ণয়ের তথ্য আপনার স্মার্ট কৃষক কার্ডে সংরক্ষিত হয়েছে!' : 'Logged to your Smart Krishi Dossier!');
      }).catch(err => console.warn(err));
    } catch (error: any) {
      console.error("Diagnosis failed:", error);
      const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
      const errorMsg = isQuotaError 
        ? (lang === 'bn' ? 'সিস্টেমের চাপ বেশি, দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।' : 'AI limit reached. Please try again in 5 minutes.')
        : (error.message || "Error connecting to AI service. Please try again.");
      
      setDiagnosis(null);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);

  const handleShareImage = async () => {
    if (!infographicRef.current || isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      // Small delay to ensure any layout shifts are settled
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(infographicRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: 1200,
        style: {
          transform: 'scale(1)',
          opacity: '1',
          visibility: 'visible',
        },
        fontEmbedCSS: '', // Try to avoid remote CSS if it causes issues, or leave default
      });
      
      // Convert dataUrl to Blob without using fetch
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch) throw new Error("Invalid data URL");
      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const file = new File([blob], 'agri-copilot-report.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: lang === 'bn' ? 'আমার ফসলের রিপোর্ট' : 'My Crop Report',
          text: lang === 'bn' ? 'কৃষি-কপিলট দিয়ে উৎপন্ন ফসল রিপোর্ট' : 'Crop report generated by Agri-Copilot',
        });
      } else {
        const link = document.createElement('a');
        link.download = `agri-report-${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success(lang === 'bn' ? 'রিপোর্ট কার্ডটি সেভ হয়েছে!' : 'Report card saved!');
      }
    } catch (err) {
      console.error("Image generation failed:", err);
      toast.error(lang === 'bn' ? 'ছবি তৈরিতে সমস্যা হয়েছে।' : 'Failed to generate image.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Sharing logic
  const handleShare = async () => {
    if (!diagnosis) return;

    const shareTitle = lang === 'bn' ? `কৃষি-কপিলট রিপোর্ট: ${diagnosis.diagnosis}` : `Agri-Copilot Report: ${diagnosis.diagnosis}`;
    
    let shareBody = lang === 'bn' 
      ? `🌱 *কৃষি-কপিলট ডায়াগনসিস রিপোর্ট*\n\n`
      : `🌱 *Agri-Copilot Diagnosis Report*\n\n`;

    shareBody += `📸 ${lang === 'bn' ? 'ফসল' : 'Crop'}: ${diagnosis.crop || 'Plant'}\n`;
    shareBody += `📍 ${lang === 'bn' ? 'অবস্থা' : 'Status'}: ${diagnosis.status}\n`;
    shareBody += `⚠️ ${lang === 'bn' ? 'তীব্রতা' : 'Severity'}: ${diagnosis.qualitativeSeverity}\n`;
    shareBody += `📋 ${lang === 'bn' ? 'লক্ষণ' : 'Symptoms'}: ${diagnosis.symptomsBreakdown?.join(', ')}\n`;
    shareBody += `🔍 ${lang === 'bn' ? 'নির্ণয়' : 'Diagnosis'}: ${diagnosis.diagnosis}\n\n`;

    if (deepDiagnosis) {
      shareBody += `🔬 *${lang === 'bn' ? 'গভীর বিশ্লেষণ' : 'Deep Analysis'}*\n`;
      shareBody += `📊 ${lang === 'bn' ? 'তীব্রতা স্কোর' : 'Severity Score'}: ${deepDiagnosis.severityScore}/10\n`;
      shareBody += `💡 ${lang === 'bn' ? 'পরামর্শ' : 'Expert Conclusion'}: ${deepDiagnosis.detailedDiagnosis.substring(0, 200)}...\n\n`;
    }

    shareBody += `${lang === 'bn' ? 'আরও জানতে দেখুন' : 'View more at'}: ${window.location.href}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareBody,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(shareBody);
        setIsSharing(true);
        setTimeout(() => setIsSharing(false), 2000);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }
  };

  const handleDeepDiagnose = async () => {
    if (!diagnosis || images.length === 0) return;
    
    if (!isOnline) {
      toast.error(lang === 'bn' ? 'অফলাইনে কাজ হবে না। দয়া করে ইন্টারনেট সংযোগ চালু করুন।' : 'You are currently offline. Please connect to the internet to run this diagnosis.');
      return;
    }

    if (!canUse()) {
      toast.error(t.limitReached);
      return;
    }

    setIsDeepAnalyzing(true);
    try {
      const analysisTypeStr = analysisType === 'disease' ? t.disease : analysisType === 'pest' ? t.pest : t.abiotic;
      const cropName = translations.en.crops[crop as keyof typeof translations.en.crops];
      const stageName = translations.en.stages[cropStage as keyof typeof translations.en.stages];
      
      const result = await deepDiagnoseCrop(
        images, 
        cropName, 
        stageName, 
        analysisTypeStr, 
        lang, 
        diagnosis,
        globalLocation || undefined,
        description.trim() || undefined
      );
      
      setDeepDiagnosis(result);
      await incrementUsage();

      // Save deep diagnosis to Firestore
      if (user && lastDiagnosisId) {
        try {
          await updateDoc(doc(db, 'diagnoses', lastDiagnosisId), {
            deepDiagnosis: result,
            deepDiagnosedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error("Failed to update diagnosis with deep analysis:", error);
        }
      }
    } catch (error: any) {
      console.error("Deep Diagnosis failed:", error);
      toast.error(lang === 'bn' ? 'গভীর বিশ্লেষণে সমস্যা হয়েছে।' : 'Error performing deep analysis. Please try again.');
    } finally {
      setIsDeepAnalyzing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 md:space-y-6 w-full"
    >
      {/* Ultra-Compact Main Header with Predictive Glow */}
      <div className="bg-white rounded-[24px] p-3 md:p-5 shadow-sm border border-gray-100 mb-4 relative overflow-hidden group w-full">
        {/* Predictive UI Glow Layer */}
        <motion.div 
          animate={{ 
            x: [0, 100, 0, -100, 0],
            y: [0, -50, 0, 50, 0],
            scale: [1, 1.2, 1, 0.8, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-green-400 blur-[100px] pointer-events-none"
        />
        
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3 md:space-x-5">
            <div className="bg-green-600 p-2 md:p-3 rounded-xl shadow-lg shadow-green-100 flex-shrink-0">
              <Radar className="w-5 h-5 md:w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-display font-black text-gray-900 tracking-tight leading-none uppercase">
                {t.agriCopilot}
              </h1>
              <p className="text-xs text-gray-500 font-medium mt-1">{t.agriCopilotDesc}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dual Mode Switcher: Live Video Multimodal Stream (Primary) vs Photo Prescription */}
      <div className="bg-emerald-950/5 dark:bg-emerald-950/20 p-1 rounded-2xl border border-emerald-500/20 w-full flex gap-1.5 shadow-xs">
        <button
          type="button"
          onClick={() => setCopilotMode('live_stream')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-display font-bold text-[11px] sm:text-xs uppercase tracking-wide transition-all cursor-pointer relative whitespace-nowrap ${
            copilotMode === 'live_stream'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-sm shadow-emerald-600/30'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'লাইভ ভিডিও এআই (প্রধান)' : 'Live Video AI (Primary)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setCopilotMode('static_upload')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-display font-bold text-[11px] sm:text-xs uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            copilotMode === 'static_upload'
              ? 'bg-white dark:bg-stone-800 text-emerald-950 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-800'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'ফটো প্রেসক্রিপশন' : 'Photo Prescription'}</span>
        </button>
      </div>

      {copilotMode === 'live_stream' ? (
        <div className="w-full">
          <LiveVideoCopilot 
            lang={lang} 
            locationContext={selectedDistrict ? `${selectedDistrict}, Bangladesh` : "Bangladesh"}
            onCaptureFrameForDeepDiagnosis={(dataUrl: string) => {
              const arr = dataUrl.split(',');
              const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
              const base64 = arr[1];
              if (base64) {
                setImages(prev => [{ base64, mimeType: mime }, ...prev.slice(0, 4)]);
                setCopilotMode('static_upload');
                toast.success(lang === 'bn' 
                  ? '📸 লাইভ ফ্রেম যুক্ত হয়েছে! এখন ডায়াগনসিস বাটনে চাপুন।' 
                  : '📸 Live frame captured! Ready for full prescription.');
              }
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col space-y-4 md:space-y-6 w-full">
          {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 bg-white p-4 md:p-6 rounded-[24px] md:rounded-[28px] border border-green-100 shadow-xl shadow-green-50/50 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4">
                <label className="block font-display font-black text-gray-700 uppercase tracking-wider text-xs sm:text-sm">{t.captureImage}</label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {images.length}/5 {lang === 'bn' ? 'টি ছবি' : 'Photos'}
                  </span>
                  {(images.length > 0 || crop || cropStage || analysisType || description || diagnosis) && (
                    <button
                      onClick={handleClearAll}
                      type="button"
                      className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                      aria-label="Clear all inputs"
                    >
                      {lang === 'bn' ? 'সব মুছুন' : 'Clear All'}
                    </button>
                  )}
                </div>
              </div>
              
              {images.length > 0 && (
                <div 
                  className="space-y-4 mb-4" 
                  role="region" 
                  aria-label={lang === 'bn' ? 'আপলোড করা ছবিগুলো' : 'Uploaded photos'}
                >
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3">
                    {images.map((img, idx) => (
                      <motion.div 
                        key={idx} 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative aspect-square rounded-2xl overflow-hidden border-2 border-green-100 group shadow-xs"
                      >
                        <img 
                          src={`data:${img.mimeType};base64,${img.base64}`} 
                          alt={lang === 'bn' ? `ফসলের ছবি ${idx + 1}` : `Crop photo ${idx + 1}`} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          aria-label={lang === 'bn' ? 'ছবিটি মুছুন' : 'Remove image'}
                          className="absolute top-1.5 right-1.5 bg-red-600/90 backdrop-blur-xs text-white p-1.5 rounded-xl opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-red-700 focus:opacity-100 focus:ring-2 focus:ring-red-400 outline-none shadow-xs"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  {images.length < 5 && (
                    <motion.label 
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-green-200 flex items-center justify-center cursor-pointer hover:bg-green-50 hover:border-green-400 transition-all bg-green-50/30 focus-within:ring-2 focus-within:ring-green-500 outline-none"
                    >
                      <Plus className="w-5 h-5 text-green-500 mr-2" aria-hidden="true" />
                      <span className="text-xs font-black text-green-600 uppercase tracking-widest">{t.addPhoto}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="sr-only" 
                        multiple={images.length === 0} 
                        aria-label={t.addPhoto}
                      />
                    </motion.label>
                  )}
                </div>
              )}

              {images.length === 0 && (
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  className="w-full bg-gradient-to-br from-green-50/70 to-white rounded-3xl p-6 sm:p-8 border-2 border-dashed border-green-200 flex flex-col items-center justify-center text-center group hover:border-green-400 transition-all cursor-pointer shadow-inner focus:ring-2 focus:ring-green-500 outline-none" 
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t.captureImage}
                >
                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm mb-3 group-hover:scale-105 transition-transform text-green-600 border border-green-100">
                    <Camera className="w-8 h-8 sm:w-10 sm:h-10" aria-hidden="true" />
                  </div>
                  <p className="text-sm sm:text-base font-bold text-gray-900 mb-1 tracking-tight">
                    {lang === 'bn' ? 'ক্যামেরা চালু করুন বা ছবি নির্বাচন করুন' : 'Tap to capture or select crop photo'}
                  </p>
                  <p className="text-xs text-gray-500 font-medium">
                    {lang === 'bn' ? 'আক্রান্ত পাতা, কাণ্ড বা ফলের পরিষ্কার ছবি দিন (সর্বোচ্চ ৫টি)' : 'Clear photos of affected plant leaf or fruit (up to 5)'}
                  </p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="sr-only" 
                    multiple
                    aria-hidden="true"
                  />
                </motion.button>
              )}
            </div>

            {diagnosis ? (
              <div className="space-y-2 pt-1">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDiagnose}
                  disabled={images.length === 0 || isLoading || !isOnline}
                  aria-busy={isLoading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-3.5 sm:py-4 px-5 rounded-2xl hover:shadow-lg hover:shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2.5 transition-all text-sm sm:text-base tracking-tight focus:ring-4 focus:ring-emerald-400 outline-none cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                      <span>{t.analyzing}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" aria-hidden="true" />
                      <span>{lang === 'bn' ? 'নতুন লক্ষণ/ছবি দিয়ে আপডেট' : 'Update with New Context'}</span>
                    </>
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer border border-stone-200 dark:border-stone-700 active:scale-98"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'ফলাফল মুছে নতুন পরীক্ষা শুরু করুন' : 'Clear Results & Start Over'}</span>
                </button>
              </div>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDiagnose}
                disabled={images.length === 0 || isLoading || !isOnline}
                aria-busy={isLoading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black py-4 sm:py-5 px-6 rounded-2xl hover:shadow-lg hover:shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-all text-base sm:text-lg tracking-tight focus:ring-4 focus:ring-green-400 outline-none relative overflow-hidden cursor-pointer"
              >
                {isLoading && (
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute inset-0 bg-white/20 skew-x-12"
                  />
                )}
                {isLoading ? (
                  <>
                    <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
                    <span>{t.analyzing}</span>
                  </>
                ) : (
                  <>
                    <Leaf className="w-7 h-7" aria-hidden="true" />
                    <span>{t.diagnoseDisease}</span>
                  </>
                )}
              </motion.button>
            )}

          </div>
        </motion.div>

        {/* Results Section with Monochromatic Skeleton & Flat Depth (Rank 8 & Rank 2) */}
        <div className="space-y-6 w-full">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div 
                key="skeleton"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-7 space-y-6 shadow-xs"
              >
                {/* Header Skeleton */}
                <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-44 bg-stone-200 dark:bg-stone-700 rounded-md animate-pulse" />
                      <div className="h-3 w-24 bg-stone-100 dark:bg-stone-800 rounded-md animate-pulse" />
                    </div>
                  </div>
                  <div className="h-6 w-20 bg-stone-100 dark:bg-stone-800 rounded-full animate-pulse" />
                </div>

                {/* Analysis Body Wireframe */}
                <div className="space-y-2.5">
                  <div className="h-3.5 w-4/5 bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
                  <div className="h-3.5 w-full bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
                  <div className="h-3.5 w-5/6 bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
                  <div className="h-3.5 w-2/3 bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
                </div>

                {/* Metric Cards Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div className="p-4 rounded-xl border border-stone-200/60 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 space-y-2">
                    <div className="h-3 w-28 bg-stone-200 dark:bg-stone-700 rounded animate-pulse" />
                    <div className="h-5 w-16 bg-stone-200 dark:bg-stone-700 rounded animate-pulse" />
                  </div>
                  <div className="p-4 rounded-xl border border-stone-200/60 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 space-y-2">
                    <div className="h-3 w-32 bg-stone-200 dark:bg-stone-700 rounded animate-pulse" />
                    <div className="h-5 w-24 bg-stone-200 dark:bg-stone-700 rounded animate-pulse" />
                  </div>
                </div>

                {/* Micro-Progress status */}
                <div className="flex items-center justify-center space-x-2 pt-2 text-stone-400 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{lang === 'bn' ? 'ফসলের লক্ষণ ও ক্ষত পরীক্ষা করা হচ্ছে...' : 'Analyzing crop pathology & disease markers...'}</span>
                </div>
              </motion.div>
            ) : diagnosis ? (
              <motion.div 
                key="result"
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 md:p-8 shadow-xs relative overflow-hidden h-full flex flex-col"
              >
                  <div ref={resultsRef} className="absolute top-0 left-0 w-1 h-1 pointer-events-none opacity-0" />
                  <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
                  
                  {/* Translation Loading Overlay */}
                  <AnimatePresence>
                    {isTranslating && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4"
                      >
                        <div className="relative">
                          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                          <Globe className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-blue-600 font-black uppercase tracking-widest text-xs animate-pulse">
                          {lang === 'bn' ? 'অনুবাদ করা হচ্ছে...' : 'Translating...'}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-10">
                      <div className="flex items-center space-x-3 sm:space-x-5">
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 sm:p-4 rounded-2xl shadow-xl shadow-green-100 shrink-0" aria-hidden="true">
                          <Leaf className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight mb-0.5 sm:mb-1">{t.diagnosisResult}</h3>
                          <div className="flex items-center">
                            <Calendar className="w-3.5 h-3.5 mr-1.5 text-green-500" aria-hidden="true" />
                            <span className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                              <span className="sr-only">{lang === 'bn' ? 'তারিখ:' : 'Date:'}</span>
                              {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 self-start sm:self-auto">
                        <button 
                          type="button"
                          onClick={handleClearAll}
                          aria-label={lang === 'bn' ? 'নতুন রোগ নির্ণয় শুরু করুন' : 'Start fresh diagnosis'}
                          title={lang === 'bn' ? 'বর্তমান ফলাফল মুছে নতুন রোগ পরীক্ষা শুরু করুন' : 'Clear results and start over'}
                          className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-black text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-rose-200 uppercase tracking-widest transition-all focus:ring-2 focus:ring-rose-400 outline-none shadow-xs active:scale-95 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{lang === 'bn' ? 'নতুন পরীক্ষা' : 'Start Over'}</span>
                        </button>

                        <button 
                          type="button"
                          onClick={scrollToContextSection}
                          aria-label={lang === 'bn' ? 'নতুন লক্ষণ বা তথ্য যোগ করুন' : 'Add new symptoms or context'}
                          title={lang === 'bn' ? 'ফসলের বর্তমান অবস্থা বা নতুন পরিস্থিতি যোগ করে পরামর্শ আপডেট করুন' : 'Add new field context or symptoms'}
                          className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 uppercase tracking-widest transition-all focus:ring-2 focus:ring-emerald-400 outline-none shadow-xs active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          <span>{lang === 'bn' ? 'নতুন তথ্য যোগ' : 'Add Context'}</span>
                        </button>

                        <button 
                          type="button"
                          onClick={handleTranslate}
                          disabled={isTranslating}
                          aria-label={lang === 'en' ? 'বাংলায় অনুবাদ করুন' : 'Translate to English'}
                          className="flex items-center space-x-1.5 sm:space-x-2 text-[10px] sm:text-[11px] font-black text-blue-700 bg-blue-50/80 hover:bg-blue-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-blue-100 uppercase tracking-widest transition-all focus:ring-2 focus:ring-blue-400 outline-none shadow-xs active:scale-95 cursor-pointer"
                        >
                          {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Globe className="w-3.5 h-3.5" aria-hidden="true" />}
                          <span>{lang === 'en' ? 'বাংলায় দেখুন' : 'View in English'}</span>
                        </button>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 bg-green-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-green-100 shadow-xs transition-all">
                          <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true"></div>
                          <span className="text-[10px] sm:text-[11px] font-black text-green-700 uppercase tracking-widest leading-none">AI Verified</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Guidance Ribbon: Start Over or Add Context */}
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-3 sm:p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs mb-2">
                      <div className="flex items-center space-x-2 text-xs text-stone-700 dark:text-stone-300">
                        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {lang === 'bn' ? 'ফলাফল পরবর্তী করণীয়:' : 'Next steps:'}
                        </span>
                        <span className="text-[11px] text-stone-600 dark:text-stone-400">
                          {lang === 'bn' 
                            ? 'প্রথম ব্যাচের ফলাফল পেয়েছেন? নতুন লক্ষণ/সার প্রয়োগের তথ্য যোগ করতে পারেন, অথবা অন্য ফসলের জন্য নতুন পরীক্ষা শুরু করতে পারেন।' 
                            : 'Got first batch results? Add new symptoms/fertilizer context to refine or start fresh for another crop.'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={scrollToContextSection}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{lang === 'bn' ? 'নতুন লক্ষণ যোগ' : 'Add Context'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="text-xs font-bold text-rose-700 dark:text-rose-400 hover:text-rose-800 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{lang === 'bn' ? 'নতুন পরীক্ষা' : 'Start Over'}</span>
                        </button>
                      </div>
                    </div>
                    
                    <div 
                      className="flex-1 space-y-10"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {diagnosis.status === 'Invalid' ? (
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="bg-red-50 border border-red-100 rounded-[2.5rem] p-10 flex items-start space-x-6 shadow-inner"
                        >
                          <div className="bg-white p-4 rounded-2xl shadow-sm text-red-500" aria-hidden="true">
                            <AlertTriangle className="w-10 h-10" />
                          </div>
                          <p className="text-red-900 font-bold text-xl leading-relaxed">{diagnosis.diagnosis}</p>
                        </motion.div>
                      ) : (
                        <>
                          {/* 1. AI Suggestion (Diagnosis Text) */}
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-white rounded-[2.5rem] p-10 md:p-14 border border-green-100/60 text-gray-800 shadow-sm relative overflow-hidden"
                            role="article"
                            aria-labelledby="diagnosis-heading"
                          >
                            <h4 id="diagnosis-heading" className="sr-only">{t.diagnosisResult}</h4>
                            <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-[0.03]" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(#166534 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }}></div>
                            
                            <div className="relative z-10">
                              <div className="flex items-center justify-between mb-8 border-b border-green-50 pb-5">
                                <span className="font-display font-black text-sm uppercase tracking-wider text-green-800">
                                  {lang === 'bn' ? 'রোগ নির্ণয় ও সমাধান' : 'Crop Diagnosis & Treatment'}
                                </span>
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(diagnosis.diagnosis);
                                      toast.success(lang === 'bn' ? 'কপি সফল হয়েছে' : 'Copied to clipboard');
                                    }}
                                    className="flex items-center justify-center bg-gray-50 text-gray-500 hover:text-green-600 hover:bg-green-50 p-2 rounded-full transition-all border border-gray-100 outline-none focus:ring-2 focus:ring-green-100"
                                    aria-label="Copy Diagnosis"
                                    title="Copy Diagnosis"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="markdown-body text-[1.25rem] md:text-[1.5rem] leading-[1.4] font-medium prose prose-green max-w-none text-gray-900 tracking-tight">
                                <ReactMarkdown>{diagnosis.diagnosis}</ReactMarkdown>
                              </div>

                              {/* Helpfulness Rating Section */}
                              <div className="mt-8 pt-6 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Feedback Algorithm Input</div>
                                  <p className="text-xs font-bold text-gray-500">{lang === 'en' ? 'Was this diagnosis helpful?' : 'এই পরামর্শটি কি আপনার উপকারে এসেছে?'}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button 
                                    disabled={feedbackGiven !== null}
                                    onClick={async () => {
                                      setFeedbackGiven('up');
                                      if (lastDiagnosisId) {
                                        try {
                                          await updateDoc(doc(db, 'diagnoses', lastDiagnosisId), { helpful: true });
                                          toast.success(lang === 'en' ? 'Thanks for your feedback!' : 'আপনার মতামতের জন্য ধন্যবাদ!');
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }
                                    }}
                                    className={`p-3 rounded-xl border flex items-center space-x-2 transition-all ${feedbackGiven === 'up' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-500 hover:text-green-600 disabled:opacity-50'}`}
                                  >
                                    <ThumbsUp className={`w-4 h-4 ${feedbackGiven === 'up' ? 'fill-current' : ''}`} />
                                    {feedbackGiven === 'up' && <span className="text-xs font-bold pr-1">{lang === 'bn' ? 'উপকারী' : 'Helpful'}</span>}
                                  </button>
                                  <button 
                                    disabled={feedbackGiven !== null}
                                    onClick={async () => {
                                      setFeedbackGiven('down');
                                      if (lastDiagnosisId) {
                                        try {
                                          await updateDoc(doc(db, 'diagnoses', lastDiagnosisId), { helpful: false });
                                          toast.success(lang === 'en' ? 'Thanks for your feedback!' : 'আপনার মতামতের জন্য ধন্যবাদ!');
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }
                                    }}
                                    className={`p-3 rounded-xl border flex items-center space-x-2 transition-all ${feedbackGiven === 'down' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-500 hover:text-red-600 disabled:opacity-50'}`}
                                  >
                                    <ThumbsDown className={`w-4 h-4 ${feedbackGiven === 'down' ? 'fill-current' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* TTS Audio Player or Generator */}
                            {!audioUrl ? (
                              <div className="mt-8 flex justify-center">
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={handleGenerateAudio}
                                  disabled={isAudioGenerating}
                                  className="flex items-center space-x-3 bg-green-50 text-green-700 font-black py-4 px-8 rounded-2xl border border-green-200 hover:bg-green-100 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                                >
                                  {isAudioGenerating ? (
                                    <>
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                      <span>{lang === 'bn' ? 'অডিও তৈরি হচ্ছে...' : 'Generating Audio...'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Volume2 className="w-5 h-5" />
                                      <span>{lang === 'bn' ? 'অডিও অডভাইজরি তৈরি করুন' : 'Generate Audio Advisory'}</span>
                                    </>
                                  )}
                                </motion.button>
                              </div>
                            ) : (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-10 bg-gradient-to-r from-emerald-100 to-green-100 rounded-[2rem] p-6 md:p-8 border-2 border-green-200/50 shadow-xl shadow-green-900/5 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 relative overflow-hidden"
                                role="region"
                                aria-label={lang === 'bn' ? 'এআই অডিও বিশ্লেষণ' : 'AI audio analysis'}
                              >
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                                <motion.div 
                                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                  className="bg-white p-5 rounded-2xl text-green-600 shadow-md relative z-10 border border-green-50"
                                  aria-hidden="true"
                                >
                                  <Volume2 className="w-10 h-10" />
                                </motion.div>
                                <div className="flex-1 w-full text-center md:text-left relative z-10">
                                  <p id="audio-analysis-label" className="text-sm font-black text-green-900 uppercase tracking-widest mb-3 drop-shadow-sm">
                                    {lang === 'bn' ? 'এআই অডিও শুনুন' : 'Listen to AI Analysis'}
                                  </p>
                                  <div className="bg-white/60 p-2 rounded-2xl shadow-inner border border-green-100/50">
                                    <audio 
                                      controls 
                                      src={audioUrl} 
                                      className="w-full h-12 rounded-xl"
                                      aria-labelledby="audio-analysis-label"
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </motion.div>

                          {/* 2. Verification Advice */}
                          <div className="bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700 rounded-2xl p-5 shadow-xs">
                            <div className="flex items-center space-x-2.5 mb-3">
                              <div className="bg-white dark:bg-stone-700 p-2 rounded-xl shadow-2xs">
                                <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <p className="text-xs font-bold text-stone-800 dark:text-stone-200">{t.confidenceAdvice}</p>
                            </div>
                            <div className="markdown-body text-xs sm:text-sm text-stone-700 dark:text-stone-300 font-normal mb-3 prose-stone dark:prose-invert leading-relaxed">
                              <ReactMarkdown>{diagnosis.verificationAdvice}</ReactMarkdown>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-stone-200/80 dark:border-stone-700 text-[11px] text-stone-600 dark:text-stone-400 font-medium">
                              <span>{lang === 'bn' ? '🏛️ স্থানীয় উপ-সহকারী কৃষি কর্মকর্তা (SAAO) বা কৃষি কল সেন্টারের ১৬১২৩ নম্বরে বিনামূল্যে পরামর্শ নিন' : '🏛️ Consult your local SAAO or dial toll-free Krishi Hotline 16123'}</span>
                              {diagnosis.confidence < 70 && (
                                <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.lowConfidenceWarning}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 3. Symptoms and Severity */}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            {/* Severity */}
                            <motion.div 
                              whileHover={{ y: -2 }}
                              className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/90 dark:border-stone-800 shadow-xs flex flex-col justify-center relative overflow-hidden"
                            >
                              <div className="flex items-center space-x-2.5 mb-3.5">
                                <div className="p-2 bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                                  <AlertTriangle className="w-4 h-4" />
                                </div>
                                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">{lang === 'bn' ? 'সংক্রমণের মাত্রা' : 'Severity Level'}</p>
                              </div>
                              
                              <div className="flex items-center space-x-3">
                                <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: diagnosis.qualitativeSeverity === 'High' ? '100%' : diagnosis.qualitativeSeverity === 'Medium' ? '60%' : '30%' }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className={`h-full ${
                                      diagnosis.qualitativeSeverity === 'High' ? 'bg-red-500' : 
                                      diagnosis.qualitativeSeverity === 'Medium' ? 'bg-amber-500' : 
                                      'bg-emerald-500'
                                    }`}
                                  />
                                </div>
                                <div className={`px-3.5 py-1.5 rounded-xl font-bold text-sm tabular-nums ${
                                  diagnosis.qualitativeSeverity === 'High' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300' : 
                                  diagnosis.qualitativeSeverity === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300' : 
                                  'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}>
                                  {diagnosis.qualitativeSeverity === 'High' && lang === 'bn' ? 'উচ্চ' : 
                                   diagnosis.qualitativeSeverity === 'Medium' && lang === 'bn' ? 'মাঝারি' : 
                                   diagnosis.qualitativeSeverity === 'Low' && lang === 'bn' ? 'নিম্ন' : 
                                   diagnosis.qualitativeSeverity || 'Unknown'}
                                </div>
                              </div>
                            </motion.div>

                            {/* Symptoms Breakdown */}
                            <motion.div 
                              whileHover={{ y: -2 }}
                              className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/90 dark:border-stone-800 shadow-xs relative overflow-hidden flex flex-col"
                            >
                              <div className="flex items-center space-x-2.5 mb-3.5">
                                <div className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl border border-stone-200 dark:border-stone-700">
                                  <Bug className="w-4 h-4" />
                                </div>
                                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">{lang === 'bn' ? 'শনাক্তকৃত লক্ষণ' : 'Visible Symptoms'}</p>
                              </div>
                              <ul className="space-y-2 flex-1 font-normal">
                                {diagnosis.symptomsBreakdown?.slice(0, 4).map((symptom: string, idx: number) => (
                                  <motion.li 
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.06 }}
                                    key={idx} 
                                    className="flex items-start text-xs text-stone-700 dark:text-stone-300"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 mt-1.5 shrink-0 mr-2"></div>
                                    <span className="leading-relaxed">{symptom}</span>
                                  </motion.li>
                                ))}
                              </ul>
                            </motion.div>
                          </div>

                          {/* Differential Diagnosis (Chain of Thought Output) */}
                          {(diagnosis.possibleDiseases?.length > 0 || diagnosis.differentialDiagnosis) && (
                            <motion.div 
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/90 dark:border-stone-800 shadow-xs relative z-10"
                            >
                              <h4 className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-3 flex items-center">
                                <Activity className="w-4 h-4 mr-2 text-stone-400" />
                                {lang === 'bn' ? 'সম্ভাব্য অন্যান্য রোগ ও লক্ষণ তুলনা' : 'Differential Diagnosis & Comparison'}
                              </h4>
                              
                              {diagnosis.possibleDiseases && diagnosis.possibleDiseases.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {diagnosis.possibleDiseases.map((disease: string, idx: number) => (
                                    <span key={idx} className="bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-lg text-xs font-bold">
                                      {disease}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {diagnosis.differentialDiagnosis && (
                                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                                  <p className="text-sm font-medium text-gray-700 leading-relaxed">
                                    <span className="font-bold text-orange-600 mr-2">Why this diagnosis?</span>
                                    {diagnosis.differentialDiagnosis}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* Deep Analysis Result or Button */}
                          {deepDiagnosis ? (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-8 bg-white border border-blue-100 rounded-[32px] p-4 md:p-8 shadow-md relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-80 pointer-events-none"></div>
                              <div className="relative z-10 space-y-6">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full">
                                      <div className="flex items-center space-x-3">
                                        <div className="bg-blue-600 p-3 rounded-2xl shadow-xl shadow-blue-200 flex-shrink-0">
                                          <ShieldAlert className="w-7 h-7 text-white" />
                                        </div>
                                        <div>
                                          <h3 className="font-display font-black text-blue-900 tracking-tight uppercase text-xl leading-none">{lang === 'bn' ? 'গভীর কৃষি বিশ্লেষণ' : 'Detailed Field Analysis'}</h3>
                                          <span className="text-xs font-semibold text-blue-600 mt-1 inline-block">
                                            {lang === 'bn' ? 'কৃষি গবেষণা ও বৈজ্ঞানিক তথ্যসূত্র ভিত্তিক' : 'Based on Agricultural Research & Field Data'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-4 bg-blue-50/50 px-6 py-3 rounded-2xl border border-blue-100 shadow-sm">
                                      <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest leading-none">{lang === 'bn' ? 'তীব্রতা স্কোর' : 'Severity Score'}</span>
                                      <div className="flex items-center space-x-1.5">
                                        <span className="text-2xl font-black text-blue-900 leading-none">{deepDiagnosis.severityScore || 'N/A'}</span>
                                        <span className="text-xs font-bold text-blue-400">/ 10</span>
                                      </div>
                                    </div>
                                  </div>

                                <div className="space-y-10">
                                  {/* Severity Meter */}
                                  <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                    <div className="flex items-center justify-between mb-3 px-1">
                                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{lang === 'bn' ? 'নিরাপদ' : 'Safe'}</span>
                                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{lang === 'bn' ? 'মারাত্মক' : 'Critical'}</span>
                                    </div>
                                    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                                      <div 
                                        className={`h-full transition-all duration-1000 shadow-sm ${
                                          (deepDiagnosis.severityScore || 0) <= 3 ? 'bg-gradient-to-r from-green-400 to-green-500' : 
                                          (deepDiagnosis.severityScore || 0) <= 7 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-orange-500 to-red-600'
                                        }`}
                                        style={{ width: `${(deepDiagnosis.severityScore || 0) * 10}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Step 1: Hypothesis Verification */}
                                  <div className="bg-blue-50/40 p-8 rounded-[2.5rem] border border-blue-100 shadow-sm relative overflow-hidden group hover:bg-blue-50/60 transition-colors">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none group-hover:scale-110 transition-transform"></div>
                                    <h4 className="flex items-center text-[10px] font-black text-blue-800 uppercase tracking-[0.3em] mb-6">
                                      <CheckCircle2 className="w-4 h-4 mr-2.5 text-blue-600" />
                                      {lang === 'bn' ? 'প্রাথমিক অনুমান যাচাই' : 'Initial Hypothesis Verification'}
                                    </h4>
                                    <div className="markdown-body text-[15px] text-blue-950 font-medium leading-relaxed">
                                      <ReactMarkdown>{deepDiagnosis.hypothesesEvaluation}</ReactMarkdown>
                                    </div>
                                  </div>

                                  {/* Step 2: Deductive Reasoning & Alternatives */}
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 space-y-6">
                                      <h4 className="flex items-center text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] pl-2">
                                        <Activity className="w-4 h-4 mr-2.5 text-indigo-500" />
                                        {lang === 'bn' ? 'ডিফারেনশিয়াল যুক্তি এবং প্রমাণ' : 'Differential Reasoning & Evidence'}
                                      </h4>
                                      <div className="markdown-body text-[15px] text-gray-800 leading-relaxed bg-white p-7 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                        <ReactMarkdown>{deepDiagnosis.differentialReasoning}</ReactMarkdown>
                                      </div>
                                    </div>
                                    <div className="space-y-6">
                                      <h4 className="flex items-center text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] pl-2">
                                        <HelpCircle className="w-4 h-4 mr-2.5 text-gray-400" />
                                        {lang === 'bn' ? 'বিকল্প সম্ভাবনা' : 'Possible Alternatives'}
                                      </h4>
                                      <div className="space-y-3">
                                        {deepDiagnosis.possibleAlternatives?.map((alt: string, idx: number) => (
                                          <motion.div 
                                            key={idx}
                                            whileHover={{ x: 4 }}
                                            className="bg-gray-50/80 px-5 py-4 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-3 group"
                                          >
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-indigo-400 transition-colors"></div>
                                            <span className="text-xs font-black text-gray-700 tracking-tight">{alt}</span>
                                          </motion.div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Step 3: Final Detailed Diagnosis */}
                                  <div className="bg-white p-8 md:p-10 rounded-[3rem] border-2 border-green-50 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-40 pointer-events-none"></div>
                                    <h4 className="flex items-center text-[10px] font-black text-green-700 uppercase tracking-[0.3em] mb-6">
                                      <Plus className="w-4 h-4 mr-2.5 text-green-600" />
                                      {lang === 'bn' ? 'চূড়ান্ত বিস্তারিত নির্ণয়' : 'Final Detailed Diagnosis'}
                                    </h4>
                                    <div className="markdown-body text-lg text-gray-950 font-black leading-tight tracking-tight mb-4">
                                      <ReactMarkdown>{deepDiagnosis.detailedDiagnosis}</ReactMarkdown>
                                    </div>
                                  </div>

                                  {/* Step 4: Advanced Treatment (Exact Dosages) & Precision Spray Engine */}
                                  <div className="space-y-6">
                                    <div className="bg-emerald-600/95 backdrop-blur-md p-8 md:p-10 rounded-[3.5rem] shadow-2xl shadow-emerald-200/50 text-white relative overflow-hidden group">
                                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                      <h4 className="flex items-center text-[10px] font-black text-emerald-100 uppercase tracking-[0.4em] mb-8">
                                        <ShieldAlert className="w-5 h-5 mr-3 text-white" />
                                        {lang === 'bn' ? 'উন্নত চিকিৎসা ব্যবস্থা এবং সঠিক মাত্রা' : 'Advanced Treatment & Exact Dosages'}
                                      </h4>
                                      <div className="markdown-body text-white/95 text-[15px] font-medium leading-relaxed space-y-4">
                                        <ReactMarkdown>{deepDiagnosis.advancedTreatment}</ReactMarkdown>
                                      </div>
                                    </div>

                                    {/* Integrated Precision Spray & Knapsack Dosage Engine */}
                                    <DosageCalculator 
                                      lang={lang}
                                      cropName={crop ? t.crops[crop as keyof typeof t.crops] || crop : 'Crop'}
                                      treatmentText={deepDiagnosis.advancedTreatment || deepDiagnosis.detailedDiagnosis || diagnosis.diagnosis}
                                    />
                                  </div>

                                  {/* Step 5: Timeline & Context */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-amber-50/50 p-7 rounded-[2.5rem] border border-amber-100 shadow-sm hover:bg-amber-50/80 transition-colors">
                                      <h4 className="flex items-center text-[10px] font-black text-amber-800 uppercase tracking-[0.3em] mb-5">
                                        <Calendar className="w-4 h-4 mr-2.5 text-amber-600" />
                                        {lang === 'bn' ? 'সফলতার সময়সীমা' : 'Actionable Timeline'}
                                      </h4>
                                      <div className="markdown-body text-[13px] text-amber-950 font-bold leading-relaxed">
                                        <ReactMarkdown>{deepDiagnosis.recoveryTimeline}</ReactMarkdown>
                                      </div>
                                    </div>
                                    <div className="bg-indigo-50/50 p-7 rounded-[2.5rem] border border-indigo-100 shadow-sm hover:bg-indigo-50/80 transition-colors">
                                      <h4 className="flex items-center text-[10px] font-black text-indigo-800 uppercase tracking-[0.3em] mb-5">
                                        <Globe className="w-4 h-4 mr-2.5 text-indigo-600" />
                                        {lang === 'bn' ? 'পরিবেশ ও প্রাদুর্ভাবের তথ্য' : 'Environmental & Outbreak Context'}
                                      </h4>
                                      <div className="markdown-body text-[13px] text-indigo-950 font-bold leading-relaxed">
                                        <ReactMarkdown>{deepDiagnosis.environmentalContext}</ReactMarkdown>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Technical Details (Pathogen) - Moved to bottom */}
                                  <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-200 opacity-60 hover:opacity-100 transition-opacity">
                                    <h4 className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">
                                      <Bug className="w-3 h-3 mr-2" />
                                      {lang === 'bn' ? 'প্রযুক্তিগত তথ্য (প্যাথোজেন)' : 'Technical Pathogen Data'}
                                    </h4>
                                    <p className="text-[11px] font-bold text-gray-500 leading-relaxed italic">
                                      {deepDiagnosis.biologicalCause}
                                    </p>
                                  </div>
                                  
                                  {deepDiagnosis.sources && deepDiagnosis.sources.length > 0 && (
                                    <div className="pt-4 border-t border-gray-100">
                                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{lang === 'bn' ? 'যাচাইকৃত তথ্যসূত্র' : 'Verified Sources'}</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {deepDiagnosis.sources.map((source: string, idx: number) => (
                                          <div key={idx} className="flex items-center space-x-2 text-[10px] bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                            <Globe className="w-2.5 h-2.5 text-gray-400" />
                                            <span className="text-gray-500 font-bold max-w-[150px] truncate">{source.replace(/https?:\/\/(www\.)?/, '')}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            <div className="mt-8 flex justify-center">
                              <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleDeepDiagnose}
                                disabled={isDeepAnalyzing}
                                className="group relative inline-flex items-center justify-center space-x-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black py-4 px-8 rounded-2xl hover:shadow-xl hover:shadow-blue-200 disabled:opacity-50 transition-all focus:ring-4 focus:ring-blue-400 outline-none w-full sm:w-auto"
                              >
                                {isDeepAnalyzing ? (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="uppercase tracking-widest">{lang === 'bn' ? 'বিশ্লেষণ করা হচ্ছে...' : 'Performing Deep Analysis...'}</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <Globe className="w-5 h-5 relative z-10" />
                                    <span className="uppercase tracking-widest relative z-10">
                                      {lang === 'bn' ? 'যাচাই ও গভীর বিশ্লেষণ করুন' : 'Verify & Deep Analysis'}
                                    </span>
                                  </>
                                )}
                              </motion.button>
                            </div>
                          )}

                          {/* Chatbot Section (Moved after Deep Analysis) */}
                          <div className="mt-8">
                            <div className="mt-8 pt-8 border-t border-gray-100">
                              <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-3">
                                  <div className="bg-green-100 p-2.5 rounded-xl shadow-inner">
                                    <MessageSquare className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div>
                                    <h4 className="font-black text-gray-900 text-lg tracking-tight">{lang === 'bn' ? 'কৃষি বিশেষজ্ঞের সাথে কথা বলুন' : 'Chat with Expert AI'}</h4>
                                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-black mt-0.5">{lang === 'bn' ? 'এই রোগ সম্পর্কে আরও কিছু জানতে চান?' : 'Want to know more about this disease?'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                  <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Expert Online</span>
                                </div>
                              </div>

                              {diagnosis && (
                                <div className="space-y-4 mb-6">
                                  <LiveExpertCall 
                                    diagnosisContext={`Crop: ${crop}. Stage: ${cropStage}. Diagnosis: ${diagnosis.diagnosis}. Symptoms recognized: ${diagnosis.symptomsBreakdown?.join(', ')}. Action plan: ${diagnosis.verificationAdvice}`} 
                                    lang={lang} 
                                    locationContext={globalLocation ? `GPS: ${globalLocation.latitude}, ${globalLocation.longitude}` : "Bangladesh"} 
                                  />

                                   {/* Quick Field Context Injector */}
                                  <div 
                                    id="agri-additional-context-section"
                                    className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/60 rounded-2xl p-3.5 sm:p-4 shadow-2xs scroll-mt-24"
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-2.5">
                                      <div className="flex items-center space-x-2">
                                        <div className="p-1 rounded-lg bg-emerald-600 text-white">
                                          <Sparkles className="w-3.5 h-3.5" />
                                        </div>
                                        <h5 className="text-xs font-black text-emerald-950 dark:text-emerald-200 tracking-tight">
                                          {lang === 'bn' ? 'নতুন ফিল্ড লক্ষণ বা অতিরিক্ত তথ্য যোগ করুন:' : 'Add Field Context & Symptoms:'}
                                        </h5>
                                      </div>
                                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                                        {lang === 'bn' ? '১-ক্লিকে প্রেসক্রিপশন আপডেট' : '1-Click Refine'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 mb-2.5 leading-snug">
                                      {lang === 'bn' 
                                        ? 'জমির সাম্প্রতিক অবস্থা বা লক্ষণ নির্বাচন করুন, অথবা নিচে লিখে পাঠান। এআই তাত্ক্ষণিকভাবে নতুন পরিস্থিতির আলোকে করণীয় আপডেট করে দেবে:' 
                                        : 'Select recent observations or type below to immediately refine advisory with new context:'}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                                      {[
                                        { bn: 'মাটিতে অতিরিক্ত পানি জমে আছে', en: 'Waterlogged soil condition' },
                                        { bn: '২ দিন আগে কীটনাশক স্প্রে করা হয়েছে', en: 'Sprayed pesticide 2 days ago' },
                                        { bn: 'পাতা দ্রুত হলুদ হয়ে ঝরে পড়ছে', en: 'Leaves turning yellow and falling rapidly' },
                                        { bn: 'পাতার নিচে সাদা মাছি বা কীড়া দেখা যাচ্ছে', en: 'Whiteflies or caterpillars visible under leaf' },
                                        { bn: 'আশেপাশের জমিতেও একই সংক্রমণ ছড়িয়েছে', en: 'Spreading across neighboring fields' },
                                        { bn: 'ইউরিয়া সার বেশি প্রয়োগ করা হয়েছিল', en: 'Excess urea fertilizer applied recently' },
                                        { bn: 'গাছের বয়স ৩০-৪০ দিন (ফুল ধরার পর্যায়)', en: 'Plant age 30-40 days (flowering stage)' }
                                      ].map((tag, tagIdx) => (
                                        <button
                                          key={tagIdx}
                                          type="button"
                                          onClick={() => handleAddContextPrompt(lang === 'bn' ? tag.bn : tag.en)}
                                          disabled={isChatLoading}
                                          className="text-[11px] font-medium bg-white dark:bg-stone-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-stone-700 dark:text-stone-300 hover:text-emerald-900 dark:hover:text-emerald-200 px-2.5 py-1.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/80 transition-all active:scale-95 text-left flex items-center space-x-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                                        >
                                          <span className="text-emerald-600 font-black">+</span>
                                          <span>{lang === 'bn' ? tag.bn : tag.en}</span>
                                        </button>
                                      ))}
                                    </div>

                                    {/* Custom Context Field Input Form */}
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        if (!customContextText.trim() || isChatLoading) return;
                                        handleAddContextPrompt(customContextText.trim());
                                        setCustomContextText('');
                                      }}
                                      className="flex items-center gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40"
                                    >
                                      <input
                                        id="custom-context-input-field"
                                        type="text"
                                        value={customContextText}
                                        onChange={(e) => setCustomContextText(e.target.value)}
                                        placeholder={lang === 'bn' ? 'অথবা আপনার নিজস্ব লক্ষণ বা তথ্য লিখুন (যেমন: গতকাল বৃষ্টি হয়েছে)...' : 'Or type custom symptoms/context (e.g., heavy rain yesterday)...'}
                                        className="flex-1 bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-700/80 rounded-xl px-3 py-2 text-xs text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
                                      />
                                      <button
                                        type="submit"
                                        disabled={!customContextText.trim() || isChatLoading}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shrink-0 transition-all flex items-center space-x-1 cursor-pointer active:scale-95 shadow-xs"
                                      >
                                        <span>{lang === 'bn' ? 'যুক্ত করুন' : 'Apply'}</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    </form>
                                  </div>
                                </div>
                              )}

                              <div 
                                className="bg-gray-50/50 backdrop-blur-sm rounded-[24px] border border-gray-100 overflow-hidden flex flex-col h-[400px] shadow-inner relative"
                                role="log"
                                aria-live="polite"
                                aria-label={lang === 'bn' ? 'চ্যাট ইতিহাস' : 'Chat history'}
                              >
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                  {chatMessages.length === 0 && !chatSummary && (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-300">
                                      <motion.div 
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="bg-white p-4 rounded-[24px] shadow-sm mb-4"
                                        aria-hidden="true"
                                      >
                                        <Bot className="w-8 h-8 opacity-40" />
                                      </motion.div>
                                      <p className="text-xs font-bold max-w-[200px] leading-relaxed">{lang === 'bn' ? 'আপনার প্রশ্ন জিজ্ঞাসা করুন...' : 'Ask your follow-up questions here......'}</p>
                                    </div>
                                  )}

                                  {chatSummary && (
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      className="bg-green-50 border border-green-100 p-6 rounded-[32px] mb-4 shadow-sm"
                                      role="article"
                                      aria-label={t.tooltips.chatSummaryTitle}
                                    >
                                      <div className="flex items-center space-x-2 text-green-700 mb-3">
                                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                                        <h4 className="text-xs font-black uppercase tracking-widest leading-none">{t.tooltips.chatSummaryTitle}</h4>
                                      </div>
                                      <div className="markdown-body prose-sm prose-green leading-relaxed text-green-900 text-xs">
                                        <ReactMarkdown>{chatSummary}</ReactMarkdown>
                                      </div>
                                    </motion.div>
                                  )}

                                  {!chatSummary && chatMessages.map((msg, idx) => (
                                    <motion.div 
                                      key={idx} 
                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div className={`max-w-[85%] p-4 rounded-[20px] text-xs shadow-md relative ${
                                        msg.role === 'user' 
                                          ? 'bg-gradient-to-br from-green-600 to-emerald-600 text-white rounded-tr-none' 
                                          : 'bg-white text-gray-800 border border-gray-50 rounded-tl-none'
                                      }`}>
                                        <div className={`flex items-center space-x-1.5 mb-1.5 opacity-70 text-[9px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-green-100' : 'text-gray-400'}`}>
                                          {msg.role === 'user' ? <User className="w-3 h-3" aria-hidden="true" /> : <Bot className="w-3 h-3" aria-hidden="true" />}
                                          <span>{msg.role === 'user' ? (lang === 'bn' ? 'আপনি' : 'You') : (lang === 'bn' ? 'বিশেষজ্ঞ এআই' : 'Expert AI')}</span>
                                        </div>
                                        <div className="markdown-body leading-relaxed text-xs prose-sm prose-invert">
                                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                  {isChatLoading && (
                                    <motion.div 
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      className="flex justify-start items-end space-x-2"
                                      aria-label={t.tooltips.aiThinking}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center border border-green-200">
                                        <Bot className="w-4 h-4 text-green-600" />
                                      </div>
                                      <div className="bg-white border border-gray-100 p-4 rounded-[20px] rounded-bl-none shadow-md flex flex-col space-y-2">
                                        <div className="flex space-x-1.5 ml-1">
                                          <motion.div 
                                            animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }} 
                                            transition={{ repeat: Infinity, duration: 1 }} 
                                            className="w-1.5 h-1.5 bg-green-500 rounded-full"
                                          ></motion.div>
                                          <motion.div 
                                            animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }} 
                                            transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} 
                                            className="w-1.5 h-1.5 bg-green-500 rounded-full"
                                          ></motion.div>
                                          <motion.div 
                                            animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }} 
                                            transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} 
                                            className="w-1.5 h-1.5 bg-green-500 rounded-full"
                                          ></motion.div>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.tooltips.aiThinking}</span>
                                      </div>
                                    </motion.div>
                                  )}
                                  <div ref={chatEndRef} />
                                </div>
                                
                                <div className="p-3 bg-white border-t border-gray-100 flex flex-col space-y-2">
                                  {chatMessages.length >= 2 && !chatSummary && (
                                    <button
                                      type="button"
                                      onClick={handleSummarizeAndSave}
                                      disabled={isSummarizing || isChatLoading}
                                      className="w-full flex items-center justify-center space-x-3 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 rounded-xl border border-indigo-200/50 shadow-sm transition-all text-[11px] font-black uppercase tracking-widest disabled:opacity-50 mb-2 focus:ring-2 focus:ring-indigo-400 outline-none group"
                                    >
                                      {isSummarizing ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                          <span>{t.tooltips.summarizing}</span>
                                        </>
                                      ) : (
                                        <>
                                          <div className="bg-indigo-600 p-1.5 rounded-lg group-hover:scale-110 transition-transform">
                                            <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                                          </div>
                                          <span>{t.tooltips.saveSummary}</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  
                                  <div className="relative flex items-center">
                                    <label htmlFor="chat-input" className="sr-only">{lang === 'bn' ? 'আপনার প্রশ্ন' : 'Your question'}</label>
                                    <input
                                      id="chat-input"
                                      type="text"
                                      value={currentChatMessage}
                                      onChange={(e) => setCurrentChatMessage(e.target.value)}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSendMessage(e as any);
                                        }
                                      }}
                                      placeholder={
                                        isVoiceListening 
                                          ? (lang === 'bn' ? 'শুনছি... আপনার প্রশ্ন বলুন...' : 'Listening... Speak your question...')
                                          : isVoiceProcessing 
                                            ? (lang === 'bn' ? 'প্রসেসিং হচ্ছে...' : 'Processing voice...') 
                                            : (lang === 'bn' ? 'আপনার প্রশ্ন লিখুন বা মুখে বলুন...' : 'Type or speak your question...')
                                      }
                                      disabled={!diagnosis || isChatLoading || !!chatSummary}
                                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 pl-4 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 transition-all font-medium"
                                    />
                                    <div className="absolute right-2 flex items-center space-x-1.5">
                                      {/* Voice recording button with subtle Framer Motion feedback */}
                                      <div className="relative flex items-center justify-center">
                                        {isVoiceListening && (
                                          <>
                                            <motion.span
                                              className="absolute -inset-1.5 rounded-xl border border-red-500/60 pointer-events-none"
                                              animate={{ scale: [1, 1.4], opacity: [0.7, 0] }}
                                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                                            />
                                            <motion.span
                                              className="absolute -inset-0.5 rounded-xl bg-red-500/20 pointer-events-none"
                                              animate={{ scale: [1, 1.2], opacity: [0.5, 0] }}
                                              transition={{ duration: 1.5, delay: 0.3, repeat: Infinity, ease: 'easeOut' }}
                                            />
                                          </>
                                        )}
                                        {isVoiceProcessing && (
                                          <motion.span
                                            className="absolute -inset-1 rounded-xl border-2 border-dashed border-teal-500/70 pointer-events-none"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                          />
                                        )}
                                        <motion.button
                                          type="button"
                                          onClick={toggleVoiceRecording}
                                          disabled={!diagnosis || isChatLoading || !!chatSummary}
                                          aria-label={
                                            isVoiceListening
                                              ? (lang === 'bn' ? 'রেকর্ডিং বন্ধ করুন' : 'Stop voice recording')
                                              : (lang === 'bn' ? 'ভয়েসে প্রশ্ন বলুন' : 'Ask question by voice')
                                          }
                                          title={
                                            isVoiceListening
                                              ? (lang === 'bn' ? 'শুনছে... বন্ধ করতে চাপুন' : 'Listening... tap to finish')
                                              : isVoiceProcessing
                                                ? (lang === 'bn' ? 'প্রসেসিং হচ্ছে...' : 'Processing voice...')
                                                : (lang === 'bn' ? 'ভয়েসে প্রশ্ন বলুন' : 'Ask question by voice')
                                          }
                                          whileHover={{ scale: 1.08 }}
                                          whileTap={{ scale: 0.92 }}
                                          animate={
                                            isVoiceListening
                                              ? {
                                                  scale: [1, 1.1, 1],
                                                  boxShadow: [
                                                    '0 0 6px rgba(239, 68, 68, 0.3)',
                                                    '0 0 14px rgba(239, 68, 68, 0.6)',
                                                    '0 0 6px rgba(239, 68, 68, 0.3)'
                                                  ]
                                                }
                                              : isVoiceProcessing
                                              ? {
                                                  scale: [1, 0.95, 1],
                                                  boxShadow: '0 0 10px rgba(20, 184, 166, 0.4)'
                                                }
                                              : { scale: 1 }
                                          }
                                          transition={{
                                            duration: isVoiceProcessing ? 1.2 : 1.6,
                                            repeat: (isVoiceListening || isVoiceProcessing) ? Infinity : 0,
                                            ease: 'easeInOut'
                                          }}
                                          className={`p-2 rounded-xl transition-colors shadow-sm focus:ring-2 focus:ring-green-400 outline-none relative z-10 ${
                                            isVoiceListening
                                              ? 'bg-red-500 text-white'
                                              : isVoiceProcessing
                                              ? 'bg-teal-600 text-white'
                                              : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600'
                                          } disabled:opacity-40`}
                                        >
                                          {isVoiceProcessing ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Mic className={`w-4 h-4 ${isVoiceListening ? 'animate-pulse' : ''}`} />
                                          )}
                                        </motion.button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={handleSendMessage}
                                        disabled={!currentChatMessage.trim() || !diagnosis || isChatLoading || !!chatSummary}
                                        aria-label={lang === 'bn' ? 'বার্তা পাঠান' : 'Send message'}
                                        className="p-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 transition-all shadow-sm focus:ring-2 focus:ring-green-400 outline-none"
                                      >
                                        <Send className="w-4 h-4" aria-hidden="true" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 4. Chat with Expert (Search DAE) - Indicative */}
                          <div className="flex justify-center pt-2 pb-4">
                            <motion.button 
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleVerifyWithExpert}
                              disabled={isFindingExpert}
                              className="text-gray-500 hover:text-blue-600 py-3 px-6 rounded-full text-xs font-bold uppercase tracking-widest flex items-center justify-center space-x-2 transition-all border border-transparent hover:border-blue-100 hover:bg-blue-50 cursor-pointer"
                            >
                              {isFindingExpert ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                              <span>{isFindingExpert ? t.findingExpert : t.verifyWithExpert} (Indicative)</span>
                            </motion.button>
                          </div>

                          {/* 5. Start Fresh / Reset Card */}
                          <div className="p-4 sm:p-5 rounded-2xl bg-stone-100/90 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left mt-4 shadow-2xs">
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center justify-center sm:justify-start space-x-1.5">
                                <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                                <span>{lang === 'bn' ? 'অন্য কোনো ফসলের রোগ নির্ণয় করতে চান?' : 'Need to diagnose another plant or crop?'}</span>
                              </h4>
                              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                {lang === 'bn' 
                                  ? 'বর্তমান ফলাফল মুছে নতুন ছবি, লাইভ ভিডিও বা নমুনা দিয়ে শুরু করতে পারেন।' 
                                  : 'Reset current results to capture fresh photos, use live video AI, or test sample cases.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleClearAll}
                              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shrink-0 transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'নতুন পরীক্ষা শুরু করুন' : 'Start Fresh Scan'}</span>
                            </button>
                          </div>

                          {/* 6. Cross-Module Deep-Links & Connected Services (Always placed at the absolute end) */}
                          {onNavigateTab && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-950 rounded-[2.2rem] p-5 sm:p-6 text-white shadow-xl border border-emerald-800/80 my-4 relative overflow-hidden"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2.5">
                                  <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30">
                                    <Sparkles className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-display font-black text-xs uppercase tracking-widest text-white leading-tight">
                                      {lang === 'bn' ? 'সম্পর্কিত ডিজিটাল কৃষি সেবা' : 'Linked Agricultural Modules'}
                                    </h4>
                                    <p className="text-[11px] text-emerald-300 font-medium">
                                      {lang === 'bn' ? 'এই ফসলের বাজার ও রোগ প্রতিরোধে সরাসরি যুক্ত হোন' : 'Seamlessly connect with market and diagnostic tools'}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] bg-emerald-500 text-emerald-950 font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm shrink-0">
                                  {crop ? (t.crops[crop as keyof typeof t.crops] || crop) : (lang === 'bn' ? 'স্মার্ট সেবা' : 'Smart Action')}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {/* 1. Krishi Profit */}
                                <button
                                  type="button"
                                  onClick={() => onNavigateTab('krishi-profit', { crop: crop || 'potato' })}
                                  className="flex items-center space-x-3 p-3 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl text-left transition-all group min-h-[48px] cursor-pointer"
                                >
                                  <div className="p-2.5 bg-emerald-400 text-emerald-950 rounded-xl group-hover:scale-105 transition-transform shrink-0 shadow-sm">
                                    <Calculator className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-black text-xs text-white leading-tight truncate flex items-center justify-between">
                                      <span>{lang === 'bn' ? 'উৎপাদন ব্যয় ও লাভ' : 'Cost & Profit'}</span>
                                      <ArrowRight className="w-3 h-3 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="text-[10px] text-emerald-200 truncate mt-0.5 font-medium">
                                      {lang === 'bn' ? 'ব্রেক-ইভেন ও খরচের হিসাব' : 'Estimate profit margin'}
                                    </div>
                                  </div>
                                </button>

                                {/* 2. Market Connect */}
                                <button
                                  type="button"
                                  onClick={() => onNavigateTab('market-connect', { produce: crop || 'tomato' })}
                                  className="flex items-center space-x-3 p-3 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl text-left transition-all group min-h-[48px] cursor-pointer"
                                >
                                  <div className="p-2.5 bg-amber-400 text-amber-950 rounded-xl group-hover:scale-105 transition-transform shrink-0 shadow-sm">
                                    <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-black text-xs text-white leading-tight truncate flex items-center justify-between">
                                      <span>{lang === 'bn' ? 'পাইকারি বাজারদর' : 'Mandi Rates'}</span>
                                      <ArrowRight className="w-3 h-3 text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="text-[10px] text-amber-200 truncate mt-0.5 font-medium">
                                      {lang === 'bn' ? 'আড়তের লাইভ দর ও ট্রেন্ড' : 'Wholesale price trends'}
                                    </div>
                                  </div>
                                </button>

                                {/* 3. Climate Resilience */}
                                <button
                                  type="button"
                                  onClick={() => onNavigateTab('climate-resilience')}
                                  className="flex items-center space-x-3 p-3 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl text-left transition-all group min-h-[48px] cursor-pointer"
                                >
                                  <div className="p-2.5 bg-sky-400 text-sky-950 rounded-xl group-hover:scale-105 transition-transform shrink-0 shadow-sm">
                                    <Waves className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-black text-xs text-white leading-tight truncate flex items-center justify-between">
                                      <span>{lang === 'bn' ? 'সহনশীল জাত গাইড' : 'Resilient Seeds'}</span>
                                      <ArrowRight className="w-3 h-3 text-sky-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="text-[10px] text-sky-200 truncate mt-0.5 font-medium">
                                      {lang === 'bn' ? 'বন্যা/খরা/লবণাক্ততা' : 'Flood/saline varieties'}
                                    </div>
                                  </div>
                                </button>

                                {/* 4. Satellite Health */}
                                <button
                                  type="button"
                                  onClick={() => onNavigateTab('crop-health')}
                                  className="flex items-center space-x-3 p-3 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl text-left transition-all group min-h-[48px] cursor-pointer"
                                >
                                  <div className="p-2.5 bg-teal-400 text-teal-950 rounded-xl group-hover:scale-105 transition-transform shrink-0 shadow-sm">
                                    <Satellite className="w-4 h-4 stroke-[2.5]" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-black text-xs text-white leading-tight truncate flex items-center justify-between">
                                      <span>{lang === 'bn' ? 'স্যাটেলাইট স্ক্যান' : 'Satellite Scan'}</span>
                                      <ArrowRight className="w-3 h-3 text-teal-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="text-[10px] text-teal-200 truncate mt-0.5 font-medium">
                                      {lang === 'bn' ? 'জমির NDVI স্বাস্থ্য সূচক' : 'Field vegetation index'}
                                    </div>
                                  </div>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Settings and Info Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 space-y-6 bg-white/50 backdrop-blur-sm p-6 sm:p-8 rounded-[32px] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="font-black text-gray-700 uppercase tracking-wider text-sm">
              {lang === 'bn' ? 'অতিরিক্ত তথ্য ও বিবরণ' : 'Additional Details & Settings'}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.produceType}</label>
                <select 
                  value={crop} 
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-base font-bold text-gray-900 transition-all cursor-pointer"
                >
                  <option value="">{lang === 'bn' ? 'স্বয়ংক্রিয় সনাক্তকরণ' : 'Auto detect'}</option>
                  {CROPS.map(c => (
                    <option key={c} value={c}>
                      {t.crops[c as keyof typeof t.crops] || c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.cropStage}</label>
                <select 
                  value={cropStage} 
                  onChange={(e) => setCropStage(e.target.value)}
                  className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
                >
                  <option value="">{lang === 'bn' ? 'স্বয়ংক্রিয় সনাক্তকরণ' : 'Auto detect'}</option>
                  {Object.keys(translations.en.stages).map(s => (
                    <option key={s} value={s}>
                      {t.stages[s as keyof typeof t.stages]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location & GPS Controls */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                  {lang === 'bn' ? 'ফসলের মাঠের অবস্থান (জিপিএস / এলাকা)' : 'Crop Field Location (GPS / Region)'}
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {isDetectingLocation ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{lang === 'bn' ? 'সনাক্ত হচ্ছে...' : 'Detecting...'}</span>
                      </>
                    ) : (
                      <>
                        <Compass className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'জিপিএস রিফ্রেশ' : 'Detect GPS'}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualLocation(!isManualLocation)}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
                  >
                    <span>{isManualLocation ? (lang === 'bn' ? 'লুকান' : 'Hide') : (lang === 'bn' ? 'জেলা/উপজেলা' : 'Select District')}</span>
                  </button>
                </div>
              </div>

              {locationError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{locationError}</p>
                    <button
                      type="button"
                      onClick={() => setIsManualLocation(true)}
                      className="mt-1.5 font-bold text-amber-900 underline hover:no-underline"
                    >
                      {lang === 'bn' ? 'এখান থেকে জেলা ও উপজেলা বেছে নিন' : 'Choose District & Upazila here'}
                    </button>
                  </div>
                </div>
              )}

              {isManualLocation && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-gray-50/80 rounded-2xl border border-gray-200"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      {lang === 'bn' ? 'জেলা' : 'District'}
                    </label>
                    <select
                      value={selectedDistrict}
                      onChange={(e) => handleDistrictChange(e.target.value)}
                      className="w-full text-sm font-bold bg-white rounded-xl border border-gray-200 p-2.5 outline-none focus:border-green-500"
                    >
                      {geoData.map(d => (
                        <option key={d.id} value={d.id}>
                          {lang === 'bn' ? d.bn_name : d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      {lang === 'bn' ? 'উপজেলা' : 'Upazila'}
                    </label>
                    <select
                      value={selectedUpazila}
                      onChange={(e) => handleManualLocationChange(e.target.value)}
                      className="w-full text-sm font-bold bg-white rounded-xl border border-gray-200 p-2.5 outline-none focus:border-green-500"
                    >
                      {activeDistrict?.upazilas.map(u => (
                        <option key={u.id} value={u.id}>
                          {lang === 'bn' ? u.bn_name : u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}

              {globalLocation && (
                <LocationDisplay 
                  coords={globalLocation} 
                  lang={lang} 
                  color="green" 
                  accuracy={locationAccuracy}
                  isManual={isManualLocation}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label id="analysis-type-label" className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.analysisType}</label>
                <Tooltip content={t.tooltips[analysisType as keyof typeof t.tooltips]}>
                  <button type="button" aria-label={t.tooltips[analysisType as keyof typeof t.tooltips]} className="focus:outline-none">
                    <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
              <select 
                value={analysisType} 
                onChange={(e) => setAnalysisType(e.target.value)}
                aria-labelledby="analysis-type-label"
                className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-base font-bold text-gray-900 transition-all outline-none"
              >
                <option value="disease">{t.disease}</option>
                <option value="pest">{t.pest}</option>
                <option value="abiotic">{t.abiotic}</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label id="description-label" className="block text-xs font-black text-gray-400 uppercase tracking-widest">{lang === 'bn' ? 'অতিরিক্ত তথ্য ও বিবরণ' : 'Description & Notes'}</label>
              </div>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                aria-labelledby="description-label"
                placeholder={lang === 'bn' ? 'ফসলের সমস্যা সম্পর্কে আরও কোনো তথ্য বা লক্ষণ লিখতে পারেন...' : 'Any extra details on when it started, fertilizers applied, or other symptoms...'}
                className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-sm font-medium text-gray-900 transition-all outline-none resize-none h-24"
              />
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-white p-4 rounded-2xl border border-green-100 shadow-inner">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  role="switch"
                  id="advanced-toggle"
                  aria-checked={isAdvanced}
                  aria-label={t.advancedAnalysis}
                  disabled={tier !== 'premium'}
                  onClick={() => tier === 'premium' && setIsAdvanced(!isAdvanced)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      tier === 'premium' && setIsAdvanced(!isAdvanced);
                    }
                  }}
                  className={`relative inline-block w-10 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer focus:ring-2 focus:ring-green-500 outline-none ${tier !== 'premium' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`block h-6 overflow-hidden bg-gray-200 rounded-full transition-colors ${isAdvanced ? 'bg-green-400' : ''}`}></div>
                  <div className={`absolute left-0.5 top-0.5 w-5 h-5 transition duration-200 ease-in-out transform bg-white border-2 border-gray-300 rounded-full ${isAdvanced ? 'translate-x-4 border-green-500' : ''}`}></div>
                </button>
                <label htmlFor="advanced-toggle" className={`text-sm font-black uppercase tracking-widest flex items-center cursor-pointer ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
                  <Sparkles className="w-4 h-4 mr-1.5 text-yellow-500" aria-hidden="true" />
                  {t.advancedAnalysis}
                </label>
              </div>
              <Tooltip content={t.tooltips.advanced}>
                <button type="button" aria-label={t.tooltips.advanced} className="focus:outline-none">
                  <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-1">
                  <span id="usage-label" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.usage} (Daily)</span>
                  <Tooltip content={t.tooltips.usage}>
                    <button type="button" aria-label={t.tooltips.usage} className="focus:outline-none">
                      <HelpCircle className="w-3 h-3 text-gray-300" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
              </div>
              <div 
                className="w-full bg-green-100/50 rounded-full h-2 overflow-hidden shadow-inner"
                role="progressbar"
                aria-labelledby="usage-label"
                aria-valuenow={currentUsage}
                aria-valuemin={0}
                aria-valuemax={limit}
              >
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentUsage / limit) * 100}%` }}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full"
                />
              </div>
            </div>

            

            {/* Safety Disclaimer */}
            <div className="mt-6 bg-amber-50/50 backdrop-blur-sm border border-amber-100 rounded-2xl p-5 shadow-inner">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-amber-100 p-1.5 rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <h4 className="font-black text-amber-900 text-xs uppercase tracking-widest">{t.disclaimerTitle}</h4>
              </div>
              <p className="text-[11px] text-amber-800/80 leading-relaxed font-medium">
                {t.disclaimerText}
              </p>
            </div>
            
        </motion.div>

      </div>
      )}

      {/* Sample Crop Disease Diagnosis & Symptoms Dropdown (Last item of tab) */}
      <div className="mt-4 pt-3 border-t border-stone-200/60 dark:border-stone-800 w-full">
        <div className="bg-stone-50/90 dark:bg-stone-900/90 rounded-2xl border border-stone-200/90 dark:border-stone-800 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">
              <Leaf className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <label htmlFor="sample-scenarios-select" className="text-xs font-bold text-stone-800 dark:text-stone-200 block truncate cursor-pointer">
                {lang === 'bn' ? 'নমুনা ফসল রোগ নির্ণয় ও লক্ষণ পরিস্থিতি' : 'Sample Crop Disease Scenarios'}
              </label>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                {lang === 'bn' ? 'ড্রপডাউন থেকে নমুনা রোগ বেছে নিয়ে পরীক্ষা করুন' : 'Select a sample scenario from the dropdown menu'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-80 shrink-0">
            <select
              id="sample-scenarios-select"
              defaultValue=""
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                if (!isNaN(idx) && SAMPLE_DIAGNOSIS_CASES[idx]) {
                  handleSelectSampleDiagnosis(SAMPLE_DIAGNOSIS_CASES[idx]);
                  setCopilotMode('static_upload');
                }
              }}
              className="w-full text-xs font-medium bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-stone-800 dark:text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-xs"
            >
              <option value="" disabled>
                {lang === 'bn' ? 'নমুনা নির্বাচন করুন (১৮টি আঞ্চলিক রোগ)...' : 'Select sample scenario (18 regional cases)...'}
              </option>
              {Array.from(new Set(SAMPLE_DIAGNOSIS_CASES.map(s => lang === 'bn' ? s.categoryBn : s.categoryEn))).map(cat => (
                <optgroup key={cat} label={`— ${cat} —`}>
                  {SAMPLE_DIAGNOSIS_CASES
                    .map((sc, originalIdx) => ({ sc, originalIdx }))
                    .filter(({ sc }) => (lang === 'bn' ? sc.categoryBn : sc.categoryEn) === cat)
                    .map(({ sc, originalIdx }) => (
                      <option key={originalIdx} value={originalIdx}>
                        {lang === 'bn' ? `${sc.titleBn} (${sc.descBn})` : `${sc.titleEn} (${sc.descEn})`}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </div>
    </motion.div>
  );
}