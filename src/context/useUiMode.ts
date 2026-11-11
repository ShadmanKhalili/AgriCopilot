import type { UiMode } from '../nav/tabs';
import { useAuth } from '../components/AuthProvider';
import { useAppSettings } from './AppSettingsContext';

/** The view to use when the person has not picked one. */
export const defaultModeForRole = (role: string | null | undefined): UiMode =>
  role === 'admin' || role === 'expert' || role === 'org_admin' ? 'full' : 'simple';

/**
 * The view in effect: what the person picked, or else the simple view for
 * farmers and the full view for staff (admins and experts).
 */
export function useUiMode(): UiMode {
  const { modePreference } = useAppSettings();
  const { userRole } = useAuth();
  return modePreference ?? defaultModeForRole(userRole);
}
