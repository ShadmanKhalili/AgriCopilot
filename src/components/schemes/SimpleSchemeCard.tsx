import React from 'react';
import { Bot, ExternalLink, Phone } from 'lucide-react';
import type { Language } from '../../utils/translations';
import Card from '../ui/Card';
import Disclosure from '../ui/Disclosure';
import ListenButton from '../ui/ListenButton';
import { safeExternalUrl, externalHostLabel } from '../../utils/security';
import { fixSchemeLinks } from '../../utils/schemeLinks';
import type { GovScheme } from './types';

interface Props {
  scheme: GovScheme;
  lang: Language;
  /** One plain line on why this scheme is listed for the farmer. */
  why?: string;
  /** Marks a scheme matched on the farmer's own crop, district or land. */
  strong?: boolean;
  onAsk: (scheme: GovScheme) => void;
}

const Row = ({ label, text }: { label: string; text?: string }) =>
  text ? (
    <div>
      <p className="text-sm font-bold text-stone-500 dark:text-stone-400">{label}</p>
      <p className="text-base text-stone-800 dark:text-stone-100 leading-relaxed">{text}</p>
    </div>
  ) : null;

/** A large, plain scheme card for the simple view. */
export default function SimpleSchemeCard({ scheme, lang, why, strong = false, onAsk }: Props) {
  const bn = lang === 'bn';
  const title = scheme.title?.[lang] || scheme.title?.en || '';
  const description = scheme.description?.[lang] || '';
  const links = fixSchemeLinks(scheme.sourceLinks)
    .map((url) => ({ href: safeExternalUrl(url), host: externalHostLabel(url) }))
    .filter((l): l is { href: string; host: string } => Boolean(l.href));
  const spoken = [title, why, description].filter(Boolean).join(bn ? '। ' : '. ');

  return (
    <Card className={strong ? 'border-emerald-600 dark:border-emerald-500 border-2' : ''}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-lg font-bold text-stone-900 dark:text-stone-50 leading-snug">{title}</h4>
        <ListenButton text={spoken} lang={lang} variant="icon" className="shrink-0 min-h-[48px]! min-w-[48px]!" />
      </div>
      {why && (
        <p className="mt-2 text-base font-semibold text-emerald-800 dark:text-emerald-300 leading-snug">{why}</p>
      )}
      {description && (
        <p className="mt-2 text-base text-stone-700 dark:text-stone-300 leading-relaxed">{description}</p>
      )}

      <button
        type="button"
        onClick={() => onAsk(scheme)}
        className="mt-4 flex items-center justify-center gap-2 w-full min-h-[56px] rounded-2xl bg-emerald-700 text-white text-base font-bold active:scale-[0.98] transition-transform"
      >
        <Bot className="w-6 h-6" aria-hidden="true" />
        <span>{bn ? 'এই প্রকল্প নিয়ে প্রশ্ন করুন' : 'Ask about this scheme'}</span>
      </button>

      <Disclosure label={bn ? 'আরও জানুন' : 'More details'} className="mt-3">
        <div className="space-y-3">
          <Row label={bn ? 'কারা পাবেন' : 'Who can get it'} text={scheme.eligibility?.[lang]} />
          <Row label={bn ? 'কী পাবেন' : 'What you get'} text={scheme.benefits?.[lang]} />
          <Row label={bn ? 'কীভাবে আবেদন করবেন' : 'How to apply'} text={scheme.howToApply?.[lang]} />
          <Row label={bn ? 'কখন' : 'When'} text={scheme.deadline?.[lang]} />
          <Row label={bn ? 'যোগাযোগ' : 'Contact'} text={scheme.contactInfo?.[lang]} />
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-emerald-900/60 text-base font-bold text-sky-800 dark:text-sky-300"
            >
              <span className="truncate">{bn ? `ওয়েবসাইট: ${link.host}` : `Website: ${link.host}`}</span>
              <ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />
            </a>
          ))}
          <a
            href="tel:16123"
            className="flex items-center gap-3 min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-emerald-900/60 text-base font-bold text-stone-800 dark:text-stone-100"
          >
            <Phone className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{bn ? 'কৃষি কল সেন্টারে ফোন করুন: ১৬১২৩' : 'Call the Krishi Call Centre: 16123'}</span>
          </a>
        </div>
      </Disclosure>
    </Card>
  );
}
