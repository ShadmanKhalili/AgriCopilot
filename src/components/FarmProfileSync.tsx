import { useFarmProfileSync } from '../hooks/useFarmProfileSync';

/**
 * Keeps the farmer's onboarding answers in step with their account. Renders
 * nothing. Must sit inside both AppSettingsProvider and AuthProvider.
 */
export default function FarmProfileSync(): null {
  useFarmProfileSync();
  return null;
}
