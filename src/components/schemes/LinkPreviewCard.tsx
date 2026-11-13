import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Globe, ExternalLink, UserCheck } from 'lucide-react';
import type { Language } from '../../utils/translations';
import { safeExternalUrl, externalHostLabel } from '../../utils/security';
import { fetchWithTimeout, readJsonWithTimeout } from '../../utils/fetchWithTimeout';

interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
  isRestricted?: boolean;
}

export default function LinkPreviewCard({ url, lang }: { url: string; lang: Language }) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);

  // A scheme's link comes from seeded data and from what the AI returns, so
  // it is never trusted blindly: only real web addresses become anchors, and
  // the destination hostname is shown so a farmer can see where the tap goes.
  const safeHref = safeExternalUrl(url);
  const hostLabel = externalHostLabel(url);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetchWithTimeout(`/api/link-preview?url=${encodeURIComponent(url)}`, { timeoutMs: 10000, retries: 1 });
        const data = await readJsonWithTimeout<any>(res, 10000);
        if (!data.error) setMetadata(data);
        // A site that no longer exists must not look like a working link.
        else if (/could not be resolved/i.test(data.error)) setUnreachable(true);
      } catch (err) {
        console.error("Link preview error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, [url]);

  if (!safeHref) {
    // A link we cannot vouch for is not rendered as a link at all.
    return (
      <div className="flex items-center gap-3 bg-white/5 w-full p-5 rounded-2xl border border-white/10">
        <Globe className="w-5 h-5 text-gray-500" />
        <span className="text-xs font-black uppercase tracking-widest text-gray-500">
          {lang === 'bn' ? 'লিঙ্ক পাওয়া যায়নি' : 'Link unavailable'}
        </span>
      </div>
    );
  }

  if (loading) return (
    <div className="animate-pulse bg-white/5 h-24 rounded-2xl border border-white/10 p-4 flex gap-4 items-center">
      <div className="w-16 h-16 bg-white/10 rounded-xl"></div>
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-white/10 rounded w-1/2"></div>
        <div className="h-2 bg-white/10 rounded w-3/4"></div>
      </div>
    </div>
  );

  if (unreachable) return (
    <div className="flex items-center gap-3 bg-white/5 w-full p-5 rounded-2xl border border-white/10">
      <Globe className="w-5 h-5 text-gray-400 shrink-0" />
      <span className="text-xs font-bold text-gray-300">
        {lang === 'bn'
          ? `${hostLabel} সাইটটি এখন খোলা যাচ্ছে না। জানতে কৃষি কল সেন্টারে ফোন করুন: ১৬১২৩`
          : `${hostLabel} cannot be opened right now. For details, call the Krishi Call Centre: 16123`}
      </span>
    </div>
  );

  if (!metadata) return (
    <motion.a 
      href={safeHref} 
      target="_blank" 
      rel="noopener noreferrer"
      whileHover={{ y: -2 }}
      className="flex items-center justify-between w-full bg-white/5 hover:bg-white/10 p-5 rounded-2xl border border-white/10 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Globe className="w-5 h-5 text-blue-400" />
        <span className="text-xs font-black uppercase tracking-widest">{lang === 'bn' ? 'অফিসিয়াল পোর্টাল' : 'Official Portal'}</span>
      </div>
      <ExternalLink className="w-4 h-4 text-blue-400" />
    </motion.a>
  );

  if (metadata.isRestricted) {
    return (
      <motion.a 
        href={safeHref} 
        target="_blank" 
        rel="noopener noreferrer"
        whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.08)' }}
        className="block group/link bg-orange-500/5 rounded-[2rem] overflow-hidden border border-orange-500/20 transition-all shadow-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <UserCheck className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-orange-400">{metadata.siteName || 'Official Website'}</span>
        </div>
        <h5 className="font-black text-white text-sm leading-snug group-hover/link:text-orange-400 transition-colors line-clamp-2 mb-2">{metadata.title}</h5>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 font-medium mb-3">{metadata.description}</p>
        <div className="flex items-center justify-between">
           <span className="text-[11px] font-bold text-orange-500/80 uppercase tracking-widest">{lang === 'bn' ? 'পোর্টাল দেখুন' : 'VIEW PORTAL'}</span>
           <span className="text-[10px] font-bold text-orange-400/70 mr-2 truncate max-w-[45%]" title={hostLabel}>{hostLabel}</span>
           <ExternalLink className="w-3 h-3 text-orange-400" />
        </div>
      </motion.a>
    );
  }

  return (
    <motion.a 
      href={safeHref} 
      target="_blank" 
      rel="noopener noreferrer"
      whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.08)' }}
      className="block group/link bg-white/10 rounded-[2rem] overflow-hidden border border-white/20 transition-all shadow-2xl"
    >
      {metadata.image && (
        <div className="relative aspect-video overflow-hidden">
          <img 
            src={metadata.image} 
            alt={metadata.title} 
            className="w-full h-full object-cover transition-transform group-hover/link:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-blue-400 truncate">{metadata.siteName || 'Official Website'}</p>
          </div>
        </div>
      )}
      <div className="p-6 space-y-2">
        <h5 className="font-black text-white text-sm leading-snug group-hover/link:text-blue-400 transition-colors line-clamp-2">{metadata.title}</h5>
        {metadata.description && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 font-medium">{metadata.description}</p>
        )}
        <div className="pt-2 flex items-center justify-between">
           <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{lang === 'bn' ? 'দেখুন' : 'VISIT PORTAL'}</span>
           <span className="text-[10px] font-bold text-gray-500/80 mr-2 truncate max-w-[45%]" title={hostLabel}>{hostLabel}</span>
           <ExternalLink className="w-3 h-3 text-blue-400" />
        </div>
      </div>
    </motion.a>
  );
}
