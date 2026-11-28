# AgriCopilot: the assistant-first plan

28 November 2026. Written after an audit of the original app (commit `6fa2c78`, 16 October 2026) against today's app (`main`, after PR #45).

The full audits are in `docs/audit/`:
- `FEATURES_ORIGINAL_VS_NOW.md`: 110 original features, each with whether it really worked, its status now, why, and whether to bring it back.
- `AI_AND_DATA_TODAY.md`: every AI call, what each one knows about the farmer, every piece of farmer data we store, and the gaps.
- `GEMINI_CAPABILITIES.md`: current Gemini models, features and prices, with sources, and what we could use.

---

## 1. The short answer

**The app does not feel like your idea because the AI is in the wrong place, not because features were removed.**

- **Nothing was deleted.** No file was removed between the original and today. All 14 original tools still exist, two taps from Home under "All services". Full mode shows the original layout.
- **What was removed was invented content.** For example: frozen ticker prices, made-up market rows and "live bids", sine-wave radar, fake healing percentages, "16.5M farmers" badges, demo experts shown as "available now", and a QR code pointing at a domain we don't own. Removing these was right, but it also removed things that *looked* intelligent.
- **The real problem is how the AI is built today:**
  1. **It is absent from Home.** Home has no AI at all. The biggest card is weather, and three of the five bottom buttons are lookups (weather, market, all).
  2. **It is split into six separate assistants** (crop doctor chat, live video, live voice call, market note, scheme chat, plus human experts). They share no memory.
  3. **It doesn't know the farmer.** Only live video reads the farmer's history. Every other AI call knows only the district and season. The farmer's crop, plots, seasons, costs, sales, diagnoses, tasks and area warnings are never given to the AI.
  4. **It cannot act.** The AI cannot add a reminder, log a cost, record a sale or book an expert. It can only talk.
  5. **It never speaks first.** The only scheduled message is a 7 am push saying "you have N tasks".

**The plan:** put one assistant at the centre of the app. It knows the farmer, remembers, speaks first every morning, takes actions with the farmer's permission, and coaches through the season and the money. Old features come back one at a time, through the assistant and only with real data.

---

## 2. What the audit found

### 2.1 Original features against today

| Status now | Features |
|---|---|
| Unchanged | 31 |
| Improved | 24 |
| Hidden (under "More details" or Full mode only) | 18 |
| Replaced | 12 |
| New in the original's area | 9 |
| Removed (all were invented or broken) | 7 |
| Reduced | 6 |
| Moved | 3 |

Another 24 features were added by the refactor: the welcome screens, Home today card, 7-day strip, the rule engine, reminders, area warnings, local prices, the government price bulletin, saved profit plans and expense notes, "For you" schemes, photos shared with experts, the farm record and score, push notifications, and 902 tests.

**What made the app feel less AI-first:**
- **Live video** used to be the main mode. In Simple mode it is now the second button inside Crop doctor, two taps from Home.
- **Several crop doctor parts are under "More details":** deep analysis, other possible causes, the dose calculator and the recovery guide.
- **Market** now shows only the dated government price range for about 12 items. Tomato, potato and brinjal are not in the bulletin.
- **Grading, Profit, What to plant, Satellite, Climate advice and Schemes** are two taps away and are never suggested to the farmer.
- **What to plant** still ignores soil, zone risk, prices and the farmer's history.

### 2.2 How the AI works today

| AI feature | What it knows about the farmer | Can it act? | Where |
|---|---|---|---|
| Photo diagnosis and its chat | District, season, climate risks | No | Crop doctor |
| Live video | Today's weather, saved profile, last 3 events | No | Crop doctor → Live |
| Live voice call | Raw GPS coordinates only | No | Experts |
| Market note | Government price bulletin | No | Market → More details |
| Scheme chat | Nothing | No | All services → Schemes |
| What to plant | Land, budget, weather, satellite estimate | No | All services |
| Home today card | (No AI: fixed rules) | No | Home |

Other findings:
- **Three AI functions have no caller:** the weather advice text, scheme search and market-by-location. The weather advice was never shown, even in the original.
- **Onboarding answers stay on the phone.** The farmer's main crop, area and language, and the crop calendar plan, live only in browser storage. A server job cannot personalise anything from them.
- **The quota is low for guests.** Most farmers are guest accounts with 10 AI calls a day, and one chat turn is one call.

### 2.3 Gemini features we don't use yet

None of these is used today:
- **Function calling:** lets the AI use tools such as "add reminder" or "get my costs".
- **Live session compression and resumption:** see the warning below.
- **Context caching:** cheaper repeated prompts.
- **Batch API:** half price, good for a nightly briefing job.
- **File Search:** answers grounded in a library we choose, such as BARI/BRRI/DAE guides.
- **The newer speech-to-text model,** which lists Bangla (`bn-BD`).

**Check urgently.** Google's documentation says a Live session with video ends after about **2 minutes** unless context compression is turned on, and any connection is cut after about 10 minutes. We turn on neither. If farmers see live video drop after 2 minutes, this is why. It is the first item in Phase 8.

Prices and limits in the research are as published on 28 November 2026. Some will change: Google's price table shows 3.8 Flash doubling on 1 January 2027. Recheck them before launch.

---

## 3. What the farmer will experience

### 3.1 Home becomes the assistant's page

From top to bottom:

1. **Morning briefing** (with a Listen button, read aloud automatically on the first open of the day if the farmer allows it):
   > "শুভ সকাল রহিম ভাই। আপনার আলুর বয়স ৪৫ দিন। আজ স্প্রে করবেন না, বিকেল ৩টার পর বৃষ্টি হতে পারে। পাবনায় আলুর দাম এই সপ্তাহে ৮% বেড়েছে। এ পর্যন্ত খরচ ৳১২,৪০০; এই দামে বিক্রি করলে আনুমানিক লাভ ৳১৮,০০০।"
   >
   > ("Good morning, Rahim bhai. Your potatoes are 45 days old. Don't spray today; rain may come after 3 pm. Potato prices in Pabna rose 8% this week. You have spent ৳12,400 so far; at this price your profit would be about ৳18,000.")

2. **Ask bar:** one big mic button ("বলুন"), a camera button and a live video button, with a text box underneath. Every kind of question starts here.
3. **Today:** the spray / irrigate / fertilise lights in a compact row. They are the same rules as now.
4. **My season:** crop, day N of the season, next step, money so far and expected profit.
5. **Tasks and area warning:** as now.
6. **A grid of 8 tools**, so the farmer can see them instead of searching under "All services".

**Bottom bar:** Home, Ask (the assistant), Crop doctor, Market, All. Weather moves into Home and the assistant. The full weather screen is still one tap away from the Today card.

### 3.2 One assistant everywhere

- **One conversation and one memory,** whether the farmer types, holds the mic, sends a photo or starts live video. Crop doctor chat, live video, the voice call and scheme chat all become ways into the same assistant.
- **It knows the farmer:** crop and stage, plots, recent diagnoses and recovery, open tasks, costs and sales, area warnings, today's weather rules and the local price.
- **It remembers** facts the farmer tells it (for example "my land floods every July" or "I use a shallow tube well") and shows them in a "What I remember" list that the farmer can edit or delete.
- **It acts, always asking first.** For example:
  > Farmer: "আজ ৯০০ টাকার ইউরিয়া কিনলাম"
  >
  > Assistant: "আলুর মৌসুমে সার খরচ হিসেবে ৳৯০০ লিখব?" [হ্যাঁ] [না]
  >
  > (Farmer: "I bought ৳900 of urea today." Assistant: "Shall I add ৳900 as a fertiliser cost to your potato season?" [Yes] [No])

  It can add reminders, log costs and sales, set the sowing date, open the dose calculator with the product filled in, open an expert request with a summary already written, and find schemes the farmer is eligible for.
- **It hands over honestly.** Doses, spray decisions and anything risky come from our rule tables, not the AI. When it is unsure, it says so and offers an expert or the 16123 helpline.

### 3.3 It speaks first

- **Morning briefing:** a push notification plus the Home card.
- **Follow-ups:** three days after a diagnosis it asks "how do the leaves look now?", and the answer goes into the recovery log.
- **Stage nudges** from the crop calendar, for example "first top dressing is due this week".
- **Area warnings:** "3 farmers in your upazila reported late blight."
- **Price moves for the farmer's crop,** and scheme deadlines.

### 3.4 Season coach

- **Start of the season:** "What to plant" is rebuilt to use soil, zone risk, prices and the farmer's past seasons.
- **During the season:** it tracks the crop stage, nudges at each stage, follows up after a diagnosis, and compares the farmer's costs with typical costs.
- **End of the season:** a harvest and sales summary, and lessons for next time ("you spent 30% more on pesticide than typical; most of it came after the late blight").

### 3.5 Money coach

- **A profit forecast** that updates as costs and sales come in.
- **When to sell:** a price trend from the government bulletin plus local prices reported by farmers, clearly labelled as an estimate.
- **An input cost check** against benchmarks.
- **Schemes and loans** matched to the farmer's answers about land and tenure.
- **A farm record good enough to show a lender:** the existing farm record and score, filled in by the assistant from what the farmer says.

---

## 4. Rules the assistant must follow

1. **Rules decide, the AI explains.** Doses, spray and irrigation decisions and area warnings come from tested code. The AI may only narrate them, so it can never contradict the Home card.
2. **Numbers come from tools.** Every number the assistant says comes from a tool result: weather, prices, the farmer's costs, the rules. It never invents a price, yield or dose.
3. **Ask before writing.** Every action that saves something shows a yes/no card first. The server checks every write again.
4. **Label what is an estimate.** Official data, the farmer's own data and AI estimates are labelled differently.
5. **Bangla first and voice first.** Short sentences, Bangla numerals, Listen on every answer, and hold-to-talk on every input.
6. **Works on a weak network.** The briefing is stored on the phone and opens offline. Voice has a fallback for slow connections (hold to talk, then a text answer read aloud) instead of always needing live streaming.
7. **The farmer owns their memory.** They can see it, edit it and delete it. Nothing is shared with experts or officers without consent, as today.
8. **Cost is controlled.** The briefing is made once a day per farmer on the server and does not count against the farmer's quota. Guests get a briefing built from the rules, without AI.

---

## 5. How it will be built

### 5.1 New pieces

| Piece | What it does | Builds on |
|---|---|---|
| **Farmer profile on the server** | Saves main crop, district, upazila, language and the crop plan in Firestore, moving them from browser storage on first sign-in | Onboarding, `useCropPlan`, `deviceRecordMove.ts` (the same move-once pattern) |
| **Farmer context builder** (`_shared/farmer-context.ts`) | A short summary of the farmer, about 1,500 tokens: profile, active season and stage, plots, last 3 diagnoses and recovery, open tasks, money so far, area warnings, today's rule results, weather and the price for their crop | `farmMemory.ts`, `farmerContext.ts`, `record-facts.ts`, `farm-record-model.ts`, `farm-actions.ts`, `area-model.ts`, `cropCalendars.ts` |
| **Memory** | `users/{uid}/assistant_memory` (facts, each with its source and date) and `users/{uid}/assistant_threads` (conversation, plus a rolling summary) | New Firestore rules (owner only) |
| **Assistant endpoint** (`/api/assistant`) | Gemini Flash-Lite with function calling, harder turns sent to Flash. Read tools run on the server for this farmer only. Write tools return a proposal; the app shows the yes/no card and then saves through the existing services and rules | `ai-proxy.ts` (auth, quota, App Check), the existing write services |
| **Tools** | **Read:** today's weather, week forecast, today's rules, my season, my money, market price, area warnings, find schemes, look up a disease, next calendar step. **Write:** add reminder, log cost, log sale, set sowing date, remember a fact. **Open:** camera diagnosis, dose calculator, profit, expert request (with summary), scheme | `todaySignals`, `marketPrices`, `schemeMatch`, `diseaseKb`, `farmTasks`, `seasons`, `ExpertRequestSeed` |
| **Live with tools** | The server puts the same tool list and the farmer context into the live token. The app runs the tool calls through the same endpoint. Context compression, session resumption and reconnect handling are added | `live-token.ts`, `live-instructions.ts`, `LiveVideoCopilot`, `LiveExpertCall` |
| **Voice for weak networks** | Hold to talk, then speech-to-text, then the text assistant, then a voice answer: on-device where available, Gemini speech otherwise | `speech.ts`, `ListenButton`, `VoiceAmountButton` |
| **Daily briefing job** | Runs at about 05:30 Dhaka time. Works out the facts in code, then Flash-Lite writes 3–4 Bangla sentences as structured output (headline, actions, money line, warning). Saved to `users/{uid}/briefings/{date}`, then a push is sent. The Batch API is used once there are many farmers | `push-daily.ts`, `task-reminders.ts`, `push-send.ts` |
| **Follow-up job** | Questions after a diagnosis, stage nudges and price-move alerts, sent through the same push channel | `farmTasks`, `recoveryLog`, `cropCalendars` |

### 5.2 Existing assistants joined to the new one

- **Crop doctor chat:** gets the farmer context and writes to the shared conversation. The diagnosis itself stays as it is: a photo, a structured answer and the safety gate.
- **Live video and the live voice call:** get the same context, memory and tools.
- **Scheme chat and the market note:** become questions to the assistant ("Am I eligible for…", "Should I sell now?").
- **The three AI functions with no caller:** deleted.

### 5.3 What stays as it is

The rule engine, the dose tables and safety gate, the farm record and score, area warnings, push, the expert system, Full mode and all the existing tools. The assistant uses them; it does not replace them.

---

## 6. Roadmap

As before: one phase per PR, a phone-width check in Bangla and English, tests, and your approval before each merge.

### Phase 8. Foundations (little visible change)
- Live video: turn on context compression and session resumption and handle reconnects (the 2-minute and 10-minute limits). Test a real session on the preview.
- Re-test on the real Gemini key whether 3.8 Flash and Google Search grounding work. Code comments say both were refused, but the docs list them as available.
- Farmer profile on the server, moved over from the phone with no data loss.
- The farmer context builder (server) with tests, and a matching client version.
- Memory and conversation collections, with Firestore rules and tests.
- Apply the Simple/Full tool filter that exists but is never used. Delete the three AI functions with no caller.
- **Done when:** context for a test farmer contains their crop, season stage, money and tasks, and live video runs past 2 minutes.

### Phase 9. The assistant, version 1 (talk and read)
- `/api/assistant` with the read tools, and a conversation screen with the Ask bar, hold-to-talk and Listen.
- An "Ask" tab in the bottom bar, and the Ask bar on Home.
- Crop doctor chat moves into the shared conversation.
- **Done when:** "Can I spray today?", "How much have I spent on potatoes?" and "What's the potato price?" are each answered from tools, in Bangla, with numbers that match the screens.

### Phase 10. Actions
- Write tools with yes/no cards: reminder, cost, sale, sowing date, remember a fact.
- Open tools: dose calculator, profit, expert request with summary, camera.
- A "What I remember" screen in Profile.
- **Done when:** a spoken "I bought urea for 900 taka" ends with a saved cost after one confirmation, and the Firestore rules refuse writes that don't belong to the farmer.

### Phase 11. New Home and the daily briefing
- The Home layout from 3.1, and the 8-tool grid.
- The nightly briefing job, the push notification, the cached card that opens offline, and auto-read with an off switch.
- A rule-built briefing for guests.
- **Done when:** a test farmer receives a correct Bangla briefing at 05:30 that opens offline.

### Phase 12. Live with tools and memory
- Live video and the voice call use the shared tools and memory, and tool calls work during live sessions.
- Live sessions write a summary into the conversation and the farmer's timeline.
- **Done when:** during live video, "remind me to check this in 3 days" creates the reminder after a yes.

### Phase 13. Season coach
- Crop stage tracking from the sowing date, and stage nudges.
- Post-diagnosis follow-ups that feed the recovery log.
- "What to plant" rebuilt with soil, zone risk, prices and history, shown as a simple card.
- An end-of-season summary.

### Phase 14. Money coach
- A profit forecast during the season, and costs compared with benchmarks.
- When to sell, from the price trend, labelled as an estimate. This needs more price data (see 8.4).
- Land and tenure questions so scheme and loan matching works, and a lender-ready view of the farm record.

### Phase 15. Bring back the rest, rebuilt with real data
In order of value, from the audit's top 10:
1. A price strip on Home using the real bulletin.
2. Satellite field health, shown only when real Sentinel data is available.
3. Climate-resilient varieties by upazila at sowing time, with BRRI/BINA sources.
4. Expert alerts, so experts get a push when a new request arrives.
5. A working queue for correction appeals.
6. More price items from a second official source.
7. The buyer and wholesaler directory (parked by you earlier, but part of the original vision).

---

## 7. Cost

These are estimates from the research, using Google's prices as published on 28 November 2026. Recheck them before launch.

| Per active farmer per day | Estimate (USD) |
|---|---|
| Daily briefing text (Flash-Lite) | about 0.001 |
| Briefing read aloud (Gemini speech), or free with the phone's own voice | 0.011–0.034, or 0 |
| 5 assistant turns with tools | 0.015–0.025 |
| 1 photo diagnosis | 0.003–0.010 |
| 2 minutes of live video | about 0.03 |
| **Total** | **about 0.04–0.07 without live video, 0.08–0.12 with** |

Ways to keep this down:
- **Briefing audio:** use the phone's own voice where it has Bangla. Otherwise make the audio once per area and crop stage and share it, instead of once per farmer.
- **Daily caps:** keep them, and keep the app-wide daily cap (`AI_GLOBAL_DAILY_CALL_CAP`).
- **Caching:** cache the farmer context at the start of each prompt.

At 1,000 active farmers a day, this is roughly USD 40–120 a day.

---

## 8. Decisions I need from you

1. **Name.** What should the assistant be called on screen? For example "কৃষি সাথী" (Krishi Sathi) or "এগ্রি সহকারী".
2. **Guests.** Should guests (no sign-in) get the full assistant with a small daily limit, or only the rule-built briefing and crop doctor? The assistant's memory is tied to the account, so a guest who changes phones loses it.
3. **Budget.** Roughly how much can you spend on AI per farmer per month? This sets the daily caps.
4. **More price data.** The government bulletin covers about 12 items. Do you know another reliable source for district prices, especially for vegetables?
5. **Bottom bar.** Is it fine to replace "Weather" with "Ask"? Weather stays on Home and one tap away.
6. **Agronomist review.** This is still pending for doses, spray volumes, crop calendars and cost benchmarks. The assistant will repeat these numbers more often, so their accuracy matters more now.
7. **Order.** Phases 8 → 9 → 10 → 11 is the order I recommend. You could put the briefing (11) before actions (10) if a visible change on Home matters more to you sooner.

---

## 9. What is not in this plan
- The buyer and wholesaler marketplace, which stays parked. Phase 15 lists it last.
- Phone-number (OTP) sign-in, field boundaries on satellite, IoT soil sensors, and grading from live video. All were parked earlier.
- Training our own model. Gemini plus our own rules and data is enough for now.
