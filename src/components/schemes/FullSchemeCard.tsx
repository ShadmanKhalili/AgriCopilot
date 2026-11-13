import React from 'react';
import { motion } from 'motion/react';
import { UserCheck, HelpCircle, Bot } from 'lucide-react';
import type { Language } from '../../utils/translations';
import { fixSchemeLinks } from '../../utils/schemeLinks';
import LinkPreviewCard from './LinkPreviewCard';
import type { GovScheme } from './types';

interface Props {
  scheme: GovScheme;
  idx: number;
  lang: Language;
  /** True while the built-in list is shown because Firestore has none. */
  isDefaultCatalog: boolean;
  onAsk: (scheme: GovScheme) => void;
}

/** The detailed scheme card of the full (staff) view. */
export default function FullSchemeCard({ scheme, idx, lang, isDefaultCatalog, onAsk }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="group relative"
    >
      {/* Background decorative element */}
      <div className="absolute -inset-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
      
      <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-gray-100 shadow-xl shadow-gray-200/20 hover:shadow-blue-500/10 transition-all flex flex-col lg:flex-row gap-12">
        <div className="flex-1 space-y-8">
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              {scheme.tags?.map((tag, tagIdx) => (
                <span key={tagIdx} className="text-[11px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                  {tag}
                </span>
              )) || (
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                  {lang === 'bn' ? 'কৃষি সেবা' : 'Agri Service'}
                </span>
              )}
              {isDefaultCatalog && (
                <span className="text-[11px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                  {lang === 'bn' ? 'ডিফল্ট ক্যাটালগ' : 'Default Catalog'}
                </span>
              )}
            </div>
            
            <h3 className="text-4xl font-black text-gray-900 mb-6 tracking-tighter leading-none group-hover:text-blue-600 transition-colors uppercase italic font-display">{scheme.title[lang]}</h3>
            <p className="text-gray-400 text-lg font-medium leading-relaxed max-w-2xl">{scheme.description[lang]}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100/50 relative group/info"
            >
              <div className="absolute top-6 right-8 opacity-20 group-hover/info:opacity-40 transition-opacity">
                 <UserCheck className="w-12 h-12 text-blue-600" />
              </div>
              <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                 <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                 {lang === 'bn' ? 'আপনি আবেদন করতে পারবেন কি?' : 'Can You Apply?'}
              </h4>
              <p className="text-lg text-gray-900 font-black leading-tight tracking-tight">{scheme.eligibility[lang]}</p>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="p-8 bg-indigo-50/50 rounded-[2.5rem] border border-indigo-100/50 relative group/info"
            >
              <div className="absolute top-6 right-8 opacity-20 group-hover/info:opacity-40 transition-opacity">
                 <HelpCircle className="w-12 h-12 text-indigo-600" />
              </div>
              <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                 <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                 {lang === 'bn' ? 'কিভাবে শুরু করবেন?' : 'How to Start?'}
              </h4>
              <p className="text-lg text-gray-900 font-black leading-tight tracking-tight">{scheme.howToApply[lang]}</p>
            </motion.div>
          </div>

          {scheme.benefits && (
            <div className="p-8 bg-blue-600 text-white rounded-[2.5rem] shadow-xl shadow-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">{lang === 'bn' ? 'মূল সুবিধাগুলো' : 'Key Benefits'}</h4>
                  <p className="text-xl font-black italic tracking-tight">{scheme.benefits[lang]}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onAsk(scheme)}
                  className="bg-white text-blue-600 p-3 rounded-2xl shadow-xl flex items-center gap-2 group/chat cursor-pointer"
                >
                  <Bot className="w-5 h-5 group-hover/chat:animate-bounce" />
                  <span className="text-[11px] font-black uppercase tracking-widest hidden sm:block">
                    {lang === 'bn' ? 'পরামর্শ' : 'ADVISOR'}
                  </span>
                </motion.button>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 flex flex-col gap-6">
          <div className="bg-gray-900 text-white p-8 rounded-[2.5rem] flex-1 flex flex-col justify-between shadow-2xl">
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-400 mb-6">{lang === 'bn' ? 'অফিসিয়াল তথ্য' : 'Official Info'}</h4>
              
              <div className="space-y-6">
                {scheme.provider && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{lang === 'bn' ? 'প্রদানকারী' : 'Provider'}</p>
                    <p className="text-sm font-black text-white">{scheme.provider}</p>
                  </div>
                )}
                
                {!scheme.benefits && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onAsk(scheme)}
                    className="w-full bg-blue-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 group/chat cursor-pointer mb-6"
                  >
                    <Bot className="w-5 h-5 group-hover/chat:animate-bounce" />
                    <span className="text-[11px] font-black uppercase tracking-widest">
                      {lang === 'bn' ? 'এআই পরামর্শদাতার সাথে কথা বলুন' : 'CHAT WITH AI ADVISOR'}
                    </span>
                  </motion.button>
                )}
                
                {scheme.deadline && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{lang === 'bn' ? 'সময়সীমা' : 'Deadline'}</p>
                    <p className="text-sm font-black text-orange-400">{scheme.deadline[lang]}</p>
                  </div>
                )}

                {scheme.contactInfo && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{lang === 'bn' ? 'যোগাযোগ' : 'Contact'}</p>
                    <p className="text-sm font-bold text-gray-300">{scheme.contactInfo[lang]}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-8 space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 px-2">{lang === 'bn' ? 'সরাসরি লিঙ্ক ও প্রিভিউ' : 'Direct Link & Preview'}</h4>
              {fixSchemeLinks(scheme.sourceLinks).map((link, linkIdx) => (
                <LinkPreviewCard key={linkIdx} url={link} lang={lang} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center p-4">
            <p className="text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">
              {scheme.lastUpdated ? (lang === 'bn' ? `সর্বশেষ আপডেট: ${new Date(scheme.lastUpdated).toLocaleDateString()}` : `Last updated: ${new Date(scheme.lastUpdated).toLocaleDateString()}`) : ''}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
