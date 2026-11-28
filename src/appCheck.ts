/**
 * Firebase App Check (reCAPTCHA Enterprise), client side.
 *
 * Off by default: nothing here loads, runs or sends anything until
 * `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` is set at build time. When it is set,
 * the App Check SDK is fetched on demand (never part of the first-load
 * bundle) and `getAppCheckHeader()` returns the `X-Firebase-AppCheck` header
 * the AI endpoints verify (see netlify/functions/_shared/app-check.ts).
 *
 * `getAppCheckHeader()` never throws and never waits longer than
 * `APP_CHECK_TIMEOUT_MS`: a farmer must still get an answer if reCAPTCHA is
 * blocked or slow. The server decides whether a missing token matters
 * (APP_CHECK_MODE), so a failure here only means "no header".
 */
import type { FirebaseApp } from 'firebase/app';

export const APP_CHECK_HEADER = 'X-Firebase-AppCheck';
export const APP_CHECK_TIMEOUT_MS = 3000;

/** How long after load to warm App Check up, so the first AI call is not slowed. */
const WARM_UP_DELAY_MS = 4000;

type AppCheckInstance = import('firebase/app-check').AppCheck;
type AppCheckModule = typeof import('firebase/app-check');

let appForAppCheck: FirebaseApp | null = null;
let ready: Promise<{ instance: AppCheckInstance; sdk: AppCheckModule } | null> | null = null;

/** The configured reCAPTCHA Enterprise site key, or '' when App Check is off. */
export const appCheckSiteKey = (): string =>
  String(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY ?? '').trim();

/** True when App Check was configured at build time. */
export const isAppCheckConfigured = (): boolean => appCheckSiteKey() !== '';

const load = (): Promise<{ instance: AppCheckInstance; sdk: AppCheckModule } | null> => {
  if (ready) return ready;
  const siteKey = appCheckSiteKey();
  if (!siteKey || !appForAppCheck) return Promise.resolve(null);
  const app = appForAppCheck;
  ready = import('firebase/app-check')
    .then((sdk) => {
      const instance = sdk.initializeAppCheck(app, {
        provider: new sdk.ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      return { instance, sdk };
    })
    .catch((error) => {
      console.warn('[app-check] could not start; AI calls go without an App Check token', error);
      return null;
    });
  return ready;
};

/**
 * Remember the Firebase app and, when App Check is configured, start it a few
 * seconds after load. Does nothing without a site key.
 */
export const initAppCheck = (app: FirebaseApp): void => {
  appForAppCheck = app;
  if (!isAppCheckConfigured() || typeof window === 'undefined') return;
  const warm = () => void load();
  const idle = (window as any).requestIdleCallback as ((cb: () => void) => void) | undefined;
  setTimeout(() => (idle ? idle(warm) : warm()), WARM_UP_DELAY_MS);
};

const fetchToken = async (): Promise<string> => {
  const started = await load();
  if (!started) return '';
  const result: any = await started.sdk.getToken(started.instance, false);
  return typeof result?.token === 'string' && !result?.error ? result.token : '';
};

/**
 * `{ 'X-Firebase-AppCheck': token }`, or `{}` when App Check is not
 * configured, not ready within ~3 s, or failed. Never throws.
 */
export const getAppCheckHeader = async (): Promise<Record<string, string>> => {
  if (!isAppCheckConfigured()) return {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await Promise.race([
      fetchToken(),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve(''), APP_CHECK_TIMEOUT_MS);
      }),
    ]);
    return token ? { [APP_CHECK_HEADER]: token } : {};
  } catch {
    return {};
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** Test hook: forget the cached App Check instance. */
export const __resetAppCheckForTests = (): void => {
  ready = null;
  appForAppCheck = null;
};
