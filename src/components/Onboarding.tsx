import React, { useEffect, useState } from 'react';
import { Check, Leaf, Loader2, MapPin, Navigation } from 'lucide-react';
import type { Language } from '../utils/translations';
import { useAppSettings } from '../context/AppSettingsContext';
import { detectUserLocation } from '../utils/geolocation';
import { speakWithBrowser, stopSpeaking } from '../utils/speech';
import { MAIN_CROPS } from '../data/mainCrops';
import ListenButton from './ui/ListenButton';
import type { District } from '../utils/geoData';

type Step = 'language' | 'area' | 'crop';

const TEXT = {
  areaTitle: { bn: 'আপনার এলাকা কোথায়?', en: 'Where is your farm?' },
  areaHint: {
    bn: 'আপনার এলাকার আবহাওয়া ও বাজারদর দেখাতে এটি লাগবে।',
    en: 'We use this to show the weather and prices for your area.',
  },
  useGps: { bn: 'আমার অবস্থান ব্যবহার করুন', en: 'Use my location' },
  gpsFailed: {
    bn: 'অবস্থান পাওয়া যায়নি। নিচে থেকে জেলা বেছে নিন।',
    en: 'Could not find your location. Please choose your district below.',
  },
  or: { bn: 'অথবা নিজে বেছে নিন', en: 'Or choose it yourself' },
  district: { bn: 'জেলা', en: 'District' },
  upazila: { bn: 'উপজেলা', en: 'Upazila' },
  chooseDistrict: { bn: 'জেলা বেছে নিন', en: 'Choose district' },
  chooseUpazila: { bn: 'উপজেলা বেছে নিন', en: 'Choose upazila' },
  cropTitle: { bn: 'আপনি প্রধানত কী চাষ করেন?', en: 'What do you mainly grow?' },
  cropHint: { bn: 'একটি বেছে নিন। পরে বদলাতে পারবেন।', en: 'Pick one. You can change it later.' },
  next: { bn: 'পরের ধাপ', en: 'Next' },
  start: { bn: 'শুরু করুন', en: 'Start' },
  skip: { bn: 'পরে করব', en: 'Skip for now' },
};

interface Props {
  onDone: () => void;
}

/**
 * The first-run welcome: language, area, main crop. Every step can be skipped,
 * and each prompt is read aloud once the farmer has tapped something (a
 * browser will not speak before the first tap).
 */
export default function Onboarding({ onDone }: Props) {
  const { lang, setLang, setLocation, setPlace, mainCrop, setMainCrop, setHasOnboarded } = useAppSettings();
  const [step, setStep] = useState<Step>('language');
  const [districts, setDistricts] = useState<District[] | null>(null);
  const [districtId, setDistrictId] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [crop, setCrop] = useState<string | null>(mainCrop);

  const tr = (entry: { bn: string; en: string }) => entry[lang];

  // The district list is large, so it is fetched only when the area step opens.
  useEffect(() => {
    if (step !== 'area' || districts) return;
    let cancelled = false;
    import('../utils/geoData')
      .then((m) => {
        if (cancelled) return;
        const sorted = [...m.geoData].sort((a, b) => a.name.localeCompare(b.name));
        setDistricts(sorted);
      })
      .catch(() => {
        if (!cancelled) setDistricts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [step, districts]);

  useEffect(() => () => stopSpeaking(), []);

  const district = districts?.find((d) => d.id === districtId) || null;
  const upazila = district?.upazilas.find((u) => u.id === upazilaId) || null;

  const chooseLanguage = (next: Language) => {
    setLang(next);
    setStep('area');
    speakWithBrowser(`${TEXT.areaTitle[next]} ${TEXT.areaHint[next]}`, next);
  };

  const detect = async () => {
    setDetecting(true);
    setGpsFailed(false);
    try {
      // No IP-address guess here: it often names the internet provider's city,
      // not the farm. If GPS fails the farmer picks the district instead.
      const found = await detectUserLocation({ allowFallback: false, timeout: 10000 });
      if (found.isFallback || found.isWithinBangladesh === false) throw new Error('outside Bangladesh');
      const coords = { latitude: Number(found.latitude.toFixed(5)), longitude: Number(found.longitude.toFixed(5)) };
      setGpsCoords(coords);
      const { findNearestLocation } = await import('../utils/geoData');
      setDistrictId(findNearestLocation(coords.latitude, coords.longitude, 'en').district.id);
      setUpazilaId('');
    } catch {
      setGpsFailed(true);
    } finally {
      setDetecting(false);
    }
  };

  const saveArea = () => {
    if (district) {
      // GPS gives the farm's own position; a picked upazila gives its centre.
      const fromGps = gpsCoords && !upazila ? gpsCoords : null;
      setLocation(
        fromGps || {
          latitude: upazila?.lat || district.lat,
          longitude: upazila?.lng || district.lng,
        }
      );
      setPlace({
        district: district.name,
        districtBn: district.bn_name,
        upazila: upazila?.name,
        upazilaBn: upazila?.bn_name,
      });
    }
    goToCrop();
  };

  const goToCrop = () => {
    setStep('crop');
    speakWithBrowser(`${TEXT.cropTitle[lang]} ${TEXT.cropHint[lang]}`, lang);
  };

  const finish = (save: boolean) => {
    if (save && crop) setMainCrop(crop);
    stopSpeaking();
    setHasOnboarded(true);
    onDone();
  };

  const stepNumber = step === 'language' ? 1 : step === 'area' ? 2 : 3;
  const selectClass =
    'w-full min-h-[56px] rounded-2xl border-2 border-stone-300 bg-white px-4 text-lg font-bold text-stone-900 focus:border-emerald-700 focus:outline-none';
  const primaryClass =
    'w-full min-h-[60px] rounded-2xl bg-emerald-700 text-white text-xl font-bold active:scale-[0.98] transition-transform disabled:opacity-50';
  const skipClass = 'w-full min-h-[48px] text-base font-bold text-stone-600 underline underline-offset-4';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'bn' ? 'স্বাগতম' : 'Welcome'}
      className="fixed inset-0 z-[100] bg-[#F4F6F4] text-stone-900 overflow-y-auto"
    >
      <div className="min-h-full max-w-md mx-auto flex flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-emerald-800">
            <span className="w-11 h-11 rounded-2xl bg-emerald-700 text-white flex items-center justify-center">
              <Leaf className="w-6 h-6" aria-hidden="true" />
            </span>
            <span className="text-xl font-bold">{lang === 'bn' ? 'স্মার্ট কৃষি সেবা' : 'Smart Agri-Tools'}</span>
          </div>
          <div className="flex items-center gap-1.5" aria-label={`${stepNumber} / 3`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-2.5 rounded-full ${n === stepNumber ? 'w-7 bg-emerald-700' : 'w-2.5 bg-stone-300'}`} />
            ))}
          </div>
        </div>

        {step === 'language' && (
          <div className="flex-1 flex flex-col justify-center gap-5">
            <h1 className="text-3xl font-bold text-center leading-snug">
              ভাষা বেছে নিন
              <span className="block text-xl font-bold text-stone-600 mt-1">Choose your language</span>
            </h1>
            <button type="button" onClick={() => chooseLanguage('bn')} className="w-full min-h-[88px] rounded-2xl bg-emerald-700 text-white text-3xl font-bold active:scale-[0.98] transition-transform">
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => chooseLanguage('en')}
              className="w-full min-h-[88px] rounded-2xl border-2 border-emerald-700 text-emerald-800 text-3xl font-bold active:scale-[0.98] transition-transform bg-white"
            >
              English
            </button>
          </div>
        )}

        {step === 'area' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold leading-snug">{tr(TEXT.areaTitle)}</h1>
                <p className="text-base text-stone-700 mt-1">{tr(TEXT.areaHint)}</p>
              </div>
              <ListenButton text={`${tr(TEXT.areaTitle)} ${tr(TEXT.areaHint)}`} lang={lang} variant="icon" />
            </div>

            <button type="button" onClick={detect} disabled={detecting} className={`${primaryClass} flex items-center justify-center gap-3`}>
              {detecting ? <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" /> : <Navigation className="w-6 h-6" aria-hidden="true" />}
              <span>{tr(TEXT.useGps)}</span>
            </button>
            {gpsFailed && (
              <p role="alert" className="text-base font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-2xl p-3">
                {tr(TEXT.gpsFailed)}
              </p>
            )}

            <p className="text-center text-base font-bold text-stone-600">{tr(TEXT.or)}</p>

            <label className="block">
              <span className="block text-base font-bold mb-1">{tr(TEXT.district)}</span>
              <select
                value={districtId}
                onChange={(e) => {
                  setDistrictId(e.target.value);
                  setUpazilaId('');
                  setGpsCoords(null);
                }}
                disabled={!districts}
                className={selectClass}
              >
                <option value="">{districts ? tr(TEXT.chooseDistrict) : '…'}</option>
                {districts?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {lang === 'bn' ? d.bn_name : d.name}
                  </option>
                ))}
              </select>
            </label>

            {district && district.upazilas.length > 0 && (
              <label className="block">
                <span className="block text-base font-bold mb-1">{tr(TEXT.upazila)}</span>
                <select value={upazilaId} onChange={(e) => setUpazilaId(e.target.value)} className={selectClass}>
                  <option value="">{tr(TEXT.chooseUpazila)}</option>
                  {district.upazilas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {lang === 'bn' ? u.bn_name : u.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {district && (
              <p className="flex items-center gap-2 text-base font-bold text-emerald-800">
                <MapPin className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>
                  {upazila ? `${lang === 'bn' ? upazila.bn_name : upazila.name}, ` : ''}
                  {lang === 'bn' ? district.bn_name : district.name}
                </span>
              </p>
            )}

            <div className="mt-auto pt-4 space-y-2">
              <button type="button" onClick={saveArea} disabled={!district} className={primaryClass}>
                {tr(TEXT.next)}
              </button>
              <button type="button" onClick={goToCrop} className={skipClass}>
                {tr(TEXT.skip)}
              </button>
            </div>
          </div>
        )}

        {step === 'crop' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold leading-snug">{tr(TEXT.cropTitle)}</h1>
                <p className="text-base text-stone-700 mt-1">{tr(TEXT.cropHint)}</p>
              </div>
              <ListenButton text={`${tr(TEXT.cropTitle)} ${tr(TEXT.cropHint)}`} lang={lang} variant="icon" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {MAIN_CROPS.map((c) => {
                const selected = crop === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCrop(c.id)}
                    aria-pressed={selected}
                    className={`relative flex flex-col items-center justify-center gap-1 min-h-[104px] rounded-2xl border-2 bg-white active:scale-[0.97] transition-transform ${
                      selected ? 'border-emerald-700 bg-emerald-50' : 'border-stone-200'
                    }`}
                  >
                    <span className="text-4xl leading-none" aria-hidden="true">{c.emoji}</span>
                    <span className="text-base font-bold">{c[lang]}</span>
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center">
                        <Check className="w-4 h-4" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-4 space-y-2">
              <button type="button" onClick={() => finish(true)} disabled={!crop} className={primaryClass}>
                {tr(TEXT.start)}
              </button>
              <button type="button" onClick={() => finish(false)} className={skipClass}>
                {tr(TEXT.skip)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
