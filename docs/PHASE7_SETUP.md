# Phase 7 setup guide

This guide is for the app owner. Most steps happen once, in the Firebase and Netlify websites, plus one command in a terminal. Each step says where to click.

## 1. What Phase 7 adds

- **Plots of land.** A farmer can add up to 20 plots. Each plot has a name, a size, a unit (decimal, bigha, acre or katha) and how the land is held: own land, leased, or sharecropped.
- **Season progress.** Each season (a crop) can be linked to a plot. The farmer sets its stage (planned, growing or harvested), the sowing date, the harvest date, and the harvest amount for the whole plot in mon.
- **Costs and sales.** Costs come from the profit calculator. A sale records the amount in mon, the price per mon, the buyer type (trader, market, cooperative, company or other) and the date. Up to 50 sales can be added per season. A saved sale cannot be edited. To fix a mistake, delete it and enter it again.
- **A printable one-page farm record.** It shows plots, seasons, costs, harvest, sales and totals. It says that the farmer wrote it.
- **A record score,** worked out on the server. See section 2.

## 2. What the record score is and is not

The record score is a number out of 100. It shows how complete and how regular the farmer's own record is. It has six parts:

- **Land: 15 points.** 10 points for having at least one plot, and 5 more when the total land is more than zero.
- **Costs: 25 points.** 10 points for each season with at least 3 costs noted, up to 25.
- **Harvest: 15 points.** 8 points for each season with a harvest amount, up to 15.
- **Sales: 15 points.** 8 points for each season with at least one sale, up to 15.
- **Regular use: 20 points.** 2 points for each calendar month in the last 12 with a cost, a sale or a crop check, up to 20.
- **Crop care: 10 points.** 2 points for each photo crop check in the last 12 months, up to 10.

The server works out the score, so the farmer cannot type the number in. It is recalculated at most once every 10 minutes. The levels are Starting (0 to 24), Building (25 to 49), Good (50 to 74) and Strong (75 to 100). Only the farmer and the admin can read it.

**What it is not:**

- It is **not a credit score**. Nobody checks it.
- Nothing in it is verified. The land, costs, harvest and sales are all typed by the farmer. No one checks land papers, receipts or the crop.
- **Do not give it to a bank, a lender or an insurer as proof.**
- The old score that the phone used to calculate is frozen. The database rules stop the phone from saving it as a real score, and it is not the record score.

## 3. Deploy the rules

The rules decide who can read and write the farm record. Phase 7 changes them, so they must be sent to Firestore. Until they are live, saving a plot or a sale is refused.

1. Open a terminal in the project folder.
2. Run: `firebase deploy --only firestore`
3. Wait for the message "Deploy complete".

This is the same command as in the Phase 6 guide. You need the Firebase command-line tool, and you must be signed in with `firebase login`.

## 4. Use the same service account key

Phase 7 uses the same `FIREBASE_SERVICE_ACCOUNT` key that you set up for Phase 6. You do not need a new key.

- If Phase 6 is already set up, there is nothing more to do here.
- If not, follow section 3 of the Phase 6 guide first. Keep the key private. Never paste it into chat, email or code.
- Without the key, the score card says **Not set up yet**. The rest of the farm record still works: plots, seasons, costs, sales and the printed page.

## 5. Check that it works

1. Open `https://your-site-address/api/config-status` in a browser. Replace `your-site-address` with your real site address.
   - Look for `areaReportsConfigured`. It should say `true`. It uses the same key as Phase 6.
   - If it says `false`, check the `FIREBASE_SERVICE_ACCOUNT` variable from section 4, then redeploy.
   - If the field is missing, the newest code is not on the site yet. Tell your developer.
2. Open the app with a test farmer account, so that no real farm data is mixed in.
3. Go to **Profile**, then open **Farm record**.
4. Add a plot. Give it a name, a size, a unit and how the land is held. Save it.
5. Open a season and link it to the plot. Set its stage, sowing date, harvest date and harvest amount.
6. Record a sale for that season: amount in mon, price per mon, buyer type and date.
7. Press **Recalculate** on the score card. The score and its six parts should appear. You can recalculate only once every 10 minutes.
8. Print the farm record. It should fit on one page and say that the farmer wrote it.

If saving a plot or a sale fails with a permission error, the rules are not live yet. Go back to section 3.

## 6. For an agronomist or lender partner later

**Not done yet.** Today the score cannot be used for credit, and it is for the farmer only. Before a partner could rely on it, these would have to be added:

- Checks of land documents against each plot, such as land papers, lease or sharecrop agreements.
- Buyer receipts for each sale.
- Field visits by an agronomist to confirm the plot, the crop and the harvest.
- The farmer's clear consent to share the record with a named partner, with a way to take that consent back.

Any credit use would also need its own review by the partner.
