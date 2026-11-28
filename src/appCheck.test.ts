import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  initializeAppCheck: vi.fn(() => ({ fake: 'app-check' })),
  getToken: vi.fn(async (): Promise<any> => ({ token: 'tok-123' })),
  ReCaptchaEnterpriseProvider: vi.fn(function (this: any, key: string) {
    this.key = key;
  }),
}));

vi.mock('firebase/app-check', () => sdk);

import {
  APP_CHECK_HEADER,
  __resetAppCheckForTests,
  getAppCheckHeader,
  initAppCheck,
  isAppCheckConfigured,
} from './appCheck';
import { aiErrorMessage } from './utils/aiErrorMessage';

const fakeApp = { name: '[DEFAULT]' } as any;

beforeEach(() => {
  __resetAppCheckForTests();
  sdk.initializeAppCheck.mockClear();
  sdk.getToken.mockReset();
  sdk.getToken.mockResolvedValue({ token: 'tok-123' });
  sdk.ReCaptchaEnterpriseProvider.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('getAppCheckHeader', () => {
  it('returns {} and loads nothing when no site key is configured', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', '');
    initAppCheck(fakeApp);
    expect(isAppCheckConfigured()).toBe(false);
    expect(await getAppCheckHeader()).toEqual({});
    expect(sdk.initializeAppCheck).not.toHaveBeenCalled();
  });

  it('returns the token header once configured, initialising App Check once', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'site-key');
    initAppCheck(fakeApp);
    expect(await getAppCheckHeader()).toEqual({ [APP_CHECK_HEADER]: 'tok-123' });
    await getAppCheckHeader();
    expect(sdk.initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(sdk.initializeAppCheck).toHaveBeenCalledWith(
      fakeApp,
      expect.objectContaining({ isTokenAutoRefreshEnabled: true })
    );
    expect(sdk.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('site-key');
  });

  it('returns {} (never throws) when the token cannot be fetched', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'site-key');
    initAppCheck(fakeApp);
    sdk.getToken.mockRejectedValue(new Error('recaptcha blocked'));
    expect(await getAppCheckHeader()).toEqual({});
    sdk.getToken.mockResolvedValue({ token: '', error: new Error('x') });
    expect(await getAppCheckHeader()).toEqual({});
  });

  it('gives up after about 3 seconds instead of blocking the request', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'site-key');
    initAppCheck(fakeApp);
    sdk.getToken.mockImplementation(() => new Promise(() => {}));
    const pending = getAppCheckHeader();
    await vi.advanceTimersByTimeAsync(3100);
    expect(await pending).toEqual({});
  });
});

describe('aiErrorMessage for the new proxy errors', () => {
  it('explains an app-wide daily limit in Bangla and English', () => {
    expect(aiErrorMessage(new Error('daily_capacity'), 'bn')).toContain('আজকের এআই সীমা শেষ');
    expect(aiErrorMessage(new Error('daily_capacity'), 'en')).toContain(
      "The app's AI limit for today is used up, please try again tomorrow"
    );
  });

  it('explains a failed App Check', () => {
    expect(aiErrorMessage(new Error('app_check'), 'en')).toContain('reload');
  });
});
