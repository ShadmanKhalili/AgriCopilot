/**
 * Investor Demo Presets & Foolproof Backup Engine
 * Provides pre-calibrated, high-fidelity plant pathology samples for pitch presentations.
 */

export interface DemoPreset {
  id: string;
  nameBn: string;
  nameEn: string;
  category: 'staple' | 'cash_crop' | 'rooftop' | 'indoor';
  cropBn: string;
  cropEn: string;
  stageBn: string;
  stageEn: string;
  diseaseBn: string;
  diseaseEn: string;
  pathogen: string;
  severityScore: number; // 1-10
  severityBn: 'নিম্ন' | 'মাঝারি' | 'মারাত্মক';
  severityEn: 'Low' | 'Medium' | 'Critical';
  confidence: number;
  location: string;
  weatherSnapshot: {
    temp: string;
    humidity: string;
    rainRisk: string;
    advisory: string;
  };
  symptomsBn: string[];
  symptomsEn: string[];
  culturalStepsBn: string[];
  culturalStepsEn: string[];
  organicStepsBn: string[];
  organicStepsEn: string[];
  chemicalStepsBn: string[];
  chemicalStepsEn: string[];
  harvestIntervalDays: number;
  pitchNoteBn: string;
  pitchNoteEn: string;
  sampleVoicePromptBn: string;
  sampleVoicePromptEn: string;
  svgImage: string;
}

// Generate realistic standalone SVG data URL for each preset
function createPaddyBlightSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#14281d"/>
        <stop offset="50%" stop-color="#1c3827"/>
        <stop offset="100%" stop-color="#0f1e16"/>
      </linearGradient>
      <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#e08819"/>
        <stop offset="25%" stop-color="#eed55d"/>
        <stop offset="45%" stop-color="#3d8b37"/>
        <stop offset="55%" stop-color="#2d6e28"/>
        <stop offset="75%" stop-color="#ebd150"/>
        <stop offset="100%" stop-color="#df8217"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <!-- Background field bokeh -->
    <rect width="640" height="480" fill="url(#bg)"/>
    <circle cx="120" cy="80" r="140" fill="#2d5e3f" opacity="0.25" filter="blur(40px)"/>
    <circle cx="520" cy="380" r="180" fill="#1b452e" opacity="0.3" filter="blur(50px)"/>
    
    <!-- Target Rice Leaf with Bacterial Blight Lesions -->
    <g filter="url(#shadow)" transform="rotate(-18 320 240)">
      <!-- Main rice blade -->
      <path d="M 320,30 Q 350,180 340,320 Q 330,420 320,470 Q 310,420 300,320 Q 290,180 320,30 Z" fill="url(#leafGrad)"/>
      <!-- Leaf tip necrotic drying -->
      <path d="M 320,30 Q 338,80 334,130 Q 320,110 306,130 Q 302,80 320,30 Z" fill="#b86b1f" opacity="0.95"/>
      <path d="M 320,30 Q 330,60 326,90 Q 320,80 314,90 Q 310,60 320,30 Z" fill="#754215"/>
      <!-- Midrib vein -->
      <path d="M 320,30 L 320,470" stroke="#7ec479" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
      <!-- Longitudinal veins -->
      <path d="M 314,50 Q 306,200 312,460" stroke="#5fa859" stroke-width="1" opacity="0.6"/>
      <path d="M 326,50 Q 334,200 328,460" stroke="#5fa859" stroke-width="1" opacity="0.6"/>
      <!-- Left wavy bacterial lesion -->
      <path d="M 306,90 Q 295,130 286,170 Q 298,210 290,260 Q 302,300 294,360 Q 310,360 308,260 Q 310,180 306,90 Z" fill="#d97706" opacity="0.88"/>
      <path d="M 298,110 Q 290,150 282,190 Q 294,230 286,280 Q 298,320 290,370 Q 284,330 280,270 Q 278,180 298,110 Z" fill="#92400e" opacity="0.9"/>
      <!-- Right wavy bacterial lesion -->
      <path d="M 334,100 Q 345,140 354,180 Q 342,220 350,270 Q 338,310 346,370 Q 330,370 332,270 Q 330,190 334,100 Z" fill="#d97706" opacity="0.88"/>
      <path d="M 342,120 Q 350,160 358,200 Q 346,240 354,290 Q 342,330 350,380 Q 356,340 360,280 Q 362,190 342,120 Z" fill="#92400e" opacity="0.9"/>
      <!-- Milky bacterial exudate droplets -->
      <circle cx="292" cy="195" r="3" fill="#fef3c7" opacity="0.9"/>
      <circle cx="348" cy="225" r="3.5" fill="#fef3c7" opacity="0.9"/>
      <circle cx="344" cy="305" r="2.5" fill="#fef3c7" opacity="0.8"/>
    </g>
    <!-- Overlay HUD Badge -->
    <rect x="24" y="24" width="240" height="42" rx="10" fill="#000000" fill-opacity="0.65"/>
    <circle cx="44" cy="45" r="6" fill="#ef4444"/>
    <text x="58" y="49" fill="#ffffff" font-family="system-ui, sans-serif" font-size="13" font-weight="bold">SAMPLE #1: Rice Bacterial Blight</text>
    <rect x="24" y="420" width="310" height="36" rx="8" fill="#000000" fill-opacity="0.65"/>
    <text x="36" y="443" fill="#6ee7b7" font-family="system-ui, sans-serif" font-size="12" font-weight="600">Xanthomonas oryzae pv. oryzae • 98.4% Match</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function createTomatoBlightSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">
    <defs>
      <linearGradient id="tbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#19241a"/>
        <stop offset="100%" stop-color="#0a120c"/>
      </linearGradient>
      <linearGradient id="tLeaf" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="#2d7a36"/>
        <stop offset="60%" stop-color="#1e5425"/>
        <stop offset="100%" stop-color="#143b19"/>
      </linearGradient>
      <filter id="tShadow">
        <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity="0.7"/>
      </filter>
    </defs>
    <rect width="640" height="480" fill="url(#tbg)"/>
    
    <!-- Tomato Leaflet with irregular serrated edges -->
    <g filter="url(#tShadow)" transform="translate(140, 60)">
      <!-- Main stem -->
      <path d="M 180,360 Q 180,240 180,40" stroke="#3c733f" stroke-width="8" stroke-linecap="round"/>
      <!-- Leaf blade -->
      <path d="M 180,40 
               C 240,60 280,100 270,140 C 260,160 290,190 280,220 C 265,240 280,270 250,300 C 220,330 190,340 180,350 
               C 170,340 140,330 110,300 C 80,270 95,240 80,220 C 70,190 100,160 90,140 C 80,100 120,60 180,40 Z" 
            fill="url(#tLeaf)"/>
      <!-- Main veins -->
      <path d="M 180,70 Q 230,100 250,130" stroke="#5fb466" stroke-width="2.5" fill="none"/>
      <path d="M 180,140 Q 240,170 260,200" stroke="#5fb466" stroke-width="2.5" fill="none"/>
      <path d="M 180,210 Q 230,240 240,280" stroke="#5fb466" stroke-width="2" fill="none"/>
      <path d="M 180,70 Q 130,100 110,130" stroke="#5fb466" stroke-width="2.5" fill="none"/>
      <path d="M 180,140 Q 120,170 100,200" stroke="#5fb466" stroke-width="2.5" fill="none"/>
      
      <!-- Late Blight Water-soaked Necrotic Blotches with Chlorotic Halos -->
      <!-- Blotch 1 (Upper right margin) -->
      <path d="M 230,90 Q 275,105 260,150 Q 220,140 210,115 Z" fill="#d97706" opacity="0.6"/>
      <path d="M 235,95 Q 268,110 254,145 Q 224,135 218,118 Z" fill="#3b2014" opacity="0.95"/>
      <path d="M 240,105 Q 260,115 250,135 Q 230,130 226,120 Z" fill="#1c0f0a"/>
      <!-- White downy sporulation rim -->
      <path d="M 228,95 Q 262,110 250,142" stroke="#f1f5f9" stroke-width="2" stroke-dasharray="3,2" fill="none" opacity="0.85"/>
      
      <!-- Blotch 2 (Central left expanding lesion) -->
      <path d="M 120,170 Q 80,195 95,240 Q 150,230 160,190 Z" fill="#eab308" opacity="0.5"/>
      <path d="M 125,175 Q 88,200 102,235 Q 145,225 152,195 Z" fill="#451a03" opacity="0.95"/>
      <path d="M 130,185 Q 100,205 110,225 Q 138,218 142,200 Z" fill="#1f0a02"/>
      <circle cx="118" cy="210" r="14" fill="#180701"/>
      <path d="M 115,175 Q 85,200 98,235" stroke="#f8fafc" stroke-width="2.5" stroke-dasharray="4,2" fill="none" opacity="0.9"/>
      
      <!-- Blotch 3 (Stem canker spreading) -->
      <rect x="175" y="240" width="10" height="50" rx="3" fill="#451a03"/>
      <rect x="177" y="248" width="6" height="34" rx="2" fill="#180701"/>
    </g>
    <!-- Overlay HUD Badge -->
    <rect x="24" y="24" width="240" height="42" rx="10" fill="#000000" fill-opacity="0.65"/>
    <circle cx="44" cy="45" r="6" fill="#f59e0b"/>
    <text x="58" y="49" fill="#ffffff" font-family="system-ui, sans-serif" font-size="13" font-weight="bold">SAMPLE #2: Tomato Late Blight</text>
    <rect x="24" y="420" width="310" height="36" rx="8" fill="#000000" fill-opacity="0.65"/>
    <text x="36" y="443" fill="#fde047" font-family="system-ui, sans-serif" font-size="12" font-weight="600">Phytophthora infestans • 97.2% Match</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function createRooftopLemonSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">
    <defs>
      <linearGradient id="rbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#18232c"/>
        <stop offset="100%" stop-color="#0b1319"/>
      </linearGradient>
      <linearGradient id="lemonLeaf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="40%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <rect width="640" height="480" fill="url(#rbg)"/>
    
    <g transform="translate(130, 50)">
      <!-- Oval Lemon Leaf with wavy curled distorted margin -->
      <path d="M 190,40 Q 300,100 290,240 Q 270,360 190,400 Q 110,360 90,240 Q 80,100 190,40 Z" fill="url(#lemonLeaf)"/>
      <path d="M 190,40 L 190,400" stroke="#a7f3d0" stroke-width="3"/>
      <!-- Lateral veins -->
      <path d="M 190,120 Q 250,150 280,180" stroke="#6ee7b7" stroke-width="1.8" fill="none"/>
      <path d="M 190,190 Q 250,220 275,260" stroke="#6ee7b7" stroke-width="1.8" fill="none"/>
      <path d="M 190,260 Q 240,290 260,330" stroke="#6ee7b7" stroke-width="1.8" fill="none"/>
      <path d="M 190,120 Q 130,150 100,180" stroke="#6ee7b7" stroke-width="1.8" fill="none"/>
      <path d="M 190,190 Q 130,220 105,260" stroke="#6ee7b7" stroke-width="1.8" fill="none"/>
      
      <!-- Leaf Miner Silvery Serpentine Burrows (Translucent winding trails) -->
      <path d="M 230,100 Q 260,110 240,140 T 260,180 T 220,210 T 250,250 T 230,290" 
            stroke="#f1f5f9" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="0.85"/>
      <path d="M 230,100 Q 260,110 240,140 T 260,180 T 220,210 T 250,250 T 230,290" 
            stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
      <!-- Second trail -->
      <path d="M 140,160 Q 120,180 150,210 T 110,250 T 145,290" 
            stroke="#f1f5f9" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.8"/>
            
      <!-- Citrus Canker Corky Brown Pustules with Bright Yellow Halo -->
      <g transform="translate(170, 150)">
        <circle cx="0" cy="0" r="16" fill="#fde047" opacity="0.8"/>
        <circle cx="0" cy="0" r="10" fill="#78350f"/>
        <circle cx="-2" cy="-2" r="6" fill="#451a03"/>
      </g>
      <g transform="translate(220, 220)">
        <circle cx="0" cy="0" r="14" fill="#facc15" opacity="0.85"/>
        <circle cx="0" cy="0" r="8" fill="#854d0e"/>
        <circle cx="-1" cy="-1" r="5" fill="#451a03"/>
      </g>
      <g transform="translate(130, 260)">
        <circle cx="0" cy="0" r="12" fill="#fde047" opacity="0.8"/>
        <circle cx="0" cy="0" r="7" fill="#78350f"/>
      </g>
    </g>
    
    <rect x="24" y="24" width="280" height="42" rx="10" fill="#000000" fill-opacity="0.65"/>
    <circle cx="44" cy="45" r="6" fill="#10b981"/>
    <text x="58" y="49" fill="#ffffff" font-family="system-ui, sans-serif" font-size="13" font-weight="bold">SAMPLE #3: Rooftop Lemon Miner &amp; Canker</text>
    <rect x="24" y="420" width="330" height="36" rx="8" fill="#000000" fill-opacity="0.65"/>
    <text x="36" y="443" fill="#a7f3d0" font-family="system-ui, sans-serif" font-size="12" font-weight="600">Phyllocnistis citrella &amp; Xanthomonas • 96.5%</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function createIndoorMonsteraSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">
    <defs>
      <linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1e1e24"/>
        <stop offset="100%" stop-color="#0f0f12"/>
      </linearGradient>
      <linearGradient id="monsteraLeaf" x1="0" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="#15803d"/>
        <stop offset="50%" stop-color="#166534"/>
        <stop offset="80%" stop-color="#eab308"/>
        <stop offset="100%" stop-color="#713f12"/>
      </linearGradient>
    </defs>
    <rect width="640" height="480" fill="url(#mbg)"/>
    
    <g transform="translate(140, 40)">
      <!-- Monstera Fenestrated Leaf -->
      <path d="M 180,30 
               C 280,60 320,160 300,260 C 290,320 250,380 180,410 
               C 110,380 70,320 60,260 C 40,160 80,60 180,30 Z" 
            fill="url(#monsteraLeaf)"/>
      <path d="M 180,30 L 180,410" stroke="#86efac" stroke-width="4"/>
      
      <!-- Fenestrations (Slits / Holes) -->
      <ellipse cx="230" cy="140" rx="14" ry="40" transform="rotate(30 230 140)" fill="#1e1e24"/>
      <ellipse cx="240" cy="230" rx="12" ry="45" transform="rotate(40 240 230)" fill="#1e1e24"/>
      <ellipse cx="130" cy="140" rx="14" ry="40" transform="rotate(-30 130 140)" fill="#1e1e24"/>
      <ellipse cx="120" cy="230" rx="12" ry="45" transform="rotate(-40 120 230)" fill="#1e1e24"/>
      
      <!-- Waterlogged root rot chlorosis and mushy necrotic base -->
      <path d="M 130,340 Q 180,320 230,340 Q 210,400 180,410 Q 150,400 130,340 Z" fill="#451a03" opacity="0.95"/>
      <path d="M 140,360 Q 180,345 220,360 Q 200,405 180,410 Q 160,405 140,360 Z" fill="#1c0a00"/>
      <!-- Yellowing halo around necrosis -->
      <path d="M 110,300 Q 180,270 250,300 Q 235,345 180,335 Q 125,345 110,300 Z" fill="#facc15" opacity="0.6"/>
    </g>
    
    <rect x="24" y="24" width="280" height="42" rx="10" fill="#000000" fill-opacity="0.65"/>
    <circle cx="44" cy="45" r="6" fill="#a855f7"/>
    <text x="58" y="49" fill="#ffffff" font-family="system-ui, sans-serif" font-size="13" font-weight="bold">SAMPLE #4: Indoor Monstera Overwatering</text>
    <rect x="24" y="420" width="310" height="36" rx="8" fill="#000000" fill-opacity="0.65"/>
    <text x="36" y="443" fill="#fbcfe8" font-family="system-ui, sans-serif" font-size="12" font-weight="600">Pythium / Root Rot Asphyxiation • 95.8%</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const INVESTOR_DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'rice-bacterial-blight',
    nameBn: 'ধানের পাতা পোড়া রোগ (ব্যাকটেরিয়াল ব্লাইট)',
    nameEn: 'Paddy Bacterial Leaf Blight',
    category: 'staple',
    cropBn: 'ধান (ব্রি ধান২৮)',
    cropEn: 'Rice / Paddy (BRRI dhan28)',
    stageBn: 'কুশি ও থোড় আসার মধ্যবর্তী পর্যায়',
    stageEn: 'Tillering to Panicle Initiation',
    diseaseBn: 'ধানের পাতা পোড়া রোগ (ব্যাকটেরিয়াল লিফ ব্লাইট)',
    diseaseEn: 'Bacterial Leaf Blight (BLB)',
    pathogen: 'Xanthomonas oryzae pv. oryzae',
    severityScore: 8,
    severityBn: 'মারাত্মক',
    severityEn: 'Critical',
    confidence: 98.4,
    location: 'Bogura / Mymensingh, Bangladesh',
    weatherSnapshot: {
      temp: '29.5°C',
      humidity: '88% RH',
      rainRisk: 'High (Cloudy & Humid)',
      advisory: 'বাতাস ও বৃষ্টির ফোঁটায় ব্যাকটেরিয়া দ্রুত ছড়ায়। অবিলম্বে ইউরিয়া সার স্থগিত করুন।'
    },
    symptomsBn: [
      'পাতার কিনারায় ঢেউ খেলানো হলুদাভ থেকে ধূসর ক্ষতের সৃষ্টি',
      'পাতা উপর থেকে ক্রমান্বয়ে নিচের দিকে শুকিয়ে যাওয়া',
      'ভোরের দিকে পাতার ক্ষতে ছোট ছোট ব্যাকটেরিয়াল আঠালো ফোঁটা (Ooze)',
      'গাছের সালোকসংশ্লেষণ ব্যাহত হয়ে চিটা হওয়ার ঝুঁকি বৃদ্ধি'
    ],
    symptomsEn: [
      'Wavy chlorotic to necrotic margins progressing along leaf blades',
      'Downward leaf drying and bleached whiteish-gray tip blight',
      'Morning bacterial ooze droplets visible under backlighting',
      'Severe photosynthesis impairment threatening panicle grain filling'
    ],
    culturalStepsBn: [
      'জমির দাঁড়ানো পানি অবিলম্বে নিষ্কাশন করে ৩ দিন জমি শুকিয়ে নিন।',
      'ইউরিয়া সারের উপরিপ্রয়োগ সম্পূর্ণ বন্ধ রাখুন।',
      'প্রতি বিঘায় অতিরিক্ত ৫ কেজি পটাশ (MOP) সার প্রয়োগ করুন।'
    ],
    culturalStepsEn: [
      'Drain standing field water immediately and dry the plot for 3 days.',
      'Completely suspend all top-dressing urea fertilizer.',
      'Apply additional 5 kg Muriate of Potash (MOP) per bigha to reinforce cell walls.'
    ],
    organicStepsBn: [
      'জৈব নিম নির্যাস ৫% বা প্রতি লিটার পানিতে ৫ গ্রাম তাজা কাঁচা গোবর ও চুন গুলে পাতলা করে স্প্রে করুন।',
      'সুডোমোনাস ফ্লুরোসেন্স (Pseudomonas fluorescens) প্রতি লিটারে ৫ গ্রাম মিশিয়ে স্প্রে করুন।'
    ],
    organicStepsEn: [
      'Foliar spray 5% fresh neem kernel extract or mild bio-lime slurry.',
      'Apply beneficial antagonistic biocontrol Pseudomonas fluorescens @ 5g/L.'
    ],
    chemicalStepsBn: [
      'কপার হাইড্রোক্সাইড (যেমন: চ্যাম্প ৭৭ ডব্লিউপি) প্রতি লিটার পানিতে ২ গ্রাম হারে মিশিয়ে স্প্রে করুন।',
      'অথবা থিওভিট বা কাসুগামাইসিন (কাসুমিন ২% এল) প্রতি লিটারে ২ মিলি হারে মিশিয়ে বিকেলে স্প্রে করুন।'
    ],
    chemicalStepsEn: [
      'Copper Hydroxide (Champ 77 WP) @ 2g per liter of clean water.',
      'Or Kasugamycin 2% SL (Kasumin) @ 2ml/L applied during clear non-rainy afternoon.'
    ],
    harvestIntervalDays: 14,
    pitchNoteBn: 'বাংলাদেশের প্রধান খাদ্য শস্য। বার্ষিক ৪৫০ মিলিয়ন ডলারের সম্ভাব্য ফসলহানি রক্ষা করে।',
    pitchNoteEn: '#1 Staple crop in Bangladesh; safeguards $450M annual crop loss across 11M hectares.',
    sampleVoicePromptBn: 'আমি দেখছি ধানের পাতায় ঢেউ খেলানো দাগ ও অগ্রভাগ শুকিয়ে যাওয়া। এটি জ্যান্থোমোনাস ব্যাকটিরিয়াল ব্লাইট। জমিতে পানি জমে আছে কি না জানাবেন কি?',
    sampleVoicePromptEn: 'I observe a rice blade with wavy yellowish-orange margins and drying tips. This is classic Bacterial Leaf Blight. Is standing water currently in your field?',
    svgImage: createPaddyBlightSvg()
  },
  {
    id: 'tomato-late-blight',
    nameBn: 'টমেটোর নাবি ধসা রোগ (লেট ব্লাইট)',
    nameEn: 'Tomato Late Blight',
    category: 'cash_crop',
    cropBn: 'টমেটো (উন্নত হাইব্রিড)',
    cropEn: 'Tomato (Hybrid)',
    stageBn: 'ফুল ও কচি ফল ধরার পর্যায়',
    stageEn: 'Flowering & Early Fruiting',
    diseaseBn: 'টমেটোর নাবি ধসা (লেট ব্লাইট)',
    diseaseEn: 'Late Blight of Tomato',
    pathogen: 'Phytophthora infestans',
    severityScore: 9,
    severityBn: 'মারাত্মক',
    severityEn: 'Critical',
    confidence: 97.2,
    location: 'Rajshahi / Jessore, Bangladesh',
    weatherSnapshot: {
      temp: '18.2°C',
      humidity: '94% RH',
      rainRisk: 'Heavy Morning Fog',
      advisory: 'কুয়াশা ও ভেজা পাতার পরিবেশ ছত্রাক দ্রুত ছড়ায়। স্প্রে দ্রুত করতে হবে।'
    },
    symptomsBn: [
      'পাতায় গাঢ় বাদামি ভেজা ভেজা ক্ষতের সৃষ্টি',
      'পাতার নিচের পিঠে সাদাটে ছত্রাকের পাউডার সদৃশ আবরণ',
      'ডাল ও কাণ্ডে কালো পচন দাগ দ্রুত ছড়িয়ে পড়া',
      '২৪ থেকে ৪৮ ঘণ্টার মধ্যে সম্পূর্ণ গাছ ঝলে পড়ার তীব্র ঝুঁকি'
    ],
    symptomsEn: [
      'Dark water-soaked necrotic patches with pale chlorotic halo',
      'Fine white velvety mildew sporulation on leaf underside',
      'Stem lesion girdling causing sudden vine collapse',
      'High catastrophic risk: can defoliate entire field in 48 hours'
    ],
    culturalStepsBn: [
      'মারাত্মক আক্রান্ত পাতা ও ডগা সাবধানে কেটে পলিথিনে ভরে মাটির নিচে পুঁতে ফেলুন।',
      'গাছের গোড়ায় পানি জমে থাকলে ড্রেন কেটে বের করে দিন।',
      'পাতার ওপর সরাসরি সেচ দেওয়া পরিহার করুন।'
    ],
    culturalStepsEn: [
      'Prune severely infected leaves into plastic bags and bury off-site.',
      'Clear furrow drainage to reduce microclimate humidity around foliage.',
      'Avoid overhead sprinkler irrigation.'
    ],
    organicStepsBn: [
      'বোর্দো মিশ্রণ (১% কপার সালফেট ও চুন) কুয়াশাচ্ছন্ন আবহাওয়ার আগেই স্প্রে করুন।',
      'ট্রাইকোডার্মা ভিরিডি (Trichoderma viride) মাটিতে প্রয়োগ করুন।'
    ],
    organicStepsEn: [
      'Apply preventive 1% Bordeaux mixture prior to prolonged fog.',
      'Soil drench with Trichoderma viride bio-antagonist.'
    ],
    chemicalStepsBn: [
      'সাইমোক্সানিল ৮% + ম্যানকোজেব ৬৪% (যেমন: কারজেট এম৮) প্রতি লিটার পানিতে ২.৫ গ্রাম হারে মিশিয়ে স্প্রে করুন।',
      'অথবা মেটাল্যাক্সিল + ম্যানকোজেব (রিডোমিল গোল্ড) প্রতি লিটারে ২ গ্রাম হারে ৭ দিন পরপর ২ বার প্রয়োগ করুন।'
    ],
    chemicalStepsEn: [
      'Cymoxanil 8% + Mancozeb 64% (Curzate M8) @ 2.5g/L water.',
      'Or Metalaxyl + Mancozeb (Ridomil Gold) @ 2g/L water sprayed with thorough canopy coverage.'
    ],
    harvestIntervalDays: 7,
    pitchNoteBn: 'উচ্চ মূল্যের শীতকালীন সবজি। ৪৮ ঘণ্টার মধ্যে সম্পূর্ণ জমি নষ্ট হওয়া থেকে রক্ষা করে।',
    pitchNoteEn: 'High-value vegetable; early AI detection prevents 100% loss within 48h fog window.',
    sampleVoicePromptBn: 'টমেটো পাতার গায়ে গাঢ় বাদামি ছোপ ও উল্টোপিঠে সাদা ছত্রাক দেখছি। এটি মারাত্মক লেট ব্লাইট। অবিলম্বে স্প্রে করা প্রয়োজন।',
    sampleVoicePromptEn: 'I see severe water-soaked lesions with white downy growth on the underside. This is Late Blight. Immediate fungicidal intervention is required.',
    svgImage: createTomatoBlightSvg()
  },
  {
    id: 'rooftop-lemon-canker',
    nameBn: 'ছাদ বাগানের কাগজি লেবু (লিফ মাইনার ও ক্যাংকার)',
    nameEn: 'Rooftop Lemon Leaf Miner & Canker',
    category: 'rooftop',
    cropBn: 'কাগজি লেবু (টবের গাছ)',
    cropEn: 'Kagzi Lime / Lemon (Pot Culture)',
    stageBn: 'নতুন কচি পাতা ও কুঁড়ি পর্যায়',
    stageEn: 'Flushing & Budding Stage',
    diseaseBn: 'লেবুর লিফ মাইনার পোকা ও ব্যাকটেরিয়াল ক্যাংকার',
    diseaseEn: 'Citrus Leaf Miner & Bacterial Canker',
    pathogen: 'Phyllocnistis citrella & Xanthomonas axonopodis',
    severityScore: 6,
    severityBn: 'মাঝারি',
    severityEn: 'Medium',
    confidence: 96.5,
    location: 'Dhanmondi, Dhaka (Urban Rooftop)',
    weatherSnapshot: {
      temp: '31.0°C',
      humidity: '72% RH',
      rainRisk: 'Low',
      advisory: 'ছাদের তীব্র রোদ ও বাতাসে টবের পানি দ্রুত শুকায়। বিকেলে স্প্রে করুন।'
    },
    symptomsBn: [
      'কচি পাতার ভেতর আঁকাবাঁকা রুপালি রঙের সুড়ঙ্গ বা দাগ',
      'পাতা কোঁকড়ানো ও বিকৃত হয়ে বৃদ্ধি থমকে যাওয়া',
      'পাতার গায়ে খসখসে বাদামি ফোস্কার মতো উঁচু দাগ ও হলুদ বলয়',
      'নতুন কুঁড়ি ঝরে যাওয়া'
    ],
    symptomsEn: [
      'Silvery serpentine mines etched inside fresh tender leaves',
      'Leaf curling, twisting and stunted shoot emergence',
      'Raised corky brown pustules surrounded by bright yellow halos',
      'Premature blossom and young fruitlet drop'
    ],
    culturalStepsBn: [
      'অতিরিক্ত আক্রান্ত কোঁকড়ানো কচি পাতাগুলো কাঁচি দিয়ে ছেঁটে ফেলুন।',
      'টবের উপরের ২ ইঞ্চি মাটি আলগা করে ভার্মিকম্পোস্ট যোগ করুন।',
      'ছাদের রোদ বেশি থাকলে সকাল-বিকাল নিয়মিত পরিমিত সেচ দিন।'
    ],
    culturalStepsEn: [
      'Hand-prune distorted mined leaves and dispose safely.',
      'Gently aerate top 2 inches of pot mix and blend in organic vermicompost.',
      'Ensure balanced container moisture without waterlogging.'
    ],
    organicStepsBn: [
      'নিম তেল (প্রতি লিটার পানিতে ৫ মিলি + সামান্য ডিটারজেন্ট) মিশিয়ে ৭ দিন পরপর স্প্রে করুন।',
      'সাবান পানির হালকা স্প্রে (প্রতি লিটারে ২ গ্রাম) পোকার কীড়া দমন করে।'
    ],
    organicStepsEn: [
      'Organic cold-pressed Neem Oil @ 5ml/L + 2 drops mild dish soap every 7 days.',
      'Foliar spray with biological Bacillus thuringiensis (Bt).'
    ],
    chemicalStepsBn: [
      'ইমিডাক্লোপ্রিড (যেমন: এডমায়ার ২০ এসএল) প্রতি লিটার পানিতে ০.৫ মিলি হারে স্প্রে করুন।',
      'ক্যাংকার প্রতিরোধে কপার অক্সিক্লোরাইড (যেমন: কুপ্রোফিক্স) প্রতি লিটারে ২ গ্রাম মিশিয়ে স্প্রে করুন।'
    ],
    chemicalStepsEn: [
      'Imidacloprid 20 SL (Admire) @ 0.5ml/L targeting new flush growth.',
      'Copper Oxychloride (Cuproxat/Kuprofix) @ 2g/L for bacterial canker suppression.'
    ],
    harvestIntervalDays: 10,
    pitchNoteBn: 'ঢাকা-চট্টগ্রামের ৩৫ লাখ শহুরে ছাদ বাগানিদের জন্য অ্যাপের পরিধি বিস্তৃত করার চমৎকার উদাহরণ।',
    pitchNoteEn: 'Demonstrates TAM expansion into 3.5M urban rooftop gardeners across Dhaka & Chittagong.',
    sampleVoicePromptBn: 'আপনার কাগজি লেবুর পাতার রুপালি সুড়ঙ্গ লিফ মাইনার পোকার কাজ। আর উঁচু বাদামি দাগগুলো ক্যাংকার। টবের পানি দেওয়ার নিয়ম কেমন?',
    sampleVoicePromptEn: 'The silvery serpentine trails on your lime leaf are caused by citrus leaf miners. The corky spots are canker. How often do you water this rooftop container?',
    svgImage: createRooftopLemonSvg()
  },
  {
    id: 'indoor-monstera-overwatering',
    nameBn: 'ইনডোর মনস্টেরা (গোড়া পচা ও অতিরিক্ত আর্দ্রতা)',
    nameEn: 'Indoor Monstera Root Rot & Asphyxiation',
    category: 'indoor',
    cropBn: 'মনস্টেরা ডেলিসিওসা (ইনডোর টব)',
    cropEn: 'Monstera Deliciosa (Apartment Pot)',
    stageBn: 'গৃহস্থালি আলংকারিক পরিপক্ব পাতা',
    stageEn: 'Indoor Vegetative Display',
    diseaseBn: 'গোড়া পচা রোগ ও অতিরিক্ত পানির কারণে শেকড় শ্বাসরোধ',
    diseaseEn: 'Overwatering Induced Pythium Root Rot',
    pathogen: 'Pythium spp. & Root Hypoxia',
    severityScore: 7,
    severityBn: 'মাঝারি',
    severityEn: 'Medium',
    confidence: 95.8,
    location: 'Gulshan, Dhaka (Apartment Living Room)',
    weatherSnapshot: {
      temp: '26.0°C',
      humidity: '65% RH',
      rainRisk: 'Indoor Controlled',
      advisory: 'এসি বা ঘরের ভেতরে বাতাস চলাচল কম হলে টবের মাটি শুকাতে বেশি সময় নেয়।'
    },
    symptomsBn: [
      'নিচের দিকের পুরোনো পাতাগুলোর সম্পূর্ণ হলুদ হয়ে যাওয়া',
      'পাতার বোঁটা ও গোড়া কালো, নরম ও ভেজা হয়ে যাওয়া',
      'টবের মাটি থেকে মৃদু স্যাঁতসেঁতে বা পচা গন্ধ বের হওয়া',
      'পাতার টিপসে বাদামি রঙের দাগ ছড়িয়ে পড়া'
    ],
    symptomsEn: [
      'Lower mature leaves turning pale chlorotic yellow from margins inward',
      'Petiole bases turning dark brown, soft and mushy to the touch',
      'Sour swampy odor emanating from un-aerated potting mix',
      'Leaf tips drooping despite damp substrate'
    ],
    culturalStepsBn: [
      'টবে পানি দেওয়া অবিলম্বে বন্ধ রাখুন যতক্ষণ না উপরের ২ ইঞ্চি মাটি সম্পূর্ণ শুকিয়ে যায়।',
      'টবের নিচের ড্রেনেজ ছিদ্র খোলা রয়েছে কি না নিশ্চিত করুন।',
      'গাছটিকে ঘরের বেশি উজ্জ্বল কিন্তু পরোক্ষ সূর্যের আলোযুক্ত স্থানে সরিয়ে নিন।'
    ],
    culturalStepsEn: [
      'Cease watering immediately until top 2 inches of potting mix dries out completely.',
      'Verify container drainage holes are unblocked.',
      'Relocate pot to bright indirect morning sunlight with active air circulation.'
    ],
    organicStepsBn: [
      'গাছটি সাবধানে টব থেকে তুলে পচা শেকড়গুলো জীবাণুমুক্ত কাঁচি দিয়ে কেটে দারুচিনি গুঁড়ো (Cinnamon powder) ছিটিয়ে দিন।',
      '৫০% কোকোপিট, ৩০% পার্লাইট ও ২০% ভার্মিকম্পোস্টের ঝরঝরে মিশ্রণে পুনরায় রোপণ করুন।'
    ],
    organicStepsEn: [
      'Unpot plant, rinse roots, excise blackened mushy roots, and dust with natural cinnamon powder.',
      'Repot into well-aerated chunky aroid mix (orchid bark + perlite + coco coir).'
    ],
    chemicalStepsBn: [
      'কার্বেনডাজিম (যেমন: ব্য়াভিস্টিন ৫০ ডব্লিউপি) প্রতি লিটার পানিতে ১ গ্রাম গুলে শেকড়ের গোড়ায় ঢালুন।',
      'হাইড্রোজেন পারঅক্সাইড ৩% দ্রবণের ২ চামচ প্রতি লিটার পানিতে মিশিয়ে শেকড়ে অক্সিজেন সরবরাহ বৃদ্ধি করুন।'
    ],
    chemicalStepsEn: [
      'Carbendazim (Bavistin 50 WP) @ 1g/L applied as gentle root drench.',
      'Or 3% Hydrogen Peroxide (2 tsp/L water) root wash to kill anaerobic pathogens and re-oxygenate root zone.'
    ],
    harvestIntervalDays: 0,
    pitchNoteBn: 'লাইফস্টাইল ও আধুনিক অ্যাপার্টমেন্ট প্ল্যান্ট কেয়ার প্রদর্শন করে আন্তর্জাতিক বিনিয়োগকারীদের নজর কাড়ে।',
    pitchNoteEn: 'Highlights consumer lifestyle botany and indoor plant health for global scalability.',
    sampleVoicePromptBn: 'মনস্টেরা পাতার নিচের এই হলুদ হওয়া অতিরিক্ত পানির কারণে হয়েছে। শেকড় পর্যাপ্ত অক্সিজেন পাচ্ছে না। শেষ কবে পানি দিয়েছিলেন?',
    sampleVoicePromptEn: 'The yellowing on your Monstera is a clear sign of overwatering and root asphyxiation. When did you last water this container?',
    svgImage: createIndoorMonsteraSvg()
  }
];
