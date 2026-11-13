import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageIcon, Loader2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  deleteConsultationPhoto,
  watchConsultationPhotos,
  type ConsultationPhoto,
} from '../../services/expertPhotos';
import { describeError } from '../../services/expertService';
import { photoSrc } from '../../utils/imageCompress';
import toBn from '../../utils/banglaNum';

interface ConsultationPhotosProps {
  lang: 'bn' | 'en';
  consultationId: string;
  viewer: 'farmer' | 'expert';
  /** Whether the farmer ticked "Crop photos" when sending the request. */
  photosConsented: boolean;
  /** Farmer only: allow removing a shared photo. */
  canDelete?: boolean;
}

/**
 * Crop photos shared with the expert. The expert sees thumbnails that open
 * larger; the farmer sees exactly which photos the expert can see.
 */
export default function ConsultationPhotos({
  lang,
  consultationId,
  viewer,
  photosConsented,
  canDelete = false,
}: ConsultationPhotosProps) {
  const bn = lang === 'bn';
  const [photos, setPhotos] = useState<ConsultationPhoto[]>([]);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setPhotos([]);
    setReady(false);
    setUnavailable(false);
    const unsub = watchConsultationPhotos(
      consultationId,
      (items) => {
        setPhotos(items);
        setReady(true);
      },
      () => {
        // Access ended (consent revoked/expired) or network: show nothing.
        setPhotos([]);
        setUnavailable(true);
        setReady(true);
      }
    );
    return () => unsub();
  }, [consultationId]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  const total = photos.length;
  const altFor = (idx: number) =>
    viewer === 'expert'
      ? bn
        ? `কৃষকের পাঠানো ফসলের ছবি ${toBn(idx + 1)} (মোট ${toBn(total)}টি)`
        : `Crop photo ${idx + 1} of ${total} sent by the farmer`
      : bn
      ? `বিশেষজ্ঞকে পাঠানো আপনার ফসলের ছবি ${toBn(idx + 1)} (মোট ${toBn(total)}টি)`
      : `Your crop photo ${idx + 1} of ${total}, shared with the expert`;

  const handleDelete = async (photo: ConsultationPhoto) => {
    if (
      !window.confirm(
        bn
          ? 'এই ছবিটি মুছে ফেলবেন? বিশেষজ্ঞ আর এটি দেখতে পাবেন না।'
          : 'Delete this photo? The expert will no longer see it.'
      )
    ) {
      return;
    }
    setDeletingId(photo.id);
    try {
      await deleteConsultationPhoto(consultationId, photo.id);
      if (openId === photo.id) setOpenId(null);
      toast.success(bn ? 'ছবিটি মুছে ফেলা হয়েছে।' : 'Photo deleted.');
    } catch (error: any) {
      toast.error(describeError(error, lang));
    } finally {
      setDeletingId(null);
    }
  };

  if (!ready) return null;
  if (unavailable) {
    return viewer === 'farmer' ? (
      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
        {bn ? 'ছবিগুলো এখন দেখানো যাচ্ছে না।' : 'Photos cannot be shown right now.'}
      </p>
    ) : null;
  }
  if (total === 0) {
    if (!photosConsented) return null;
    return (
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2">
        <ImageIcon className="w-4 h-4 shrink-0" />
        {viewer === 'expert'
          ? bn
            ? 'কৃষক কোনো ছবি পাঠাননি।'
            : 'The farmer did not send any photos.'
          : bn
          ? 'এই অনুরোধের সাথে কোনো ছবি পাঠানো হয়নি।'
          : 'No photos were sent with this request.'}
      </p>
    );
  }

  const opened = photos.find((p) => p.id === openId) || null;
  const openedIdx = opened ? photos.indexOf(opened) : -1;
  const openedSrc = opened ? photoSrc(opened.mimeType, opened.base64) : null;

  return (
    <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 space-y-2">
      <p className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <ImageIcon className="w-4 h-4 shrink-0" />
        {viewer === 'expert'
          ? bn
            ? `কৃষকের পাঠানো ছবি (${toBn(total)}টি) — বড় করে দেখতে চাপুন`
            : `Farmer's photos (${total}) — tap to enlarge`
          : bn
          ? `বিশেষজ্ঞ এই ${toBn(total)}টি ছবি দেখতে পাচ্ছেন`
          : `The expert can see these ${total} photo${total === 1 ? '' : 's'}`}
      </p>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, idx) => {
          const src = photoSrc(photo.mimeType, photo.base64);
          return (
            <div key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => src && setOpenId(photo.id)}
                disabled={!src}
                aria-label={bn ? `ছবি ${toBn(idx + 1)} বড় করে দেখুন` : `Open photo ${idx + 1} larger`}
                className="block w-20 h-20 min-h-[48px] min-w-[48px] rounded-xl overflow-hidden border-2 border-stone-200 dark:border-stone-700 bg-stone-200 dark:bg-stone-800 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {src ? (
                  <img src={src} alt={altFor(idx)} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-sm font-bold text-slate-500">{bn ? 'ত্রুটি' : 'Error'}</span>
                )}
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(photo)}
                  disabled={deletingId === photo.id}
                  aria-label={bn ? `ছবি ${toBn(idx + 1)} মুছুন` : `Delete photo ${idx + 1}`}
                  className="mt-1 w-20 min-h-[48px] rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-rose-700 dark:text-rose-300 text-sm font-black flex items-center justify-center gap-1 disabled:opacity-60"
                >
                  {deletingId === photo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {bn ? 'মুছুন' : 'Delete'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {opened && openedSrc && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={altFor(openedIdx)}
          onClick={() => setOpenId(null)}
        >
          <button
            type="button"
            onClick={() => setOpenId(null)}
            aria-label={bn ? 'বন্ধ করুন' : 'Close'}
            className="absolute top-4 right-4 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <figure className="max-w-full max-h-full flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <img
              src={openedSrc}
              alt={altFor(openedIdx)}
              className="max-w-full max-h-[80dvh] object-contain rounded-xl bg-black"
            />
            <figcaption className="text-sm font-bold text-white/90 text-center">{altFor(openedIdx)}</figcaption>
          </figure>
        </div>,
        document.body
      )}
    </div>
  );
}
