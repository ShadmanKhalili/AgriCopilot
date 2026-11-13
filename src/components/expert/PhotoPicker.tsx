import React, { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  MAX_PHOTOS_PER_REQUEST,
  acceptablePhotoFiles,
  compressPhotoFile,
  photoSrc,
  type CompressedPhoto,
} from '../../utils/imageCompress';
import toBn from '../../utils/banglaNum';

export interface PickedPhoto extends CompressedPhoto {
  key: string;
}

interface PhotoPickerProps {
  lang: 'bn' | 'en';
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
}

let keyCounter = 0;

/** Pick up to 3 crop photos; each is compressed on the phone before upload. */
export default function PhotoPicker({ lang, photos, onChange, disabled = false }: PhotoPickerProps) {
  const bn = lang === 'bn';
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const free = MAX_PHOTOS_PER_REQUEST - photos.length;

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const { accepted, rejected } = acceptablePhotoFiles(Array.from(list), photos.length);
    if (rejected.length > 0) {
      toast.error(
        bn
          ? `সর্বোচ্চ ${toBn(MAX_PHOTOS_PER_REQUEST)}টি ছবি দেওয়া যায়। কিছু ছবি নেওয়া হয়নি।`
          : `Up to ${MAX_PHOTOS_PER_REQUEST} photos. Some photos were not added.`
      );
    }
    if (accepted.length === 0) return;
    setIsWorking(true);
    const added: PickedPhoto[] = [];
    let failed = 0;
    for (const file of accepted) {
      try {
        const photo = await compressPhotoFile(file);
        added.push({ ...photo, key: `ph${Date.now()}_${keyCounter++}` });
      } catch (e) {
        console.warn('Photo compression failed:', e);
        failed++;
      }
    }
    setIsWorking(false);
    if (failed > 0) {
      toast.error(
        bn
          ? `${toBn(failed)}টি ছবি খোলা যায়নি। অন্য ছবি চেষ্টা করুন।`
          : `${failed} photo${failed === 1 ? '' : 's'} could not be opened. Try another photo.`
      );
    }
    if (added.length > 0) onChange([...photos, ...added].slice(0, MAX_PHOTOS_PER_REQUEST));
  };

  return (
    <div className="space-y-2">
      <span className="block text-sm font-black text-slate-700 dark:text-slate-200">
        {bn
          ? `ফসলের ছবি (ঐচ্ছিক, সর্বোচ্চ ${toBn(MAX_PHOTOS_PER_REQUEST)}টি)`
          : `Crop photos (optional, up to ${MAX_PHOTOS_PER_REQUEST})`}
      </span>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, idx) => {
          const src = photoSrc(photo.mimeType, photo.base64);
          return (
            <div
              key={photo.key}
              className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800"
            >
              {src && (
                <img
                  src={src}
                  alt={bn ? `আপনার বেছে নেওয়া ছবি ${toBn(idx + 1)}` : `Your chosen photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(photos.filter((p) => p.key !== photo.key))}
                aria-label={bn ? `ছবি ${toBn(idx + 1)} বাদ দিন` : `Remove photo ${idx + 1}`}
                className="absolute top-0 right-0 min-h-[48px] min-w-[48px] flex items-start justify-end p-1 disabled:opacity-50"
              >
                <span className="w-7 h-7 rounded-full bg-black/65 text-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </span>
              </button>
            </div>
          );
        })}
        {free > 0 && (
          <button
            type="button"
            disabled={disabled || isWorking}
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 min-h-[48px] rounded-xl border-2 border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-60"
          >
            {isWorking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            <span className="text-sm font-black">{bn ? 'ছবি দিন' : 'Add'}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          void handleFiles(files).finally(() => {
            if (inputRef.current) inputRef.current.value = '';
          });
        }}
      />
    </div>
  );
}
