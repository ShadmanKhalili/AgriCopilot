/**
 * The crops offered as "my main crop" in the welcome screens. The ids match
 * the crop keys the profit calculator already understands.
 */
export interface MainCrop {
  id: string;
  emoji: string;
  bn: string;
  en: string;
}

export const MAIN_CROPS: MainCrop[] = [
  { id: 'paddy', emoji: '🌾', bn: 'ধান', en: 'Rice' },
  { id: 'potato', emoji: '🥔', bn: 'আলু', en: 'Potato' },
  { id: 'tomato', emoji: '🍅', bn: 'টমেটো', en: 'Tomato' },
  { id: 'onion', emoji: '🧅', bn: 'পেঁয়াজ', en: 'Onion' },
  { id: 'brinjal', emoji: '🍆', bn: 'বেগুন', en: 'Brinjal' },
  { id: 'chili', emoji: '🌶️', bn: 'মরিচ', en: 'Chilli' },
  { id: 'maize', emoji: '🌽', bn: 'ভুট্টা', en: 'Maize' },
  { id: 'mustard', emoji: '🌼', bn: 'সরিষা', en: 'Mustard' },
  { id: 'jute', emoji: '🌿', bn: 'পাট', en: 'Jute' },
];

export const mainCropLabel = (id: string | null | undefined, lang: 'bn' | 'en'): string | null => {
  const crop = MAIN_CROPS.find((c) => c.id === id);
  return crop ? crop[lang] : null;
};
