# Phase 6 setup guide

This guide is for the app owner. You do these steps once, in the Firebase and Netlify websites, plus two commands in a terminal. Each step says where to click.

## 1. What Phase 6 adds

- **Area warnings.** When 3 or more different farmers in the same upazila report the same crop problem within 14 days, farmers in that area see a warning. Reports are anonymous.
- **Local sale prices.** When 3 or more farmers in an area report a sale price for a crop, farmers see the average, lowest and highest price in that area.
- **Admin broadcasts.** You can send a short message to farmers in one district, or to all districts.
- **Phone notifications.** Farmers who turn them on get a phone alert for area warnings and for their daily tasks.

## 2. Deploy the database rules

The rules decide who can read and write data in Firestore. Phase 6 needs its new rules live.

1. Open a terminal in the project folder.
2. Run: `firebase deploy --only firestore` (this sends the rules and the index the daily reminder needs, see step 5).
3. Wait for the message "Deploy complete".

You need the Firebase command-line tool, and you must be signed in once with `firebase login`.

## 3. Create the service account key

This key lets the server write to the database. Treat it like a password.

1. Open the Firebase console and select your project.
2. Click the gear icon, then **Project settings**.
3. Open the **Service accounts** tab.
4. Click **Generate new private key**, then confirm.
5. A JSON file downloads. Open it in a text editor and copy all of it. You can paste its base64 form instead, if you prefer.
6. In Netlify, open your site and go to **Site configuration → Environment variables**.
7. Click **Add a variable**. Name it `FIREBASE_SERVICE_ACCOUNT` and paste the copied text as the value.
8. Set the scope to **Functions** only, then save.
9. Keep the downloaded file private until it is saved in Netlify. Then delete it.

Never put this key in the code, in GitHub, or in a chat message.

## 4. Create the phone notification (VAPID) keys

These two keys identify your site to phone notification services. You make them once.

1. Open a terminal on a computer with Node.js installed.
2. Run: `npx web-push generate-vapid-keys`
3. The command prints a public key and a private key. Copy both somewhere safe for the next steps.

The `npx` command downloads the small `web-push` tool for this one run only. It is not installed permanently on your computer. If you prefer, any VAPID key generator you trust will do. Choose one that runs on your own computer, because the private key must stay private.

4. In Netlify, go to **Site configuration → Environment variables** and add these four variables. Leave the scope on **All** for each:
   - `VAPID_PUBLIC_KEY`: the public key.
   - `VAPID_PRIVATE_KEY`: the private key.
   - `VAPID_SUBJECT`: a contact address, written as `mailto:your-email@example.com`.
   - `VITE_VAPID_PUBLIC_KEY`: the same value as the public key.
5. Redeploy the site. In Netlify, open **Deploys**, click **Trigger deploy**, then **Deploy site**.

The `VITE_` variable is built into the app when the site is built, so the app only sees it after a redeploy. Redeploy again whenever you change these keys. If you ever change the keys, every farmer must turn phone notifications on again.

## 5. Create the index for daily task reminders

The daily reminder looks through every farmer's open tasks by due date. Firestore needs an index (a lookup table) for that: collection group `tasks`, fields `dueDate` and `status`. It is listed in `firestore.indexes.json`, so step 2 (`firebase deploy --only firestore`) creates it. Building it can take a few minutes; check **Firestore Database → Indexes** until it shows **Enabled**.

**If it is still missing**

The first time the reminder runs, if the index is missing, its log shows an error with a link. Open that link and create the index from there.

## 6. Check that it works

1. Open `https://your-site-address/api/config-status` in a browser. Replace `your-site-address` with your real site address.
   - Look for `areaReportsConfigured` and `pushConfigured`. Both should say `true`.
   - If one says `false`, check the variables from steps 3 and 4, then redeploy.
   - If neither field appears at all, the site does not yet have the Phase 6 code. Tell your developer.
2. Open the app, go to **Profile**, and turn on **phone notifications**. Allow notifications when your phone asks.
3. Open the **admin dashboard** and send a test broadcast to your district. Then open the app on a farmer account in that district and check that the message appears.

## 7. Privacy notes

- Area summaries (`area_summaries`) hold only groups that 3 or more different farmers stand behind: a count, the date of the latest report, and for prices a rounded average and range. They never hold one farmer's day or price, names, phone numbers or user IDs. The date of the last update is a day, not a time. The server rebuilds the summary on every report, so a group that falls below 3 farmers or out of the 14-day window disappears.
- Each farmer's own day and price are kept in `area_raw` (one document per upazila), which no one in the app can read.
- A problem report is accepted only for a place, crop and disease in the app's own lists, and only when the same account saved a diagnosis for that disease in that upazila in the last 14 days. The notification text is built from the app's own names, never from what the app sent. If you change the places, crops or diseases in the app, run `npx tsx scripts/gen-area-catalog.ts` (a test fails when the list is out of date).
- Summaries written by earlier versions held one date per farmer. The app ignores them; delete the `area_summaries` collection once after this version is live (Firebase console, Firestore Database, area_summaries, Delete collection), because those old documents still hold the per-farmer dates for anyone who reads them directly. Counts start again from zero after this; the first 3 reports of a problem rebuild each warning.
- Records of who reported are stored under a one-way code, made from the user ID and a secret server key. The code cannot be turned back into a user ID. Anyone holding the service-account key could still check a known user, so keep that key private.
- No one in the app can read who reported. The database rules block all reads of those records.
- Keep the service-account key and the VAPID private key secret. Never paste them into chat, email or code.
