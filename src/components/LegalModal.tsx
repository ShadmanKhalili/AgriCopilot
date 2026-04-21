import React from 'react';
import { Shield, X, FileText } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export default function LegalModal({ isOpen, onClose, lang }: Props) {
  const t = translations[lang];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 md:p-8 bg-green-900 text-white flex justify-between items-start shrink-0">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Shield className="w-8 h-8 text-green-300" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">
                {lang === 'bn' ? 'গোপনীয়তা নীতি ও শর্তাবলী' : 'Privacy Policy & Terms'}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 overflow-y-auto w-full custom-scrollbar text-gray-700 space-y-6 text-sm">
            
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600"/>
                {lang === 'bn' ? '১. ডেটা সংগ্রহ' : '1. Data Collection'}
              </h3>
              <p>
                {lang === 'bn' 
                ? 'AgriCopilot সেবা প্রদানের জন্য আপনার জিপিএস লোকেশন (GPS), আপলোড করা ফসলের ছবি এবং ব্যবহারকারীর ডেটা (অ্যাকাউন্টের তথ্য) সংগ্রহ করে। এর উদ্দেশ্য শুধুমাত্র রোগ নির্ণয়, কৃষি পরামর্শ এবং স্থানীয় বাজারদর জানানো।'
                : 'AgriCopilot collects your physical GPS location, uploaded crop images, and basic user account data to provide localized disease diagnosis, localized planting advice, and market insights.'}
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600"/>
                {lang === 'bn' ? '২. ডেটা ব্যবহার ও এআই' : '2. Data Usage & AI'}
              </h3>
              <p>
                {lang === 'bn' 
                ? 'আমরা আপনার আপলোড করা ছবিগুলো এনালাইসিসের জন্য Google Gemini AI-তে পাঠাই। আমাদের সিস্টেমে ছবিগুলো সাময়িকভাবে বা আপনার অ্যাকাউন্টে ইতিহাস হিসেবে রাখা হতে পারে। এই ছবি সাধারণ এআই মডেল প্রশিক্ষণের জন্য ব্যবহার করা হয় না।'
                : 'Images you upload are processed through Google Gemini AI to provide a diagnosis. They are temporarily processed and stored securely in your private history. These images are NOT used to train public foundational AI models.'}
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600"/>
                {lang === 'bn' ? '৩. সুরক্ষাবিধি এবং শর্ত' : '3. Security & Terms of Service'}
              </h3>
              <p>
                {lang === 'bn' 
                ? 'AgriCopilot একটি পরামর্শমূলক টুল। এর দেওয়া সব পরামর্শ বা বাজারের দাম ১০০% নির্ভুল না-ও হতে পারে। দয়া করে চূড়ান্ত সিদ্ধান্ত নেওয়ার আগে স্থানীয় কৃষি কর্মকর্তার সাথে যাচাই করে নেবেন। সিস্টেম অপব্যবহারের ক্ষেত্রে অ্যাকাউন্টে নিষেধাজ্ঞা দেওয়া হতে পারে।'
                : 'AgriCopilot provides advisory insights. We do not guarantee 100% accuracy of agricultural/botanical diagnoses or market prices. Always verify critical decisions with local agricultural extension officers (DAE). Abusive usage of the API through malicious uploads will result in account bans.'}
              </p>
            </section>

          </div>

          {/* Footer */}
          <div className="p-6 md:p-8 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-green-900/20"
            >
              {lang === 'bn' ? 'আমি সম্মত' : 'I Understand & Agree'}
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
