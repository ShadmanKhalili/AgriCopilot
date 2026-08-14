import React, { useState } from 'react';
import { Calendar, Sprout, CloudRain, Sun, ShieldAlert, Droplets, ArrowRight, CheckCircle2, Bell, Clock, Compass, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';

interface StageEvent {
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

interface CropScheduleConfig {
  nameBn: string;
  nameEn: string;
  durationDays: number;
  stages: StageEvent[];
}

const CROP_SCHEDULES: Record<string, CropScheduleConfig> = {
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
  }
};

interface Props {
  lang: Language;
  selectedCropKey?: string;
  weatherForecastSummary?: string;
}

export default function CropLifecycleCalendar({
  lang,
  selectedCropKey = 'paddy',
  weatherForecastSummary
}: Props) {
  const [cropKey, setCropKey] = useState<string>(selectedCropKey in CROP_SCHEDULES ? selectedCropKey : 'paddy');
  const [sowingDate, setSowingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [completedStages, setCompletedStages] = useState<number[]>([]);

  const activeConfig = CROP_SCHEDULES[cropKey] || CROP_SCHEDULES['paddy'];

  // Calculate dates based on sowing date
  const timelineEvents = React.useMemo(() => {
    const base = new Date(sowingDate);
    return activeConfig.stages.map((stage, idx) => {
      const eventDate = new Date(base);
      eventDate.setDate(eventDate.getDate() + stage.day - 1);
      
      const now = new Date();
      const isPast = eventDate < now;
      const isToday = eventDate.toDateString() === now.toDateString();

      return {
        ...stage,
        index: idx,
        eventDate,
        dateString: eventDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }),
        isPast,
        isToday
      };
    });
  }, [sowingDate, activeConfig, lang]);

  const toggleComplete = (idx: number) => {
    setCompletedStages(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
    toast.success(lang === 'bn' ? 'কার্যক্রম আপডেট হয়েছে' : 'Task status updated');
  };

  const harvestDate = timelineEvents[timelineEvents.length - 1]?.dateString || '';

  return (
    <div className="bg-white rounded-[2rem] p-5 md:p-8 border border-green-100 shadow-xl shadow-green-900/5 relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100 relative z-10">
        <div className="flex items-center space-x-3.5">
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-3 rounded-2xl text-white shadow-lg shadow-green-600/30">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 uppercase tracking-widest">
                Seasonal Lifecycle Tracker
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
              {lang === 'bn' ? 'ফসলের সময়সূচি ও পরিচর্যা ক্যালেন্ডার' : 'Crop Lifecycle & Spray Schedule'}
            </h3>
          </div>
        </div>

        {/* Date Selector & Crop Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
            <span className="text-xs font-bold text-gray-500 pl-2">
              {lang === 'bn' ? 'ফসল:' : 'Crop:'}
            </span>
            <select
              value={cropKey}
              onChange={(e) => setCropKey(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-black text-gray-800 outline-none cursor-pointer"
            >
              <option value="paddy">{lang === 'bn' ? 'ধান' : 'Paddy (Rice)'}</option>
              <option value="potato">{lang === 'bn' ? 'আলু' : 'Potato'}</option>
              <option value="tomato">{lang === 'bn' ? 'টমেটো' : 'Tomato'}</option>
              <option value="onion">{lang === 'bn' ? 'পেঁয়াজ' : 'Onion'}</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
            <span className="text-xs font-bold text-gray-500 pl-2">
              {lang === 'bn' ? 'রোপণ তারিখ:' : 'Sown On:'}
            </span>
            <input
              type="date"
              value={sowingDate}
              onChange={(e) => setSowingDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1 text-xs font-black text-gray-800 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 relative z-10">
        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 flex items-center space-x-3.5">
          <div className="p-2.5 bg-emerald-600 rounded-xl text-white">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
              {lang === 'bn' ? 'জীবনকাল' : 'Growth Cycle'}
            </span>
            <div className="text-lg font-black text-emerald-950">
              {activeConfig.durationDays} {lang === 'bn' ? 'দিন' : 'Days'}
            </div>
          </div>
        </div>

        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex items-center space-x-3.5">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
              {lang === 'bn' ? 'আনুমানিক কর্তন' : 'Est. Harvest Date'}
            </span>
            <div className="text-base font-black text-blue-950">
              {harvestDate}
            </div>
          </div>
        </div>

        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100 flex items-center space-x-3.5">
          <div className="p-2.5 bg-amber-600 rounded-xl text-white">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
              {lang === 'bn' ? 'পরিচর্যা পর্যায়' : 'Key Milestones'}
            </span>
            <div className="text-lg font-black text-amber-950">
              {completedStages.length} / {timelineEvents.length} {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Timeline */}
      <div className="relative pl-6 md:pl-10 space-y-6 before:absolute before:left-3 md:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-green-500 before:via-emerald-400 before:to-gray-200">
        {timelineEvents.map((stage, idx) => {
          const isDone = completedStages.includes(idx);
          const typeBadgeColor =
            stage.type === 'fertilizer' ? 'bg-amber-100 text-amber-800 border-amber-200' :
            stage.type === 'irrigation' ? 'bg-blue-100 text-blue-800 border-blue-200' :
            stage.type === 'pesticide' ? 'bg-red-100 text-red-800 border-red-200' :
            'bg-emerald-100 text-emerald-800 border-emerald-200';

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`relative rounded-3xl p-5 md:p-6 border transition-all ${
                isDone 
                  ? 'bg-gray-50/80 border-gray-200 opacity-70' 
                  : stage.isToday
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-2 border-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'bg-white border-gray-100 hover:border-green-200 shadow-sm'
              }`}
            >
              {/* Timeline Pin */}
              <div 
                onClick={() => toggleComplete(idx)}
                className={`absolute -left-[30px] md:-left-[46px] top-6 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border-2 transition-all ${
                  isDone
                    ? 'bg-green-600 border-green-600 text-white'
                    : stage.isToday
                    ? 'bg-white border-emerald-500 text-emerald-600 ring-4 ring-emerald-100 animate-pulse'
                    : 'bg-white border-gray-300 text-gray-400 hover:border-green-500'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                ) : (
                  <span className="text-[10px] font-black">{stage.day}d</span>
                )}
              </div>

              {/* Stage Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center space-x-2.5">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${typeBadgeColor}`}>
                    {lang === 'bn' 
                      ? (stage.type === 'fertilizer' ? 'সার প্রয়োগ' : stage.type === 'irrigation' ? 'সেচ' : stage.type === 'pesticide' ? 'রোগ/পোকা দমন' : 'ফসল কাটা')
                      : stage.type.toUpperCase()
                    }
                  </span>
                  <h4 className="text-base md:text-lg font-black text-gray-900">
                    {lang === 'bn' ? stage.stageNameBn : stage.stageNameEn}
                  </h4>
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono font-bold text-gray-500">
                  <span className="bg-gray-100 px-2.5 py-1 rounded-lg">
                    {stage.dateString} (Day {stage.day})
                  </span>
                </div>
              </div>

              {/* Action and Care Details */}
              <div className="space-y-3">
                <div className="bg-white/80 p-3.5 rounded-2xl border border-gray-100 text-sm font-medium text-gray-800 leading-relaxed">
                  <span className="font-bold text-emerald-700 mr-1.5">
                    {lang === 'bn' ? 'করণীয়:' : 'Action Required:'}
                  </span>
                  {lang === 'bn' ? stage.actionBn : stage.actionEn}
                </div>

                {/* Risk / Weather Warning */}
                <div className="flex items-start space-x-2 text-xs text-amber-900 bg-amber-50/70 p-3 rounded-xl border border-amber-100/80">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold mr-1">
                      {lang === 'bn' ? 'সতর্কতা:' : 'Key Alert:'}
                    </span>
                    {lang === 'bn' ? stage.riskBn : stage.riskEn}
                  </div>
                </div>
              </div>

              {/* Water & Done Actions */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-blue-600 font-bold">
                  <Droplets className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'bn' ? `পানির চাহিদা: ${stage.waterNeed === 'High' ? 'উচ্চ' : stage.waterNeed === 'Medium' ? 'মাঝারি' : 'কম'}` : `Moisture Need: ${stage.waterNeed}`}
                  </span>
                </div>

                <button
                  onClick={() => toggleComplete(idx)}
                  className={`text-xs font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    isDone
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  {isDone 
                    ? (lang === 'bn' ? '✓ সম্পন্ন হয়েছে' : '✓ Completed') 
                    : (lang === 'bn' ? 'সম্পন্ন হিসেবে চিহ্নিত করুন' : 'Mark as Done')
                  }
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
