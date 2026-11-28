# Abuse protection for the AI endpoints

Two switches, both OFF until you configure them:

1. **Firebase App Check** (reCAPTCHA Enterprise): proves a request comes from the real web app, so a script that mass-creates accounts cannot drain the Gemini key.
2. **Global daily call cap**: one app-wide ceiling on AI calls per day (Asia/Dhaka), as a last-resort spend limit.

Nothing changes for farmers until the variables below are set.

## A. App Check

### 1. Create the reCAPTCHA Enterprise key
1. Google Cloud console, the same project as Firebase: **Security > reCAPTCHA Enterprise** (enable the API if asked).
2. **Create key**, type **Website**, score based (not checkbox).
3. Add every domain the app is served from (production domain, the `*.netlify.app` domain, any custom domain). Do not add `localhost` to the production key.
4. Copy the **site key**.

### 2. Register the web app in Firebase App Check
1. Firebase console > **Build > App Check > Apps**.
2. Select the web app, choose **reCAPTCHA Enterprise**, paste the site key, save. Leave the default token lifetime (1 hour).

### 3. Set the variables (Netlify > Site configuration > Environment variables)
| Variable | Value |
|---|---|
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | the site key (public; built into the app, so **redeploy**) |
| `APP_CHECK_PROJECT_NUMBER` | Firebase project number (Project settings > General) |
| `APP_CHECK_MODE` | `monitor` first |

### 4. Roll out in two steps
1. **Monitor** (`APP_CHECK_MODE=monitor`): the server verifies every token and logs failures as `[app-check] monitor: <reason>` in the Netlify function log for `ai-proxy`, but allows the request. Watch for a few days. Reasons: `missing_token` (old cached app version, blocked reCAPTCHA, ad blocker), `bad_audience` / `bad_issuer` (wrong `APP_CHECK_PROJECT_NUMBER`), `not_configured` (variable missing), `expired`, `bad_signature`.
   If almost every request fails, fix the cause before moving on.
2. **Enforce** (`APP_CHECK_MODE=enforce`): a missing or invalid token is refused with `401 {"error":"app_check"}` and the app shows "reload the page". Old app versions open in a browser tab will fail until reloaded. To roll back, set the mode back to `monitor` or `off` (no redeploy needed for server variables beyond Netlify's normal env change).

### Local development
Production keys do not work on `localhost`. Leave `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` empty locally (App Check is then skipped and `APP_CHECK_MODE` stays `off`). To test against a real project, use a debug token: set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in the browser console before the app loads and register the printed token under Firebase console > App Check > Apps > Manage debug tokens.

### Firestore and other Firebase services (separate, later step)
In the App Check console you can also **Enforce** App Check for Firestore and Authentication. This is deliberately NOT part of this change: enforcement blocks every client that does not send a token, including old cached app versions and anything not yet registered. Do it only after the AI endpoints have been enforced for a while and the monitor numbers in the App Check console (verified vs unverified requests) are almost all verified.

## B. Global daily call cap

Set `AI_GLOBAL_DAILY_CALL_CAP` to the most AI calls the whole app may serve in one Dhaka day (text, audio and live sessions all count). Pick it from the daily budget you are willing to pay for, divided by the average cost of a call. Examples: `5000`.

- Requires `FIREBASE_SERVICE_ACCOUNT` (see `PHASE6_SETUP.md`). The count lives in Firestore at `aiUsageGlobal/<YYYY-MM-DD>` (fields `calls`, `textCalls`, `audioCalls`, `liveCalls`); no browser can write there (the Firestore rules deny every collection they do not mention).
- When the cap is reached the AI proxy answers `503 {"error":"daily_capacity"}` and the app tells the farmer, in Bangla or English, that the app's AI limit for today is used up. It resets at midnight Bangladesh time.
- A call refused by the cap does not use the farmer's own daily allowance.
- If the counter cannot be reached (Firestore outage, no service account), the cap is skipped for that call and a warning is logged; the per-account allowance still applies.
- The count includes calls refused over the cap, so the counter can read a little above the cap on a busy day.
- To raise or lift the cap during the day, change or clear the variable (a new Netlify deploy or env update applies it); the day's count is kept.
