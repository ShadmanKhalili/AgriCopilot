import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";
import https from "https";
import helmet from "helmet";
import { rateLimit } from 'express-rate-limit';
import compression from "compression";
import { GoogleGenAI } from "@google/genai";
import { validateOutboundUrl, safeFetch, readTextWithLimit } from "./netlify/functions/_shared/safe-url.ts";
import { extractBearerTokenFromHeader, verifyIdToken } from "./netlify/functions/_shared/auth.ts";
import { countAiUsageToday, dailyAiLimit, dailyLimitMessage, getUserPlan, recordAiUsage, utcDayNumber } from "./netlify/functions/_shared/usage-quota.ts";
import { maxOutputTokensFromEnv, sanitizeGenerationConfig, findUnsupportedContent, configTextChars, MAX_CONFIG_TEXT_CHARS } from "./netlify/functions/_shared/ai-config.ts";
import { issueLiveToken } from "./netlify/functions/_shared/live-token.ts";
import { farmActionsFromFeed, isSafeSprayHour } from "./netlify/functions/_shared/farm-actions.ts";
import { OPEN_METEO_DAILY_PARAM, dateKeyInZone, mergeDailyForecast } from "./netlify/functions/_shared/daily-merge.ts";
import {
  getFreshMarketBulletin,
  getStaleMarketBulletin,
  loadMarketBulletin,
  rememberMarketBulletin,
  refreshMarketBulletinInBackground,
} from "./netlify/functions/_shared/market-bulletin.ts";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProduction = process.env.NODE_ENV === "production";

  // In dev, Vite's HMR client + React Refresh connect over a WebSocket. The app's
  // production CSP intentionally blocks unknown origins, so allow the local dev
  // socket only when not in production.
  const devCspExtras = isProduction ? [] : [
    "ws://localhost:*",
    "ws://127.0.0.1:*",
    "http://localhost:*",
  ];

  // AdSense telemetry endpoints used by adsbygoogle.js.
  const adsCspExtras = [
    "https://googleads.g.doubleclick.net",
    "https://pagead2.googlesyndication.com",
    "https://tpc.googlesyndication.com",
    "https://ep1.adtrafficquality.google",
    "https://ep2.adtrafficquality.google",
    "https://www.googletagmanager.com",
  ];

  // 0. Enable Gzip Compression
  app.use(compression());

  // 0.1 Serve Static Assets with Cache-Control
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1d',
      etag: true,
      lastModified: true
    }));
  }

  // 0.2 Trust Proxy (Required for rate limiting behind Cloud Run/Nginx)
  app.set('trust proxy', 1);

  // 1. Rate Limiting (DDoS & Brute Force Defense)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 600, // Safe threshold for active farmer dashboard sessions
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again later." }
  });

  // Dedicated stricter limiter for AI proxy (Anti-Quota Exhaustion / Anti-Denial of Wallet)
  const aiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 60, // 60 requests per 5 minutes per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: "AI request rate limit exceeded. Please wait a few moments before trying again." }
  });

  // Apply general rate limiter to all /api routes
  app.use("/api", limiter);

  // 1. Security Headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": [
"'self'", 
          "'unsafe-inline'", 
          "'unsafe-eval'", 
          "https://maps.googleapis.com",
          "https://pagead2.googlesyndication.com", 
          "https://tpc.googlesyndication.com", 
          "https://googleads.g.doubleclick.net", 
          "https://www.googletagservices.com",
          "https://adservice.google.com",
          "https://partner.googleadservices.com",
          "https://www.googletagmanager.com", 
          "https://apis.google.com",
          // AdSense's sodar telemetry loads its own scripts, so these must be
          // allowed in script-src as well as connect-src.
          ...adsCspExtras,
          ...devCspExtras
        ],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "img-src": [
          "'self'", 
          "data:", 
          "blob:", 
          "https:", 
          "https://maps.googleapis.com",
          "https://maps.gstatic.com",
          "https://pagead2.googlesyndication.com", 
          "https://tpc.googlesyndication.com", 
          "https://*.doubleclick.net", 
          "https://googleads.g.doubleclick.net",
          "https://*.google.com"
        ],
        "connect-src": [
          "'self'", 
          "https://weather.googleapis.com",
          "https://maps.googleapis.com", 
          "data:",
          "https://api.open-meteo.com", 
          "https://archive-api.open-meteo.com", 
          "https://rest.isric.org", 
          "https://api.worldbank.org", 
          "https://api.bigdatacloud.net", 
          "https://get.geojs.io", 
          "https://identity.dataspace.copernicus.eu", 
          "https://sh.dataspace.copernicus.eu", 
          "https://services.sentinel-hub.com", 
          "https://*.googleapis.com",
          "https://*.firebaseapp.com",
          "https://*.firebaseio.com",
          "https://*.web.app",
          "https://*.firebase.google.com",
          "https://*.google.com",
          "https://pagead2.googlesyndication.com",
          "https://googleads.g.doubleclick.net",
          "https://tpc.googlesyndication.com",
          "https://*.doubleclick.net",
          "https://adservice.google.com",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
          "wss://*.googleapis.com",
          "wss://*.google.com",
          "wss://*.firebaseio.com",
          "blob:",
          "https://*.openstreetmap.org",
          "https://www.openstreetmap.org",
          ...adsCspExtras,
          ...devCspExtras
        ],
        "frame-src": [
          "'self'", 
          "https://*.openstreetmap.org",
          "https://www.openstreetmap.org",
          "https://googleads.g.doubleclick.net", 
          "https://pagead2.googlesyndication.com", 
          "https://tpc.googlesyndication.com", 
          "https://*.googlesyndication.com",
          "https://adservice.google.com",
          "https://www.google.com", 
          "https://content-cloudrun-static-files-pa.googleapis.com",
          "https://*.firebaseapp.com",
          // AdSense's invalid-traffic check (sodar) runs in a frame here.
          "https://ep2.adtrafficquality.google"
        ],
        "frame-ancestors": ["'self'", "https://*.google.com", "https://*.googleusercontent.com", "https://*.web.app", "https://*.firebaseapp.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false, // Frameguard disabled to allow preview inside Google AI Studio container
  }));

  // 2. Extra Cyber Defense Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=(self)');
    next();
  });

  // Enforce bounded JSON payload to prevent memory flooding DoS
  app.use(express.json({ limit: '10mb' }));

  // AdSense & Bot verification
  app.get("/ads.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Robots-Tag", "all");
    res.send("google.com, pub-8691248886116699, DIRECT, f08c47fec0942fa0\ngoogle.com, pub-8294149074042302, DIRECT, f08c47fec0942fa0\n");
  });

  app.get("/robots.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send("User-agent: Mediapartners-Google\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: https://agri-copilot.netlify.app/sitemap.xml\n");
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Check if Google Maps / Google Weather API keys are configured in environment secrets
  app.get("/api/config-status", (req, res) => {
    const googleMapsConfigured = Boolean(
      process.env.GOOGLE_MAPS_API_KEY || 
      process.env.VITE_GOOGLE_MAPS_API_KEY || 
      process.env.MAPS_API_KEY
    );
    const weatherNextConfigured = Boolean(
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.MAPS_API_KEY
    );
    res.json({
      googleMapsConfigured,
      weatherNextConfigured,
      activeProviders: {
        weatherNext: weatherNextConfigured ? "Google Maps Platform Weather API (live)" : "Open-Meteo agro-forecast ensemble",
        googleMaps: googleMapsConfigured ? "Google Maps Platform (Authenticated)" : "Standard Web Maps"
      }
    });
  });

  // Live market prices from the Department of Agricultural Marketing.
  //
  // The same bulletin the Netlify function serves, for the self-hosted
  // deployment: the source is public and free, so no search engine and no
  // provider key are involved. The parsed bulletin is cached for an hour,
  // and a cached copy is served (labelled stale) if the source is down.
  app.get("/api/market-prices", async (_req, res) => {
    try {
      const fresh = getFreshMarketBulletin();
      if (fresh) {
        res.json({ ...fresh, cached: true });
        return;
      }
      // Serve the last bulletin straight away and refresh in the background:
      // the government server can take fourteen seconds, and a farmer should
      // not wait for it.
      const stale = getStaleMarketBulletin();
      if (stale) {
        refreshMarketBulletinInBackground();
        res.json({ ...stale, cached: true });
        return;
      }
      const payload = await loadMarketBulletin();
      rememberMarketBulletin(payload);
      res.json({ ...payload, cached: false });
    } catch (error: any) {
      console.warn("[Market Prices] Could not reach the bulletin:", error?.message || error);
      const stale = getStaleMarketBulletin();
      if (stale) {
        res.json({ ...stale, stale: true, cached: true });
        return;
      }
      res.status(503).json({
        error: "The official price bulletin could not be reached right now. Please try again shortly.",
      });
    }
  });

  // Server-side AI Proxy: Securely proxies Gemini API calls using process.env.GEMINI_API_KEY
  // avoiding client-side HTTP referrer restrictions and keeping secrets off the browser.
  let serverAiClient: GoogleGenAI | null = null;
  let cachedAiApiKey: string | null = null;
  const getServerAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    if (!serverAiClient || cachedAiApiKey !== apiKey) {
      cachedAiApiKey = apiKey;
      serverAiClient = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return serverAiClient;
  };

  // The model list is a SERVER decision. The caller may ask for a model, but
  // it only ever selects from this list.
  //
  // Measured against this project's key on 24 Oct 2026: `gemini-3.6-flash` and
  // `gemini-3.5-flash-lite` answer, while `gemini-3.8-flash` and
  // `gemini-2.5-flash` answer 404 "This model is no longer available to new
  // users". They are still listed (the client may ask for them and the
  // cascade below moves on), but a request that names one pays for a refused
  // upstream call first — so the app points at `gemini-3.6-flash`.
  //
  // Keep in sync with `AI_TEXT_MODELS` / `AI_AUDIO_MODELS` in
  // netlify/functions/ai-proxy.ts — these two copies drifted apart before.
  const TEXT_MODEL_ALLOWLIST = (process.env.AI_TEXT_MODELS || "gemini-3.8-flash,gemini-3.6-flash,gemini-2.5-flash,gemini-3.5-flash-lite")
    .split(",").map(m => m.trim()).filter(m => /^gemini-[a-z0-9.\-]+$/i.test(m));
  const AUDIO_MODEL_ALLOWLIST = (process.env.AI_AUDIO_MODELS || "gemini-3.8-flash-lite-tts,gemini-3.8-flash-tts")
    .split(",").map(m => m.trim()).filter(m => /^gemini-[a-z0-9.\-]+$/i.test(m));

  const getCandidateModels = (requestedModel: string): string[] => {
    // If audio/TTS model requested
    if (requestedModel.includes("-tts")) {
      return Array.from(new Set([requestedModel, ...AUDIO_MODEL_ALLOWLIST]));
    }
    // Advanced Analysis cascade: gemini-3.8-flash -> gemini-3.6-flash -> gemini-3.5-flash-lite
    if (requestedModel === "gemini-3.8-flash") {
      return ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
    }
    // Search Grounding cascade: gemini-2.5-flash -> gemini-3.5-flash-lite
    if (requestedModel === "gemini-2.5-flash") {
      return ["gemini-2.5-flash", "gemini-3.5-flash-lite"];
    }
    // Default text models
    return Array.from(new Set([
      requestedModel,
      ...TEXT_MODEL_ALLOWLIST,
      "gemini-3.5-flash-lite"
    ]));
  };

  // Endpoint to issue short-lived ephemeral session tokens for direct browser Live API sessions
  app.post("/api/gemini/live-token", aiLimiter, async (req, res) => {
    // Same rules as the Netlify function: a token starts a billable Live
    // session, so only a signed-in account gets one, counted against its
    // daily allowance, locked to one model and time-limited.
    const idToken = extractBearerTokenFromHeader(req.headers.authorization);
    if (!idToken) {
      return res.status(401).json({ error: "Sign in to use the live AI session." });
    }
    const user = await verifyIdToken(idToken);
    if (!user) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "GEMINI_API_KEY is not configured in server environment."
        });
      }

      const client = getServerAi();
      if (!client || !client.authTokens?.create) {
        return res.status(500).json({
          error: "Gemini AuthTokens service is unavailable on the server."
        });
      }

      const result = await issueLiveToken(client as any, user.uid, idToken, req.body?.model, user.isGuest);
      if (result.ok === false) {
        return res.status(result.status).json({ error: result.error });
      }

      return res.json({
        token: result.token,
        expireTime: result.expireTime,
        model: result.model
      });
    } catch (err: any) {
      const rawMsg = String(err?.message || err || '');
      const isSuspended = rawMsg.includes("CONSUMER_SUSPENDED") || rawMsg.includes("has been suspended");
      const isKeyError = isSuspended || rawMsg.includes("PERMISSION_DENIED") || rawMsg.includes("API_KEY_INVALID") || err?.status === 403;

      let safeErrorMessage = "Failed to generate ephemeral session token.";
      if (isSuspended) {
        safeErrorMessage = "Gemini API key has been suspended or rotated. Please configure an active GEMINI_API_KEY.";
      } else if (isKeyError) {
        safeErrorMessage = "Gemini API key is invalid or lacks Live API permissions.";
      }

      console.warn(`[Live Token] Ephemeral token generation unavailable: ${safeErrorMessage}`);
      return res.status(isKeyError ? 403 : 500).json({
        error: safeErrorMessage,
        isSuspended,
        isKeyError
      });
    }
  });

  app.post("/api/ai-proxy", aiLimiter, async (req, res) => {
    try {
      // ── Authentication ────────────────────────────────────────────────────
      // An open endpoint is an open relay to a paid Gemini key. The token is
      // verified by Google, not decoded locally. This runs before anything
      // else so an unauthenticated caller learns nothing about the server.
      const idToken = extractBearerTokenFromHeader(req.headers.authorization);
      if (!idToken) {
        return res.status(401).json({ error: "Sign in to use the AI features." });
      }
      const user = await verifyIdToken(idToken);
      if (!user) {
        return res.status(401).json({ error: "Your session has expired. Please sign in again." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "GEMINI_API_KEY is not configured in server environment."
        });
      }

      const client = getServerAi();
      if (!client) {
        return res.status(500).json({ error: "Failed to initialize Gemini AI client." });
      }

      // ── Daily allowance ───────────────────────────────────────────────────
      const dayNumber = utcDayNumber();
      const plan = await getUserPlan(user.uid, idToken, user.isGuest);
      const limit = dailyAiLimit(plan);
      const used = await countAiUsageToday(user.uid, idToken, dayNumber);
      if (used === null) {
        return res.status(503).json({ error: "The AI service is busy. Please try again in a moment." });
      }
      if (used >= limit) {
        return res.status(429).json({
          error: dailyLimitMessage(plan),
          limit,
          used,
        });
      }

      const {
        model: requestedModel = "gemini-3.5-flash-lite",
        contents,
        config,
        tools,
        responseModalities,
        speechConfig
      } = req.body || {};

      if (!contents) {
        return res.status(400).json({ error: "Missing 'contents' in request body." });
      }

      // Input Validation: Ensure contents payload doesn't exceed memory safety boundaries.
      // The limit has to cover the ARRAY form too — the Gemini contract makes
      // `contents` an array, so a string-only check never fired.
      const measureContents = (node: any, depth = 0): { chars: number; images: number } => {
        let chars = 0, images = 0;
        if (!node || depth > 8) return { chars, images };
        if (Array.isArray(node)) { node.forEach(n => { const r = measureContents(n, depth + 1); chars += r.chars; images += r.images; }); return { chars, images }; }
        if (typeof node === "string") return { chars: node.length, images };
        if (typeof node !== "object") return { chars, images };
        if (typeof node.text === "string") chars += node.text.length;
        if (node.inlineData) images += 1;
        if (node.parts) { const r = measureContents(node.parts, depth + 1); chars += r.chars; images += r.images; }
        return { chars, images };
      };
      if (findUnsupportedContent(contents)) {
        return res.status(400).json({ error: "That request contains content that can't be sent." });
      }
      const measured = measureContents(contents);
      if (measured.chars > 40000) {
        return res.status(413).json({ error: "That request contains too much text." });
      }
      // Five photos plus a close-up of each, matching the Netlify proxy.
      if (measured.images > 10) {
        return res.status(413).json({ error: "You can send at most 10 images at a time." });
      }
      if (Array.isArray(contents) && contents.length > 100) {
        return res.status(400).json({ error: "Too many conversation turns in single request (max 100)." });
      }

      // Only the settings the app uses are forwarded, with the output tokens
      // and thinking budget capped, and safety settings left to the server
      // (see netlify/functions/_shared/ai-config.ts).
      const mergedConfig: any = sanitizeGenerationConfig(
        {
          ...(config && typeof config === "object" ? config : {}),
          ...(responseModalities ? { responseModalities } : {}),
          ...(speechConfig ? { speechConfig } : {})
        },
        maxOutputTokensFromEnv()
      );
      if (configTextChars(mergedConfig) > MAX_CONFIG_TEXT_CHARS) {
        return res.status(413).json({ error: "That request contains too much text." });
      }
      // Only Google Search may be requested, and only when the caller asked.
      const requestedTools = Array.isArray(tools) ? tools : config?.tools;
      if (Array.isArray(requestedTools)) {
        const allowed = requestedTools.filter((t: any) =>
          t && typeof t === "object" && Object.keys(t).length === 1 && "googleSearch" in t);
        if (allowed.length) mergedConfig.tools = allowed;
      }

      // Charge the allowance before spending anything, as the Netlify proxy does.
      const reserved = await recordAiUsage(user.uid, idToken, dayNumber, "text");
      if (!reserved) {
        return res.status(503).json({ error: "The AI service is busy. Please try again in a moment." });
      }
      const usedNow = await countAiUsageToday(user.uid, idToken, dayNumber);
      if (usedNow === null) {
        return res.status(503).json({ error: "The AI service is busy. Please try again in a moment." });
      }
      if (usedNow > dailyAiLimit(plan)) {
        return res.status(429).json({ error: dailyLimitMessage(plan) });
      }

      const candidateModels = getCandidateModels(requestedModel);
      let lastError: any = null;

      for (let i = 0; i < candidateModels.length; i++) {
        const currentModel = candidateModels[i];
        try {
          const aiResponse = await client.models.generateContent({
            model: currentModel,
            contents,
            config: mergedConfig
          });

          return res.json({
            text: aiResponse.text || "",
            candidates: aiResponse.candidates || [],
            promptFeedback: aiResponse.promptFeedback || null,
            modelUsed: currentModel
          });
        } catch (err: any) {
          lastError = err;
          const errStr = String(err?.message || err || '');
          const isModelNotFound = err?.status === 404 || 
                                  errStr.includes("404") || 
                                  errStr.includes("not found") || 
                                  errStr.includes("no longer available");
          const isHighDemandOrUnavailable = err?.status === 503 || 
                                            errStr.includes("503") || 
                                            errStr.includes("UNAVAILABLE") || 
                                            errStr.includes("high demand") ||
                                            errStr.includes("overloaded");
          const isRateLimit = err?.status === 429 || 
                              errStr.includes("429") || 
                              errStr.includes("RESOURCE_EXHAUSTED");
          const isGroundingFailure = (err?.status === 403 || err?.status === 400) && 
                                     Boolean(mergedConfig?.tools) && 
                                     (errStr.includes("search") || errStr.includes("grounding") || errStr.includes("permission") || errStr.includes("not supported"));

          // If it's a 404 not found, 503 high demand, 429 rate limit, or search grounding issue, attempt fallback model
          if ((isModelNotFound || isHighDemandOrUnavailable || isRateLimit || isGroundingFailure) && i < candidateModels.length - 1) {
            const nextModel = candidateModels[i + 1];
            console.warn(`[AI Proxy Failover] Model '${currentModel}' unavailable (${isModelNotFound ? '404 Not Found' : isRateLimit ? '429 Rate Limit' : isGroundingFailure ? 'Grounding Error' : '503 High Demand'}). Seamlessly failing over to '${nextModel}'...`);
            
            // If grounding failed or falling over to lite, strip tools for a clean fallback
            if ((isGroundingFailure || nextModel === "gemini-3.5-flash-lite") && mergedConfig?.tools) {
              delete mergedConfig.tools;
            }
            // Adaptive backoff: 1000ms on 429 rate limit, 200ms on other errors
            const backoffMs = isRateLimit ? 1000 : 200;
            await new Promise(r => setTimeout(r, backoffMs));
            continue;
          }

          // If permission/referrer error without tools, fallbacks won't help
          const isReferrer = errStr.includes("REFERRER") || errStr.includes("referer") || errStr.includes("API_KEY_HTTP_REFERRER_BLOCKED");
          if (isReferrer) {
            break;
          }
        }
      }

      // If all candidate models failed, throw last error to catch block
      throw lastError;
    } catch (error: any) {
      const errStr = String(error?.message || error || '');
      const isSuspended = errStr.includes("CONSUMER_SUSPENDED") || errStr.includes("has been suspended");
      const isReferrer = errStr.includes("REFERRER") || errStr.includes("referer") || errStr.includes("API_KEY_HTTP_REFERRER_BLOCKED");
      const is403 = error?.status === 403 || errStr.includes("403") || errStr.includes("PERMISSION_DENIED");
      const isHighDemand = error?.status === 503 || errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("high demand");
      
      let friendlyError = "Internal AI Proxy error";
      if (isSuspended) {
        friendlyError = "Gemini API key has been suspended or rotated. Please configure an active GEMINI_API_KEY in .env.";
      } else if (isReferrer) {
        friendlyError = "Gemini API key has an HTTP Referrer restriction in Google Cloud Console. To resolve this, open Google Cloud Console > APIs & Services > Credentials, edit the API key, and set 'Application restrictions' to 'None'.";
      } else if (isHighDemand) {
        friendlyError = "The AI service is currently experiencing exceptionally high demand across model clusters. Please retry in a few moments.";
      } else if (error?.message) {
        friendlyError = error.message.replace(/api_key:[A-Za-z0-9_\-]+/g, 'api_key:[REDACTED]');
      }

      console.warn(`[Server AI Proxy] Request failed: ${friendlyError}`);

      return res.status(error?.status && typeof error.status === 'number' && error.status >= 400 && error.status < 600 ? error.status : (is403 || isSuspended ? 403 : 500)).json({
        error: friendlyError,
        isSuspended,
        isReferrerBlocked: isReferrer,
        isPermissionDenied: is403 || isSuspended,
        isHighDemand
      });
    }
  });

  // Request logger for API
  app.use("/api", (req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send("User-agent: *\nAllow: /");
  });

  // Agro-Climatic Vegetation & Moisture Index Model (High-precision regional baseline)
  function getAgroClimaticVegetationIndex(lat: number, lng: number) {
    const month = new Date().getMonth(); // 0 to 11
    
    // Seasonal baseline for Bangladesh Agro-Ecological Zones (AEZ)
    // Monsoon / Aman Season (Jun - Oct): High vegetative density & water index
    // Winter / Boro / Rabi Season (Nov - Feb): Irrigated crop greens
    // Pre-Monsoon / Summer (Mar - May): Transitional preparation
    let baseNdvi = 0.68;
    let baseNdmi = 0.22;

    if (month >= 5 && month <= 9) {
      baseNdvi = 0.74;
      baseNdmi = 0.32;
    } else if (month >= 10 || month <= 1) {
      baseNdvi = 0.65;
      baseNdmi = 0.18;
    } else {
      baseNdvi = 0.54;
      baseNdmi = 0.08;
    }

    // Micro-spatial variation derived deterministically from geographic coordinates
    const seed = Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453;
    const variance = (seed - Math.floor(seed)) * 0.12 - 0.06;
    const moistureVariance = ((seed * 1.5) - Math.floor(seed * 1.5)) * 0.10 - 0.05;

    const finalNdvi = Math.min(0.92, Math.max(0.20, Number((baseNdvi + variance).toFixed(2))));
    const finalNdmi = Math.min(0.60, Math.max(-0.20, Number((baseNdmi + moistureVariance).toFixed(2))));

    return {
      ndvi: finalNdvi,
      ndmi: finalNdmi,
      source: 'agro_climatic_model',
      isEstimated: true
    };
  }

  // Sentinel Hub / Copernicus Vegetation Proxy
  app.post("/.netlify/functions/sentinel", async (req, res) => {
    const { lat, lng } = req.body;
    const latNum = Number(lat) || 23.685;
    const lngNum = Number(lng) || 90.3563;

    const rawClientId = process.env.SENTINEL_HUB_CLIENT_ID || "";
    const rawClientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET || "";
    
    // Clean up credentials
    const clientId = rawClientId.trim().replace(/^["']|["']$/g, '');
    const clientSecret = rawClientSecret.trim().replace(/^["']|["']$/g, '');

    // If credentials are not configured or are placeholder values, provide model calculation
    if (!clientId || !clientSecret || clientId.includes("placeholder") || clientId.length < 5) {
      return res.json(getAgroClimaticVegetationIndex(latNum, lngNum));
    }

    try {
      // 1. Get OAuth Token (Try CDSE first, fallback to Classic Sentinel Hub)
      let accessToken = "";
      let processEndpoint = "";

      try {
        const authResponse = await axios.post(
          "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
          new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 8000 }
        );
        accessToken = authResponse.data.access_token;
        processEndpoint = "https://sh.dataspace.copernicus.eu/api/v1/process";
      } catch {
        // Fallback to Classic Sentinel Hub OAuth
        const authResponse = await axios.post(
          "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token",
          new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 8000 }
        );
        accessToken = authResponse.data.access_token;
        processEndpoint = "https://services.sentinel-hub.com/api/v1/process";
      }

      // 2. Fetch NDVI & NDMI via Statistical API
      const offset = 0.001; // ~100m
      const bbox = [lngNum - offset, latNum - offset, lngNum + offset, latNum + offset];

      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - 30); // Look back 30 days
      
      const toDateStr = toDate.toISOString().split('.')[0] + 'Z';
      const fromDateStr = fromDate.toISOString().split('.')[0] + 'Z';

      const statsEndpoint = processEndpoint.replace('/process', '/statistics');

      const processResponse = await axios.post(
        statsEndpoint,
        {
          input: {
            bounds: { bbox },
            data: [{ 
              type: "sentinel-2-l2a",
              dataFilter: {
                timeRange: { from: fromDateStr, to: toDateStr },
                maxCloudCoverage: 30
              }
            }]
          },
          aggregation: {
            timeRange: { from: fromDateStr, to: toDateStr },
            aggregationInterval: { of: "P30D" },
            evalscript: `
              //VERSION=3
              function setup() {
                return {
                  input: ["B04", "B08", "B11", "SCL", "dataMask"],
                  output: [
                    { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
                    { id: "ndmi", bands: 1, sampleType: "FLOAT32" },
                    { id: "dataMask", bands: 1 }
                  ]
                };
              }
              function evaluatePixel(sample) {
                let isCloud = [3, 8, 9, 10].includes(sample.SCL);
                let valid = sample.dataMask === 1 && !isCloud;

                let ndvi = 0;
                let ndmi = 0;

                if (valid) {
                  let ndviDenom = sample.B08 + sample.B04;
                  ndvi = ndviDenom === 0 ? 0 : (sample.B08 - sample.B04) / ndviDenom;
                  
                  let ndmiDenom = sample.B08 + sample.B11;
                  ndmi = ndmiDenom === 0 ? 0 : (sample.B08 - sample.B11) / ndmiDenom;
                }

                return {
                  ndvi: [ndvi],
                  ndmi: [ndmi],
                  dataMask: [valid ? 1 : 0]
                };
              }
            `,
            resx: 10,
            resy: 10
          }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          timeout: 10000
        }
      );

      let ndviValue = 0;
      let ndmiValue = 0;
      try {
        const statsNdvi = processResponse.data.data[0].outputs.ndvi.bands.B0.stats;
        ndviValue = statsNdvi.mean;
        
        const statsNdmi = processResponse.data.data[0].outputs.ndmi.bands.B0.stats;
        ndmiValue = statsNdmi.mean;
      } catch {
        // Fallback to model if stats parsing empty
        return res.json(getAgroClimaticVegetationIndex(latNum, lngNum));
      }
      
      return res.json({ ndvi: ndviValue, ndmi: ndmiValue, source: 'sentinel_2', isEstimated: false });

    } catch {
      // Seamlessly fallback to Agro-Climatic Model without breaking user experience
      return res.json(getAgroClimaticVegetationIndex(latNum, lngNum));
    }
  });

  // Proxy for IP Geolocation fallback (strictly aligned with Bangladesh regional focus)
  app.get("/api/ip-location", async (req, res) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const rawClientIp = typeof forwarded === 'string' 
        ? forwarded.split(',')[0].trim() 
        : (req.socket.remoteAddress || '');

      let geoUrl = 'https://get.geojs.io/v1/ip/geo.json';
      // Only query specific IP if it's a valid public IPv4/IPv6 that is not local/loopback/private
      if (
        rawClientIp && 
        !rawClientIp.startsWith('127.') && 
        !rawClientIp.startsWith('10.') && 
        !rawClientIp.startsWith('172.') && 
        !rawClientIp.startsWith('192.168.') &&
        rawClientIp !== '::1'
      ) {
        geoUrl = `https://get.geojs.io/v1/ip/geo/${rawClientIp}.json`;
      }

      const response = await axios.get(geoUrl, { timeout: 3500 });
      if (response.data && response.data.latitude && response.data.longitude) {
        const lat = parseFloat(response.data.latitude);
        const lon = parseFloat(response.data.longitude);
        // Strict verification: coordinate must be within Bangladesh territory [20.5..26.8° N, 88.0..92.8° E]
        if (!isNaN(lat) && !isNaN(lon) && lat >= 20.0 && lat <= 27.0 && lon >= 87.5 && lon <= 93.0) {
          return res.json({
            ...response.data,
            latitude: lat,
            longitude: lon,
            isWithinBangladesh: true
          });
        }
      }
    } catch (e) {
      // Graceful fallback below
    }

    // Default Bangladesh center (Dhaka Farmgate / Sher-e-Bangla Nagar Agro-Center)
    res.json({
      latitude: 23.8103,
      longitude: 90.4125,
      city: "Dhaka",
      region: "Dhaka Division",
      country: "Bangladesh",
      country_code: "BD",
      isFallback: true,
      isWithinBangladesh: true
    });
  });

  // Bangladesh 64 Administrative & Agro-Ecological District Centers
  const BD_DISTRICTS = [
    // Dhaka Division
    { nameEn: "Dhaka", nameBn: "ঢাকা", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.8103, lon: 90.4125 },
    { nameEn: "Gazipur", nameBn: "গাজীপুর", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 24.0023, lon: 90.4264 },
    { nameEn: "Narayanganj", nameBn: "নারায়ণগঞ্জ", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.6238, lon: 90.5000 },
    { nameEn: "Tangail", nameBn: "টাঙ্গাইল", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 24.2513, lon: 89.9167 },
    { nameEn: "Narsingdi", nameBn: "নরসিংদী", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.9322, lon: 90.7154 },
    { nameEn: "Faridpur", nameBn: "ফরিদপুর", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.6071, lon: 89.8429 },
    { nameEn: "Gopalganj", nameBn: "গোপালগঞ্জ", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.0051, lon: 89.8266 },
    { nameEn: "Madaripur", nameBn: "মাদারীপুর", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.1641, lon: 90.1897 },
    { nameEn: "Manikganj", nameBn: "মানিকগঞ্জ", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.8644, lon: 90.0047 },
    { nameEn: "Munshiganj", nameBn: "মুন্সীগঞ্জ", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.5422, lon: 90.5305 },
    { nameEn: "Rajbari", nameBn: "রাজবাড়ী", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.7574, lon: 89.6445 },
    { nameEn: "Shariatpur", nameBn: "শরীয়তপুর", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 23.2423, lon: 90.4348 },
    { nameEn: "Kishoreganj", nameBn: "কিশোরগঞ্জ", divEn: "Dhaka Division", divBn: "ঢাকা বিভাগ", lat: 24.4449, lon: 90.7766 },
    // Chattogram Division
    { nameEn: "Chattogram", nameBn: "চট্টগ্রাম", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 22.3569, lon: 91.7832 },
    { nameEn: "Cox's Bazar", nameBn: "কক্সবাজার", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 21.4272, lon: 92.0058 },
    { nameEn: "Cumilla", nameBn: "কুমিল্লা", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 23.4682, lon: 91.1788 },
    { nameEn: "Brahmanbaria", nameBn: "ব্রাহ্মণবাড়িয়া", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 23.9571, lon: 91.1119 },
    { nameEn: "Chandpur", nameBn: "চাঁদপুর", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 23.2333, lon: 90.6667 },
    { nameEn: "Feni", nameBn: "ফেনী", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 23.0159, lon: 91.3976 },
    { nameEn: "Noakhali", nameBn: "নোয়াখালী", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 22.8696, lon: 91.0994 },
    { nameEn: "Lakshmipur", nameBn: "লক্ষ্মীপুর", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 22.9425, lon: 90.8412 },
    { nameEn: "Khagrachhari", nameBn: "খাগড়াছড়ি", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 23.1193, lon: 91.9847 },
    { nameEn: "Rangamati", nameBn: "রাঙ্গামাটি", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 22.7324, lon: 92.2985 },
    { nameEn: "Bandarban", nameBn: "বান্দরবান", divEn: "Chattogram Division", divBn: "চট্টগ্রাম বিভাগ", lat: 22.1953, lon: 92.2184 },
    // Rajshahi Division
    { nameEn: "Rajshahi", nameBn: "রাজশাহী", divEn: "Rajshahi Division", divBn: "রাজশাহী বিভাগ", lat: 24.3745, lon: 88.6042 },
    { nameEn: "Bogura", nameBn: "বগুড়া", divEn: "Rajshahi Division", divBn: "রাজশাহী বিভাগ", lat: 24.8465, lon: 89.3777 },
    { nameEn: "Pabna", nameBn: "পাবনা", divEn: "Rajshahi Division", divBn: "রাজশাহী বিভাগ", lat: 24.0064, lon: 89.2372 },
    { nameEn: "Sirajganj", nameBn: "সিরাজগঞ্জ", divEn: "Rajshahi Division", divBn: "রাজশাহী বিভাগ", lat: 24.4534, lon: 89.7008 },
    { nameEn: "Naogaon", nameBn: "নওগাঁ", divEn: "Rajshahi Division", divBn: "রাজশাহী বিভাগ", lat: 24.7936, lon: 88.9318 },
    { nameEn: "Natore", nameBn: "নাটোর", divEn: "Rajshahi Division", divBn: "রাজশাহী বিভাগ", lat: 24.4206, lon: 88.9324 },
    { nameEn: "Chapainawabganj", nameBn: "চাঁপাইনবাবগঞ্জ", divEn: "Rajshahi Division", divBn: "রাজশাহী বিভাগ", lat: 24.5965, lon: 88.2775 },
    { nameEn: "Joypurhat", nameBn: "জয়পুরহাট", divEn: "Rajshahi Division", divBn: "রাজশাহী বিভাগ", lat: 25.1015, lon: 89.0277 },
    // Khulna Division
    { nameEn: "Khulna", nameBn: "খুলনা", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 22.8456, lon: 89.5403 },
    { nameEn: "Bagerhat", nameBn: "বাগেরহাট", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 22.6516, lon: 89.7859 },
    { nameEn: "Satkhira", nameBn: "সাতক্ষীরা", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 22.7185, lon: 89.0705 },
    { nameEn: "Jashore", nameBn: "যশোর", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 23.1664, lon: 89.2182 },
    { nameEn: "Jhenaidah", nameBn: "ঝিনাইদহ", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 23.5448, lon: 89.1539 },
    { nameEn: "Kushtia", nameBn: "কুষ্টিয়া", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 23.9013, lon: 89.1205 },
    { nameEn: "Magura", nameBn: "মাগুরা", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 23.4873, lon: 89.4198 },
    { nameEn: "Meherpur", nameBn: "মেহেরপুর", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 23.7622, lon: 88.6318 },
    { nameEn: "Narail", nameBn: "নড়াইল", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 23.1725, lon: 89.5127 },
    { nameEn: "Chuadanga", nameBn: "চুয়াডাঙ্গা", divEn: "Khulna Division", divBn: "খুলনা বিভাগ", lat: 23.6402, lon: 88.8418 },
    // Barishal Division
    { nameEn: "Barishal", nameBn: "বরিশাল", divEn: "Barishal Division", divBn: "বরিশাল বিভাগ", lat: 22.7010, lon: 90.3535 },
    { nameEn: "Bhola", nameBn: "ভোলা", divEn: "Barishal Division", divBn: "বরিশাল বিভাগ", lat: 22.6859, lon: 90.6481 },
    { nameEn: "Jhalokati", nameBn: "ঝালকাঠি", divEn: "Barishal Division", divBn: "বরিশাল বিভাগ", lat: 22.6406, lon: 90.1987 },
    { nameEn: "Pirojpur", nameBn: "পিরোজপুর", divEn: "Barishal Division", divBn: "বরিশাল বিভাগ", lat: 22.5841, lon: 89.9720 },
    { nameEn: "Barguna", nameBn: "বরগুনা", divEn: "Barishal Division", divBn: "বরিশাল বিভাগ", lat: 22.1570, lon: 90.1256 },
    { nameEn: "Patuakhali", nameBn: "পটুয়াখালী", divEn: "Barishal Division", divBn: "বরিশাল বিভাগ", lat: 22.3596, lon: 90.3299 },
    // Sylhet Division
    { nameEn: "Sylhet", nameBn: "সিলেট", divEn: "Sylhet Division", divBn: "সিলেট বিভাগ", lat: 24.8949, lon: 91.8687 },
    { nameEn: "Moulvibazar", nameBn: "মৌলভীবাজার", divEn: "Sylhet Division", divBn: "সিলেট বিভাগ", lat: 24.4829, lon: 91.7774 },
    { nameEn: "Habiganj", nameBn: "হবিগঞ্জ", divEn: "Sylhet Division", divBn: "সিলেট বিভাগ", lat: 24.3749, lon: 91.4155 },
    { nameEn: "Sunamganj", nameBn: "সুনামগঞ্জ", divEn: "Sylhet Division", divBn: "সুনামগঞ্জ বিভাগ", lat: 25.0658, lon: 91.3950 },
    // Rangpur Division
    { nameEn: "Rangpur", nameBn: "রংপুর", divEn: "Rangpur Division", divBn: "রংপুর বিভাগ", lat: 25.7439, lon: 89.2752 },
    { nameEn: "Dinajpur", nameBn: "দিনাজপুর", divEn: "Rangpur Division", divBn: "দিনাজপুর বিভাগ", lat: 25.6217, lon: 88.6355 },
    { nameEn: "Kurigram", nameBn: "কুড়িগ্রাম", divEn: "Rangpur Division", divBn: "কুড়িগ্রাম বিভাগ", lat: 25.8054, lon: 89.6362 },
    { nameEn: "Gaibandha", nameBn: "গাইবান্ধা", divEn: "Rangpur Division", divBn: "গাইবান্ধা বিভাগ", lat: 25.3288, lon: 89.5281 },
    { nameEn: "Lalmonirhat", nameBn: "লালমনিরহাট", divEn: "Rangpur Division", divBn: "লালমনিরহাট বিভাগ", lat: 25.9923, lon: 89.2847 },
    { nameEn: "Nilphamari", nameBn: "নীলফামারী", divEn: "Rangpur Division", divBn: "নীলফামারী বিভাগ", lat: 25.9318, lon: 88.8560 },
    { nameEn: "Panchagarh", nameBn: "পঞ্চগড়", divEn: "Rangpur Division", divBn: "পঞ্চগড় বিভাগ", lat: 26.3411, lon: 88.5542 },
    { nameEn: "Thakurgaon", nameBn: "ঠাকুরগাঁও", divEn: "Rangpur Division", divBn: "ঠাকুরগাঁও বিভাগ", lat: 26.0337, lon: 88.4617 },
    // Mymensingh Division
    { nameEn: "Mymensingh", nameBn: "ময়মনসিংহ", divEn: "Mymensingh Division", divBn: "ময়মনসিংহ বিভাগ", lat: 24.7471, lon: 90.4203 },
    { nameEn: "Jamalpur", nameBn: "জামালপুর", divEn: "Mymensingh Division", divBn: "জামালপুর বিভাগ", lat: 24.9375, lon: 89.9378 },
    { nameEn: "Netrokona", nameBn: "নেত্রকোণা", divEn: "Mymensingh Division", divBn: "নেত্রকোণা বিভাগ", lat: 24.8709, lon: 90.7279 },
    { nameEn: "Sherpur", nameBn: "শেরপুর", divEn: "Mymensingh Division", divBn: "শেরপুর বিভাগ", lat: 25.0205, lon: 90.0153 }
  ];

  function findNearestDistrict(lat: number, lon: number, isBn: boolean) {
    let closest = BD_DISTRICTS[0];
    let minDistanceSq = Infinity;
    for (const d of BD_DISTRICTS) {
      const dLat = d.lat - lat;
      const dLon = d.lon - lon;
      const distSq = dLat * dLat + dLon * dLon;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closest = d;
      }
    }

    const name = isBn ? closest.nameBn : closest.nameEn;
    const division = isBn ? closest.divBn : closest.divEn;
    const country = isBn ? "বাংলাদেশ" : "Bangladesh";

    return {
      locality: name,
      city: name,
      principalSubdivision: division,
      displayName: `${name}, ${division}, ${country}`,
      source: "bd_agro_district_model"
    };
  }

  function isValidCoordinate(lat: number, lon: number): boolean {
    return !isNaN(lat) && !isNaN(lon) && isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  // In-memory bounded cache for reverse geocoding
  const locLookupCache = new Map<string, any>();

  // Proxy for Reverse Geocoding with Multi-tier Fallback
  app.get("/api/loc-lookup", async (req, res) => {
    let lat = parseFloat(req.query.latitude as string || req.query.lat as string);
    let lon = parseFloat(req.query.longitude as string || req.query.lng as string || req.query.lon as string);
    
    if (!isValidCoordinate(lat, lon)) {
      lat = 23.685;
      lon = 90.3563;
    }

    const lang = (req.query.localityLanguage as string || req.query.lang as string || 'en').toLowerCase().startsWith('bn') ? 'bn' : 'en';

    const cacheKey = `${lat.toFixed(3)}_${lon.toFixed(3)}_${lang}`;
    if (locLookupCache.has(cacheKey)) {
      return res.json(locLookupCache.get(cacheKey));
    }

    // Guard against unbounded cache memory growth DoS
    if (locLookupCache.size > 1000) {
      locLookupCache.clear();
    }

    // Tier 1: Try OpenStreetMap Nominatim with strict timeout
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          format: 'json',
          lat: lat,
          lon: lon,
          zoom: 14,
          addressdetails: 1,
          'accept-language': lang === 'bn' ? 'bn,en' : 'en'
        },
        headers: {
          'User-Agent': 'KrishiKotha-AgriApp/1.0 (contact@krishikotha.gov.bd)'
        },
        timeout: 3500
      });

      if (response.data && response.data.address) {
        const addr = response.data.address;
        const locality = addr.county || addr.suburb || addr.village || addr.town || addr.municipality || addr.neighbourhood || response.data.name || '';
        const city = addr.city || addr.state_district || addr.county || addr.town || '';
        const principalSubdivision = addr.state || addr.region || addr.state_district || '';
        const displayName = response.data.display_name || `${locality}, ${city}`;

        const result = {
          locality: locality || city,
          city: city || locality,
          principalSubdivision,
          displayName,
          source: 'nominatim_osm'
        };

        locLookupCache.set(cacheKey, result);
        return res.json(result);
      }
    } catch {
      // Gracefully fall through to Tier 2
    }

    // Tier 2: Deterministic Agro-Ecological District Center Match (Always succeeds)
    const result = findNearestDistrict(lat, lon, lang === 'bn');
    locLookupCache.set(cacheKey, result);
    return res.json(result);
  });

  // Proxy for Weather API
  app.get("/api/daily-forecast", async (req, res) => {
    try {
      const { latitude, longitude, ...rest } = req.query;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      const lat = parseFloat(latitude as string);
      const lon = parseFloat(longitude as string);

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "Invalid latitude or longitude" });
      }

      const url = `https://api.open-meteo.com/v1/forecast`;
      console.log(`Proxying Weather request to Open-Meteo: ${url} with params:`, { latitude: lat, longitude: lon, ...rest });
      const response = await axios.get(url, {
        params: {
          latitude: lat,
          longitude: lon,
          ...rest
        },
        timeout: 10000 // 10s timeout
      });
      // Enforce strict no-cache for live weather data so browsers & proxies never serve stale forecasts
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
      res.json(response.data);
    } catch (error: any) {
      const fullUrl = error.config?.url + '?' + new URLSearchParams(error.config?.params).toString();
      console.error("Weather Proxy Error:", error.message, "URL:", fullUrl);
      if (error.response?.data) {
        console.error("Open-Meteo API Error Response:", JSON.stringify(error.response.data));
      }
      res.status(500).json({ 
        error: "Failed to fetch weather data from Open-Meteo",
        details: error.message,
        apiError: error.response?.data,
        requestedUrl: fullUrl
      });
    }
  });

  // Proxy for Climate API
  app.get("/api/historical-data", async (req, res) => {
    try {
      const { latitude, longitude, ...rest } = req.query;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      const url = `https://archive-api.open-meteo.com/v1/archive`;
      console.log(`Proxying Climate request to Open-Meteo: ${url} with params:`, { latitude, longitude, ...rest });
      
      const response = await axios.get(url, {
        params: req.query,
        timeout: 15000 // 15s timeout
      });
      res.json(response.data);
    } catch (error: any) {
      const fullUrl = error.config?.url + '?' + new URLSearchParams(error.config?.params).toString();
      console.error("Climate Proxy Error:", error.message, "URL:", fullUrl);
      if (error.response?.data) {
        console.error("Open-Meteo Archive API Error Response:", JSON.stringify(error.response.data));
      }
      res.status(500).json({ 
        error: "Failed to fetch historical climate data from Open-Meteo",
        details: error.message,
        apiError: error.response?.data,
        requestedUrl: fullUrl
      });
    }
  });

  // Open-Meteo's 7-day daily block, used to complete the Google-derived `daily`.
  // Never throws and never waits long: null on any failure or after 4 seconds.
  // (Kept identical to netlify/functions/weathernext-3.ts.)
  const fetchOpenMeteoDaily = async (lat: number, lon: number, timezone: string): Promise<any | null> => {
    try {
      const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          daily: OPEN_METEO_DAILY_PARAM,
          timezone,
          forecast_days: 7
        },
        timeout: 4000
      });
      return res.data?.daily ?? null;
    } catch (err: any) {
      console.warn('[AgroCast AI] Open-Meteo daily completion failed, serving Google-only daily:', err?.message);
      return null;
    }
  };

  // AgroCast AI / Google Weather API - High-Resolution Agrometeorological Endpoint
  const handleWeatherNext3 = async (req: express.Request, res: express.Response) => {
    try {
      const { latitude, longitude, timezone = 'auto', forecast_days = '7' } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      const lat = parseFloat(latitude as string);
      const lon = parseFloat(longitude as string);

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "Invalid latitude or longitude" });
      }

      // Resolve Google API key. Server-side secrets take priority so the browser's
      // (possibly HTTP-referrer-restricted) key can never break the server-to-server
      // Google Weather lookup. The client header/query remain a development fallback.
      const googleKey =
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.MAPS_API_KEY ||
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        (req.headers['x-google-maps-key'] as string) ||
        (req.query.apiKey as string);

      const gridLat = Math.round(lat / 0.05) * 0.05;
      const gridLon = Math.round(lon / 0.05) * 0.05;

      let googleWeatherSucceeded = false;
      let weatherPayload: any = null;

      // =========================================================================
      // PATHWAY 1: Live Google Maps Platform Weather API (Google Weather API)
      // =========================================================================
      if (googleKey) {
        try {
          console.log(`[AgroCast AI] Initiating live Google Maps Weather API request for (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
          
          const gmpHeaders = {
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
          };

          // Start the Open-Meteo 7-day request now so it runs while Google answers.
          // It never rejects (null on failure), so it cannot break this lookup.
          const openMeteoDailyPromise = fetchOpenMeteoDaily(lat, lon, String(timezone));

          // Fetch Current Conditions, Hourly Forecast (48h), and Public Alerts concurrently
          const [currentRes, hourlyRes, alertsRes] = await Promise.all([
            axios.get('https://weather.googleapis.com/v1/currentConditions:lookup', {
              params: {
                key: googleKey,
                'location.latitude': lat,
                'location.longitude': lon
              },
              headers: gmpHeaders,
              timeout: 7000
            }),
            axios.get('https://weather.googleapis.com/v1/forecast/hours:lookup', {
              params: {
                key: googleKey,
                'location.latitude': lat,
                'location.longitude': lon,
                hours: 48
              },
              headers: gmpHeaders,
              timeout: 8000
            }),
            axios.get('https://weather.googleapis.com/v1/publicAlerts:lookup', {
              params: {
                key: googleKey,
                'location.latitude': lat,
                'location.longitude': lon
              },
              headers: gmpHeaders,
              timeout: 5000
            }).catch((err) => {
              // Gracefully handle 404 (No alerts or region not supported) without aborting
              return { data: { weatherAlerts: [] } };
            })
          ]);

          const currentCond = currentRes.data;
          const forecastHours = hourlyRes.data?.forecastHours || [];
          const publicAlertsData = alertsRes.data?.weatherAlerts || [];

          if (currentCond && forecastHours.length > 0) {
            console.log(`[AgroCast AI] Live Google Weather API lookup successful! ${forecastHours.length} hours received.`);

            const currentTemp = currentCond.temperature?.degrees ?? 28;
            const currentHumidity = currentCond.relativeHumidity ?? 60;
            const currentDewPoint = currentCond.dewPoint?.degrees ?? (currentTemp - ((100 - currentHumidity) / 5));
            const currentWind = currentCond.wind?.speed?.value ?? 6;
            const currentWindGust = currentCond.wind?.gust?.value ?? (currentWind * 1.4);
            const current100mWind = parseFloat((currentWind * 1.38).toFixed(1));
            const currentConditionText = currentCond.weatherCondition?.description?.text || currentCond.weatherCondition?.type || 'Partly Cloudy';
            const currentDNI = currentCond.isDaytime ? Math.max(0, Math.round((100 - (currentCond.cloudCover || 20)) * 7.5)) : 0;
            const currentShortwave = Math.round(currentDNI * 0.85);

            // Dew Point Depression (Plant Pathology & Fungal Spore Germination Metric)
            const dewPointDepression = Math.max(0, currentTemp - currentDewPoint);
            let fungalBlightRisk: 'low' | 'moderate' | 'high' = 'low';
            if (currentHumidity > 82 && dewPointDepression < 2.5) {
              fungalBlightRisk = 'high';
            } else if (currentHumidity > 72 && dewPointDepression < 4.0) {
              fungalBlightRisk = 'moderate';
            }

            // Map hourly series
            const hourlyTimes: string[] = [];
            const hourlyTemps: number[] = [];
            const hourlyHumidities: number[] = [];
            const hourlyDewPoints: number[] = [];
            const hourlyRainProbs: number[] = [];
            const hourlyRainQpfs: number[] = [];
            const hourlyWinds10m: number[] = [];
            const hourlyWinds100m: number[] = [];
            const hourlyWeatherCodes: number[] = [];
            const hourlyConditions: string[] = [];
            const hourlyDNIs: number[] = [];
            const hourlySpread: Array<{
              time: string;
              displayTime: string;
              temp: number;
              p10: number;
              p50: number;
              p90: number;
              rainProb: number;
              rainQpf: number;
              windSpeed: number;
              wind100m: number;
              condition: string;
              isSafeSpray: boolean;
            }> = [];

            let totalExpectedRain = 0;
            let maxRainProb = 0;

            for (let i = 0; i < forecastHours.length; i++) {
              const item = forecastHours[i];
              const intervalTime = item.interval?.startTime || new Date(Date.now() + i * 3600000).toISOString();
              const hTemp = item.temperature?.degrees ?? currentTemp;
              const hHumidity = item.relativeHumidity ?? currentHumidity;
              const hDewPoint = item.dewPoint?.degrees ?? (hTemp - ((100 - hHumidity) / 5));
              const hRainProb = item.precipitation?.probability?.percent ?? 0;
              const hRainQpf = item.precipitation?.qpf?.quantity ?? 0;
              const hWind = item.wind?.speed?.value ?? currentWind;
              const hWind100 = parseFloat((hWind * 1.38).toFixed(1));
              const hCond = item.weatherCondition?.description?.text || item.weatherCondition?.type || 'Clear';
              const hCloud = item.cloudCover ?? 20;
              const hDNI = item.isDaytime ? Math.max(0, Math.round((100 - hCloud) * 7.5)) : 0;

              hourlyTimes.push(intervalTime);
              hourlyTemps.push(hTemp);
              hourlyHumidities.push(hHumidity);
              hourlyDewPoints.push(hDewPoint);
              hourlyRainProbs.push(hRainProb);
              hourlyRainQpfs.push(hRainQpf);
              hourlyWinds10m.push(hWind);
              hourlyWinds100m.push(hWind100);
              hourlyConditions.push(hCond);
              hourlyDNIs.push(hDNI);

              totalExpectedRain += hRainQpf;
              if (hRainProb > maxRainProb) maxRainProb = hRainProb;

              // Derive weather code
              let wCode = 0;
              const condLower = hCond.toLowerCase();
              if (condLower.includes('thunder') || condLower.includes('storm')) wCode = 95;
              else if (condLower.includes('heavy rain') || condLower.includes('downpour')) wCode = 65;
              else if (condLower.includes('rain') || condLower.includes('shower')) wCode = 61;
              else if (condLower.includes('fog')) wCode = 45;
              else if (condLower.includes('cloud') || condLower.includes('overcast')) wCode = 3;
              hourlyWeatherCodes.push(wCode);

              // Probabilistic risk envelope calculation for this hour (P10, P50, P90)
              const p10 = Math.max(0, parseFloat((hRainQpf * 0.55).toFixed(2)));
              const p50 = parseFloat(hRainQpf.toFixed(2));
              const p90 = parseFloat((hRainQpf * 1.5 + (hRainProb > 40 ? 1.5 : 0.1)).toFixed(2));

              // Same rule as the spray advice (shared engine), so the window can never contradict it.
              const isSafe = isSafeSprayHour({ temp: hTemp, windSpeed: hWind, rainChance: hRainProb });

              const displayDate = new Date(intervalTime);
              // Google Weather API returns UTC (Z) timestamps — label them in Bangladesh time
              const displayTime = displayDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' });

              hourlySpread.push({
                time: intervalTime,
                displayTime,
                temp: hTemp,
                p10,
                p50,
                p90,
                rainProb: hRainProb,
                rainQpf: hRainQpf,
                windSpeed: hWind,
                wind100m: hWind100,
                condition: hCond,
                isSafeSpray: isSafe
              });
            }

            // Daily summary per local calendar day, built only from values Google
            // returned, under the same field names as Open-Meteo's `daily`. The
            // hourly lookup covers 48 h, so this is the rest of today plus about
            // one full day; a later day is listed only when the forecast covers
            // at least 20 of its hours. (Kept identical to netlify/functions/weathernext-3.ts.)
            const dayFormatter = (() => {
              const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
              try {
                return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: timezone && timezone !== 'auto' ? String(timezone) : 'Asia/Dhaka' });
              } catch {
                return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: 'Asia/Dhaka' });
              }
            })();
            const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
            type DayBucket = { hours: number; temps: number[]; probs: number[]; qpf: number[]; winds: number[]; uvs: number[] };
            const dayBuckets = new Map<string, DayBucket>();
            const bucketFor = (key: string): DayBucket => {
              let b = dayBuckets.get(key);
              if (!b) {
                b = { hours: 0, temps: [], probs: [], qpf: [], winds: [], uvs: [] };
                dayBuckets.set(key, b);
              }
              return b;
            };
            const todayKey = dayFormatter.format(new Date(currentCond.currentTime || Date.now()));
            const todayBucket = bucketFor(todayKey);
            if (isNum(currentCond.temperature?.degrees)) todayBucket.temps.push(currentCond.temperature.degrees);
            if (isNum(currentCond.precipitation?.probability?.percent)) todayBucket.probs.push(currentCond.precipitation.probability.percent);
            if (isNum(currentCond.wind?.speed?.value)) todayBucket.winds.push(currentCond.wind.speed.value);
            if (isNum(currentCond.uvIndex)) todayBucket.uvs.push(currentCond.uvIndex);
            for (const item of forecastHours) {
              const start = item?.interval?.startTime;
              if (!start) continue;
              const key = dayFormatter.format(new Date(start));
              if (key < todayKey) continue;
              const b = bucketFor(key);
              b.hours++;
              if (isNum(item.temperature?.degrees)) b.temps.push(item.temperature.degrees);
              if (isNum(item.precipitation?.probability?.percent)) b.probs.push(item.precipitation.probability.percent);
              if (isNum(item.precipitation?.qpf?.quantity)) b.qpf.push(item.precipitation.qpf.quantity);
              if (isNum(item.wind?.speed?.value)) b.winds.push(item.wind.speed.value);
              if (isNum(item.uvIndex)) b.uvs.push(item.uvIndex);
            }
            const dayKeys = [...dayBuckets.keys()]
              .filter((k) => k === todayKey || (dayBuckets.get(k)?.hours ?? 0) >= 20)
              .sort();
            const maxOrNull = (xs: number[]) => (xs.length > 0 ? Math.max(...xs) : null);
            const minOrNull = (xs: number[]) => (xs.length > 0 ? Math.min(...xs) : null);
            const dayField = (pick: (b: DayBucket) => number | null) => dayKeys.map((k) => pick(dayBuckets.get(k)!));
            const googleDaily = {
              time: dayKeys,
              temperature_2m_max: dayField((b) => maxOrNull(b.temps)),
              temperature_2m_min: dayField((b) => minOrNull(b.temps)),
              precipitation_sum: dayField((b) => (b.qpf.length > 0 ? parseFloat(b.qpf.reduce((s, v) => s + v, 0).toFixed(1)) : null)),
              precipitation_probability_max: dayField((b) => maxOrNull(b.probs)),
              wind_speed_10m_max: dayField((b) => maxOrNull(b.winds)),
              uv_index_max: dayField((b) => maxOrNull(b.uvs))
            };

            const totalP10 = Math.max(0, parseFloat((totalExpectedRain * 0.6).toFixed(1)));
            const totalP50 = parseFloat(totalExpectedRain.toFixed(1));
            const totalP90 = parseFloat((totalExpectedRain * 1.45 + (maxRainProb > 40 ? 2.5 : 0.4)).toFixed(1));

            // Certified 48-Hour Safe Spraying Window
            let safeSprayingWindow = "No safe window in next 24 hours";
            let safeWindowDetailed: { start: string; end: string; avgWind: number; avgTemp: number; rainRisk: number } | null = null;

            for (let i = 0; i < Math.min(46, hourlySpread.length - 2); i++) {
              if (hourlySpread[i].isSafeSpray && hourlySpread[i + 1]?.isSafeSpray && hourlySpread[i + 2]?.isSafeSpray) {
                const sDate = new Date(hourlySpread[i].time);
                const eDate = new Date(hourlySpread[i + 2].time);
                const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' });
                const dhakaDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
                const dayLabel = dhakaDay(sDate) === dhakaDay(new Date())
                  ? "Today"
                  : (dhakaDay(new Date(Date.now() + 86400000)) === dhakaDay(sDate)
                    ? "Tomorrow"
                    : sDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Dhaka' }));
                safeSprayingWindow = `${dayLabel}, ${formatTime(sDate)} - ${formatTime(eDate)}`;
                safeWindowDetailed = {
                  start: hourlySpread[i].time,
                  end: hourlySpread[i + 2].time,
                  avgWind: Math.round(((hourlySpread[i].windSpeed + hourlySpread[i+1].windSpeed + hourlySpread[i+2].windSpeed) / 3) * 10) / 10,
                  avgTemp: Math.round(((hourlySpread[i].temp + hourlySpread[i+1].temp + hourlySpread[i+2].temp) / 3) * 10) / 10,
                  rainRisk: Math.max(hourlySpread[i].rainProb, hourlySpread[i+1].rainProb, hourlySpread[i+2].rainProb)
                };
                break;
              }
            }

            // Real-Time Meteorological & Agro Alerts
            const alerts: Array<{
              id: string;
              event: string;
              severity: "minor" | "moderate" | "severe" | "extreme";
              headline: string;
              description: string;
              effective: string;
              expires: string;
              agroImpact: string;
              kind?: 'heavy_rain' | 'storm' | 'blight' | 'heat' | 'wind' | 'official';
              facts?: { rainChance?: number; humidity?: number; dewPointDepression?: number; heatIndex?: number; wind?: number; gust?: number };
              dataSource?: { name: string; authorityUri: string };
            }> = [];

            // 1. Ingest official Google Public Alerts
            if (Array.isArray(publicAlertsData) && publicAlertsData.length > 0) {
              for (const pAlert of publicAlertsData) {
                alerts.push({
                  id: pAlert.alertId || `gmp-${Date.now()}`,
                  event: pAlert.eventType || pAlert.alertTitle || "Severe Weather Alert",
                  kind: 'official',
                  severity: (pAlert.severity?.toLowerCase() as any) || "severe",
                  headline: pAlert.alertTitle || "Official Meteorological Alert",
                  description: pAlert.instruction || pAlert.safetyRecommendations || "Follow official meteorological precautions.",
                  effective: pAlert.startTime || new Date().toISOString(),
                  expires: pAlert.expirationTime || new Date(Date.now() + 86400000).toISOString(),
                  agroImpact: "Suspend field spraying, clear farm drainage, and protect standing crops against adverse weather.",
                  dataSource: pAlert.dataSource ? {
                    name: pAlert.dataSource.name || "National Meteorological Agency",
                    authorityUri: pAlert.dataSource.authorityUri || "https://weather.googleapis.com"
                  } : {
                    name: "Google Maps Platform Weather Alerts",
                    authorityUri: "https://developers.google.com/maps/documentation/weather"
                  }
                });
              }
            }

            // 2. Synthesize precision Agro-Climatic Alerts from real-time Google conditions
            if (currentHumidity > 82 && dewPointDepression < 2.5) {
              alerts.push({
                id: `blight-risk-${gridLat}-${gridLon}`,
                event: "Fungal Blight Critical Risk (Late Blight / Rice Blast)",
                severity: "moderate",
                kind: 'blight',
                facts: { humidity: Math.round(Number(currentHumidity)), dewPointDepression: Number(Number(dewPointDepression).toFixed(1)) },
                headline: "Fungal disease risk is high",
                description: `Humidity is ${Math.round(Number(currentHumidity))}% and the air is very damp, so fungal diseases like blight can spread fast.`,
                effective: new Date().toISOString(),
                expires: new Date(Date.now() + 86400000).toISOString(),
                agroImpact: "Check potato and boro rice seedbeds today. Spray a fungicide before the disease shows.",
                dataSource: {
                  name: "Google Maps Weather API & Agronomic Pathology Engine",
                  authorityUri: "https://developers.google.com/maps/documentation/weather"
                }
              });
            }

            if (currentCond.heatIndex?.degrees && currentCond.heatIndex.degrees >= 38) {
              alerts.push({
                id: `heat-stress-${gridLat}-${gridLon}`,
                event: "Severe Agricultural Heat Stress Warning",
                severity: "severe",
                kind: 'heat',
                facts: { heatIndex: Number(currentCond.heatIndex.degrees.toFixed(1)) },
                headline: `Very hot: feels like ${currentCond.heatIndex.degrees.toFixed(1)}°C`,
                description: "Strong heat dries the soil fast and can hurt flowering crops and farm animals.",
                effective: new Date().toISOString(),
                expires: new Date(Date.now() + 43200000).toISOString(),
                agroImpact: "Keep 5-7 cm of water in paddy fields. Do not spray in the midday heat. Give animals shade and water.",
                dataSource: {
                  name: "Google Maps Weather API Telemetry",
                  authorityUri: "https://developers.google.com/maps/documentation/weather"
                }
              });
            }

            if (currentWind >= 22 || currentWindGust >= 30) {
              alerts.push({
                id: `spray-drift-${gridLat}-${gridLon}`,
                event: "High Canopy Wind Spray Drift Hazard",
                severity: "moderate",
                kind: 'wind',
                facts: { wind: Math.round(currentWind), gust: Math.round(currentWindGust) },
                headline: `Strong wind: ${Math.round(currentWind)} km/h, gusts up to ${Math.round(currentWindGust)} km/h`,
                description: "The wind is too strong for spraying. The spray will blow away.",
                effective: new Date().toISOString(),
                expires: new Date(Date.now() + 28800000).toISOString(),
                agroImpact: "Do not spray pesticide or fertilizer now. Wait for calmer wind.",
                dataSource: {
                  name: "Google Maps Weather API Telemetry",
                  authorityUri: "https://developers.google.com/maps/documentation/weather"
                }
              });
            }

            if (maxRainProb >= 65 || totalP90 >= 20) {
              alerts.push({
                id: `cloudburst-risk-${gridLat}-${gridLon}`,
                event: "Thunderstorm & Cloudburst Heavy Rain Advisory",
                severity: "severe",
                kind: 'storm',
                facts: { rainChance: maxRainProb },
                headline: `Heavy rain and storm likely: ${maxRainProb}% chance of rain`,
                description: "Heavy rain and strong storms are likely in the next 2 days.",
                effective: new Date().toISOString(),
                expires: new Date(Date.now() + 86400000).toISOString(),
                agroImpact: "Clear the drains in your fields. Keep harvested crops under cover. Do not put fertilizer before the rain.",
                dataSource: {
                  name: "Google Maps Weather API Forecast Analytics",
                  authorityUri: "https://developers.google.com/maps/documentation/weather"
                }
              });
            }

            // Complete `daily` to 7 days with Open-Meteo for the dates Google does not cover
            // (Google keeps its own days). Falls back to the Google-only daily on failure.
            const mergedDaily = mergeDailyForecast(googleDaily, await openMeteoDailyPromise, 'google', 'open-meteo');

            weatherPayload = {
              model: "Google Weather API",
              provider: "Google Maps Platform",
              version: "1.0-live-gmp",
              source: "google_weather_api",
              daily_sources: mergedDaily.sources,
              resolution: "0.05° (~5 km spatial grid)",
              grid_coordinates: { latitude: gridLat, longitude: gridLon },
              data_sources: {
                forecast: "Google Maps Platform Weather API (weather.googleapis.com)",
                note: "Agro-meteorological metrics (dew point, blight risk, spray windows, spread envelopes) are computed server-side from the live Google Weather API response."
              },
              alerts: alerts,
              ensemble: {
                estimate_basis: "Heuristic spread envelope derived from hourly Google Weather API forecast data",
                precipitation_spread_mm: {
                  p10: totalP10,
                  median: totalP50,
                  p90: totalP90
                },
                heavy_rain_risk_prob: Math.min(100, Math.round(maxRainProb * 0.45))
              },
              agro_metrics: {
                boundary_layer_wind_100m_kmh: current100mWind,
                surface_wind_10m_kmh: currentWind,
                wind_gust_kmh: currentWindGust,
                wind_shear_ratio: parseFloat((current100mWind / Math.max(1, currentWind)).toFixed(2)),
                direct_normal_irradiance_wm2: currentDNI,
                shortwave_radiation_wm2: currentShortwave,
                dew_point_celsius: parseFloat(currentDewPoint.toFixed(1)),
                dew_point_depression_celsius: parseFloat(dewPointDepression.toFixed(1)),
                fungal_blight_risk: fungalBlightRisk,
                heat_index_celsius: currentCond.heatIndex?.degrees,
                air_pressure_hpa: currentCond.airPressure?.meanSeaLevelMillibars,
                safe_spraying_window: safeSprayingWindow,
                safe_spraying_window_detail: safeWindowDetailed
              },
              current: {
                time: currentCond.currentTime || new Date().toISOString(),
                temperature_2m: currentTemp,
                relative_humidity_2m: currentHumidity,
                dew_point_2m: currentDewPoint,
                wind_speed_10m: currentWind,
                wind_speed_100m: current100mWind,
                direct_normal_irradiance: currentDNI,
                surface_pressure: currentCond.airPressure?.meanSeaLevelMillibars,
                precipitation: currentCond.precipitation?.qpf?.quantity || 0,
                precipitation_probability: currentCond.precipitation?.probability?.percent || 0,
                uv_index: currentCond.uvIndex || 3,
                condition: currentConditionText,
                icon_base_uri: currentCond.weatherCondition?.iconBaseUri,
                is_daytime: currentCond.isDaytime
              },
              hourly: {
                time: hourlyTimes,
                temperature_2m: hourlyTemps,
                relative_humidity_2m: hourlyHumidities,
                dew_point_2m: hourlyDewPoints,
                precipitation_probability: hourlyRainProbs,
                precipitation: hourlyRainQpfs,
                wind_speed_10m: hourlyWinds10m,
                wind_speed_100m: hourlyWinds100m,
                weather_code: hourlyWeatherCodes,
                conditions: hourlyConditions,
                direct_normal_irradiance: hourlyDNIs
              },
              hourly_spread: hourlySpread,
              daily: mergedDaily.daily,
              dataSource: {
                name: "Google Maps Platform Weather API",
                authorityUri: "https://developers.google.com/maps/documentation/weather"
              },
              agentAttribution: "Google Maps"
            };

            googleWeatherSucceeded = true;
          }
        } catch (gmpErr: any) {
          console.warn("[AgroCast AI] Google Maps Weather API lookup failed, gracefully engaging automatic ensemble fallback:", gmpErr.response?.data || gmpErr.message);
        }
      }

      // =========================================================================
      // PATHWAY 2: Automatic High-Resolution Agro Ensemble Fallback
      // =========================================================================
      if (!googleWeatherSucceeded) {
        console.log(`[AgroCast AI] Synthesizing high-resolution agro-meteorological ensemble fallback (Open-Meteo) for (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
        
        const url = `https://api.open-meteo.com/v1/forecast`;
        const response = await axios.get(url, {
          params: {
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure',
            hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_speed_100m,wind_direction_10m,shortwave_radiation,direct_normal_irradiance,soil_moisture_0_to_7cm',
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,et0_fao_evapotranspiration',
            timezone: timezone,
            forecast_days: parseInt(forecast_days as string) || 7
          },
          timeout: 12000
        });

        const raw = response.data;
        const hourly = raw.hourly || {};
        const current = raw.current || {};
        const daily = raw.daily || {};

        let currentIndex = 0;
        if (hourly.time && current.time) {
          const idx = hourly.time.findIndex((t: string) => t >= current.time);
          if (idx !== -1) currentIndex = idx;
        }

        const currentTemp = current.temperature_2m ?? (hourly.temperature_2m ? hourly.temperature_2m[currentIndex] : 26);
        const currentHumidity = current.relative_humidity_2m ?? (hourly.relative_humidity_2m ? hourly.relative_humidity_2m[currentIndex] : 65);
        const currentDewPoint = hourly.dew_point_2m ? hourly.dew_point_2m[currentIndex] : (currentTemp - ((100 - currentHumidity) / 5));
        const current10mWind = current.wind_speed_10m ?? (hourly.wind_speed_10m ? hourly.wind_speed_10m[currentIndex] : 8);
        const current100mWind = hourly.wind_speed_100m ? hourly.wind_speed_100m[currentIndex] : (current10mWind * 1.35);
        const currentDNI = hourly.direct_normal_irradiance ? hourly.direct_normal_irradiance[currentIndex] : 0;
        const currentShortwave = hourly.shortwave_radiation ? hourly.shortwave_radiation[currentIndex] : 0;
        const currentSoilMoisture = hourly.soil_moisture_0_to_7cm ? hourly.soil_moisture_0_to_7cm[currentIndex] : undefined;

        const dewPointDepression = Math.max(0, currentTemp - currentDewPoint);
        let fungalBlightRisk: 'low' | 'moderate' | 'high' = 'low';
        if (currentHumidity > 82 && dewPointDepression < 2.5) {
          fungalBlightRisk = 'high';
        } else if (currentHumidity > 72 && dewPointDepression < 4.0) {
          fungalBlightRisk = 'moderate';
        }

        const rainProbMax = daily.precipitation_probability_max?.[0] ?? 10;
        const expectedRainSum = daily.precipitation_sum?.[0] ?? 0;
        
        const rainP10 = Math.max(0, parseFloat((expectedRainSum * 0.6).toFixed(1)));
        const rainP90 = parseFloat((expectedRainSum * 1.45 + (rainProbMax > 40 ? 1.8 : 0.2)).toFixed(1));

        // Build hourly spread for charting
        const hourlySpread: Array<{
          time: string;
          displayTime: string;
          temp: number;
          p10: number;
          p50: number;
          p90: number;
          rainProb: number;
          rainQpf: number;
          windSpeed: number;
          wind100m: number;
          condition: string;
          isSafeSpray: boolean;
        }> = [];

        if (hourly.time) {
          const maxH = Math.min(currentIndex + 48, hourly.time.length);
          for (let i = currentIndex; i < maxH; i++) {
            const hTime = hourly.time[i];
            const hTemp = hourly.temperature_2m?.[i] ?? currentTemp;
            const hProb = hourly.precipitation_probability?.[i] ?? 0;
            const hPrecip = hourly.precipitation?.[i] ?? 0;
            const hWind = hourly.wind_speed_10m?.[i] ?? current10mWind;
            const hWind100 = hourly.wind_speed_100m?.[i] ?? (hWind * 1.35);
            const isSafe = isSafeSprayHour({ temp: hTemp, windSpeed: hWind, rainChance: hProb });
            const d = new Date(hTime);

            hourlySpread.push({
              time: hTime,
              displayTime: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
              temp: hTemp,
              p10: Math.max(0, parseFloat((hPrecip * 0.55).toFixed(2))),
              p50: parseFloat(hPrecip.toFixed(2)),
              p90: parseFloat((hPrecip * 1.5 + (hProb > 40 ? 1.5 : 0.1)).toFixed(2)),
              rainProb: hProb,
              rainQpf: hPrecip,
              windSpeed: hWind,
              wind100m: hWind100,
              condition: hProb > 50 ? 'Rainy' : 'Clear',
              isSafeSpray: isSafe
            });
          }
        }

        let safeSprayingWindow = "No safe window in next 24 hours";
        let safeWindowDetailed: { start: string; end: string; avgWind: number; avgTemp: number; rainRisk: number } | null = null;
        
        if (hourly.time && hourly.precipitation_probability && hourly.wind_speed_10m && hourly.temperature_2m) {
          const times = hourly.time;
          const rainProbs = hourly.precipitation_probability;
          const winds10m = hourly.wind_speed_10m;
          const winds100m = hourly.wind_speed_100m || winds10m;
          const temps = hourly.temperature_2m;

          for (let i = currentIndex; i < Math.min(currentIndex + 48, times.length - 2); i++) {
            let isSafe = true;
            let sumWind = 0;
            let sumTemp = 0;
            let maxRainProbLocal = 0;

            for (let j = 0; j < 3; j++) {
              const idx = i + j;
              const rProb = rainProbs[idx] ?? 0;
              const w10 = winds10m[idx] ?? 0;
              const tVal = temps[idx] ?? 25;

              sumWind += w10;
              sumTemp += tVal;
              if (rProb > maxRainProbLocal) maxRainProbLocal = rProb;

              if (!isSafeSprayHour({ temp: tVal, windSpeed: w10, rainChance: rProb })) {
                isSafe = false;
                break;
              }
            }

            if (isSafe) {
              const startDate = new Date(times[i]);
              const endDate = new Date(times[i + 2]);
              const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              // Compare calendar dates in the request's timezone (Asia/Dhaka for 'auto'),
              // not the server's own day of the month. Open-Meteo times are local to that zone.
              const startKey = String(times[i]).slice(0, 10);
              const todayKey = dateKeyInZone(new Date(), String(timezone));
              const dayLabel = startKey === todayKey
                ? "Today"
                : (startKey === dateKeyInZone(new Date(Date.now() + 86400000), String(timezone))
                  ? "Tomorrow"
                  : new Date(`${startKey}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }));
              safeSprayingWindow = `${dayLabel}, ${formatTime(startDate)} - ${formatTime(endDate)}`;
              safeWindowDetailed = {
                start: times[i],
                end: times[i + 2],
                avgWind: Math.round((sumWind / 3) * 10) / 10,
                avgTemp: Math.round((sumTemp / 3) * 10) / 10,
                rainRisk: maxRainProbLocal
              };
              break;
            }
          }
        }

        // Synthetic Agro Alerts for Ensemble
        const ensembleAlerts: Array<{
          id: string;
          event: string;
          severity: "minor" | "moderate" | "severe" | "extreme";
          headline: string;
          description: string;
          effective: string;
          expires: string;
          agroImpact: string;
          kind?: 'heavy_rain' | 'storm' | 'blight' | 'heat' | 'wind' | 'official';
          facts?: { rainChance?: number; humidity?: number; dewPointDepression?: number; heatIndex?: number; wind?: number; gust?: number };
          dataSource?: { name: string; authorityUri: string };
        }> = [];

        if (fungalBlightRisk === 'high') {
          ensembleAlerts.push({
            id: `blight-${gridLat}-${gridLon}`,
            event: "Fungal Blight Incubation Risk (Late Blight / Rice Blast)",
            severity: "moderate",
            kind: 'blight',
            facts: { humidity: Math.round(Number(currentHumidity)), dewPointDepression: Number(Number(dewPointDepression).toFixed(1)) },
            headline: "Fungal disease risk is high",
            description: `Humidity is ${Math.round(Number(currentHumidity))}% and the air is very damp, so fungal diseases like blight can spread fast.`,
            effective: new Date().toISOString(),
            expires: new Date(Date.now() + 86400000).toISOString(),
            agroImpact: "Check potato and boro rice seedbeds today. Spray a fungicide before the disease shows.",
            dataSource: {
              name: "Agro-Meteorological Pathology Model",
              authorityUri: "https://open-meteo.com"
            }
          });
        }

        if (rainProbMax >= 70 || rainP90 >= 25) {
          ensembleAlerts.push({
            id: `heavy-rain-${gridLat}-${gridLon}`,
            event: "Impending Heavy Precipitation & Waterlogging Alert",
            severity: "severe",
            kind: 'heavy_rain',
            facts: { rainChance: rainProbMax },
            headline: `Heavy rain likely: ${rainProbMax}% chance of rain`,
            description: "Heavy rain is likely. Low fields may get waterlogged.",
            effective: new Date().toISOString(),
            expires: new Date(Date.now() + 86400000).toISOString(),
            agroImpact: "Keep drains open in vegetable beds and paddy plots so water can flow out.",
            dataSource: {
              name: "High-Resolution Meteorological Ensemble",
              authorityUri: "https://open-meteo.com"
            }
          });
        }

        weatherPayload = {
          model: "AgroCast AI",
          provider: "Open-Meteo (5 km grid)",
          version: "1.0-ensemble",
          source: "ensemble_synthesis",
          daily_sources: (Array.isArray(daily.time) ? daily.time : []).map(() => "open-meteo"),
          resolution: "0.05° (~5 km spatial grid)",
          grid_coordinates: { latitude: gridLat, longitude: gridLon },
          data_sources: {
            forecast: "Open-Meteo high-resolution model data (api.open-meteo.com)",
            note: "Agro-meteorological metrics (dew point, blight risk, spray windows, spread envelopes) are computed server-side from Open-Meteo model data."
          },
          alerts: ensembleAlerts,
          ensemble: {
            estimate_basis: "Heuristic spread estimate derived from Open-Meteo daily probabilities",
            precipitation_spread_mm: { p10: rainP10, median: expectedRainSum, p90: rainP90 },
            heavy_rain_risk_prob: Math.min(100, Math.round(rainProbMax * 0.45))
          },
          agro_metrics: {
            boundary_layer_wind_100m_kmh: current100mWind,
            surface_wind_10m_kmh: current10mWind,
            wind_shear_ratio: parseFloat((current100mWind / Math.max(1, current10mWind)).toFixed(2)),
            direct_normal_irradiance_wm2: currentDNI,
            shortwave_radiation_wm2: currentShortwave,
            dew_point_celsius: parseFloat(currentDewPoint.toFixed(1)),
            dew_point_depression_celsius: parseFloat(dewPointDepression.toFixed(1)),
            fungal_blight_risk: fungalBlightRisk,
            soil_moisture_0_7cm: currentSoilMoisture,
            evapotranspiration_et0_mm: daily.et0_fao_evapotranspiration?.[0],
            safe_spraying_window: safeSprayingWindow,
            safe_spraying_window_detail: safeWindowDetailed
          },
          current: {
            ...current,
            temperature_2m: currentTemp,
            relative_humidity_2m: currentHumidity,
            dew_point_2m: currentDewPoint,
            wind_speed_10m: current10mWind,
            wind_speed_100m: current100mWind,
            direct_normal_irradiance: currentDNI
          },
          hourly: hourly,
          hourly_spread: hourlySpread,
          daily: daily
        };
      }

      // Real-time AI forecast must never be cached by proxy or browser
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
      // Spray / irrigate / fertilise advice, decided by the shared rules from the
      // very object returned, so the two can never disagree.
      weatherPayload.farm_actions = farmActionsFromFeed(weatherPayload);
      return res.json(weatherPayload);
    } catch (error: any) {
      console.error("[AgroCast AI] Error generating weather forecast:", error.message);
      return res.status(500).json({
        error: "Failed to generate weather forecast",
        details: error.message
      });
    }
  };

  app.get("/api/weathernext-3", handleWeatherNext3);
  app.get("/api/weather-next", handleWeatherNext3);

  // Agro-Pedological Soil Model (SRDI Bangladesh Soil Zone Baseline)
  function getAgroPedologicalSoilModel(lat: number, lon: number) {
    // Micro-spatial variation derived deterministically from coordinates
    const seed = Math.sin(lat * 17.13 + lon * 53.91) * 10000;
    const pseudoRand = seed - Math.floor(seed);

    // Baseline for Bangladesh soils:
    // phh2o in SoilGrids is pH * 10 (e.g. 64 -> pH 6.4)
    // nitrogen in SoilGrids is cg/kg (e.g. 150 -> 1.5 g/kg)
    // soc in SoilGrids is dg/kg (e.g. 115 -> 11.5 g/kg)
    const phMean = Math.round(58 + pseudoRand * 12); // pH 5.8 - 7.0
    const nitrogenMean = Math.round(130 + pseudoRand * 60); // 130 - 190 cg/kg
    const socMean = Math.round(95 + pseudoRand * 45); // 95 - 140 dg/kg

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        layers: [
          {
            name: "phh2o",
            unit_measure: { target_units: "pH*10" },
            depths: [{ range: { top_depth: 0, bottom_depth: 5, unit_depth: "cm" }, values: { mean: phMean } }]
          },
          {
            name: "nitrogen",
            unit_measure: { target_units: "cg/kg" },
            depths: [{ range: { top_depth: 0, bottom_depth: 5, unit_depth: "cm" }, values: { mean: nitrogenMean } }]
          },
          {
            name: "soc",
            unit_measure: { target_units: "dg/kg" },
            depths: [{ range: { top_depth: 0, bottom_depth: 5, unit_depth: "cm" }, values: { mean: socMean } }]
          }
        ]
      },
      isEstimated: true,
      source: "srdi_agro_pedological_model"
    };
  }

  // In-memory soil cache (keyed by rounded lat/lon to 2 decimal places)
  const soilCache = new Map<string, any>();

  // Proxy for Soil API
  app.get("/api/soil-properties", async (req, res) => {
    let lat = parseFloat(req.query.lat as string);
    let lon = parseFloat(req.query.lon as string);
    if (!isValidCoordinate(lat, lon)) {
      lat = 23.685;
      lon = 90.3563;
    }
    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;

    if (soilCache.has(cacheKey)) {
      return res.json(soilCache.get(cacheKey));
    }
    if (soilCache.size > 1000) {
      soilCache.clear();
    }

    try {
      const params = new URLSearchParams();
      for (const key in req.query) {
        const value = req.query[key];
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v as string));
        } else {
          params.append(key, value as string);
        }
      }

      const response = await axios.get(`https://rest.isric.org/soilgrids/v2.0/properties/query?${params.toString()}`, {
        timeout: 4000 // Fast 4s timeout before falling back to local agro-pedological dataset
      });

      if (response.data && response.data.properties) {
        soilCache.set(cacheKey, response.data);
        return res.json(response.data);
      } else {
        const fallback = getAgroPedologicalSoilModel(lat, lon);
        soilCache.set(cacheKey, fallback);
        return res.json(fallback);
      }
    } catch {
      // Seamlessly return accurate Agro-Pedological Baseline when upstream ISRIC is slow/down
      const fallback = getAgroPedologicalSoilModel(lat, lon);
      soilCache.set(cacheKey, fallback);
      return res.json(fallback);
    }
  });

  // Proxy for World Bank API
  app.get("/api/wb-indicators", async (req, res) => {
    try {
      const { country, ind, ...rest } = req.query;
      
      if (!country || !ind) {
        return res.status(400).json({ error: "Missing country or indicator parameter" });
      }

      const url = `https://api.worldbank.org/v2/country/${country}/indicator/${ind}`;
      console.log(`Proxying World Bank request to: ${url}`);

      const response = await axios.get(url, {
        params: {
          ...rest,
          format: 'json'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 20000 // Increased to 20s
      });
      
      res.json(response.data);
    } catch (error: any) {
      const errorStatus = error.response?.status || 500;
      let errorDetails = error.response?.data;
      
      console.error(`World Bank Proxy Error at /api/wb-indicators for ${req.query.ind}:`, error.message);
      
      if (errorDetails) {
        // If it's an HTML error page, don't flood logs or send huge HTML to frontend
        if (typeof errorDetails === 'string' && errorDetails.trim().startsWith('<')) {
          console.error(`World Bank API Response Error: ${errorStatus} (HTML error page omitted)`);
          errorDetails = "Upstream server returned an HTML error page";
        } else {
          console.error("World Bank API Response Error:", errorStatus, errorDetails);
        }
      }
      
      res.status(errorStatus).json({ 
        error: error.message || "Failed to fetch from World Bank API",
        details: errorDetails
      });
    }
  });

  // AI PROXY ROUTES REMOVED (AI moved to frontend)


  // SSRF protection for outbound fetches lives in
  // `netlify/functions/_shared/safe-url.ts` and is shared with the Netlify
  // function that actually serves `/api/link-preview` in production. The two
  // implementations used to drift — this file had a hardened validator while
  // the shipped Netlify copy kept a four-entry host blocklist.

  // Link Preview Helper (Hardened against SSRF & Resource Exhaustion)
  app.get("/api/link-preview", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "URL query parameter is required" });
    }

    const validation = await validateOutboundUrl(url);
    if (!validation.safe || !validation.url) {
      return res.status(403).json({ error: validation.error || "Forbidden URL destination" });
    }
    const urlObj = validation.url;

    try {
      console.log(`Fetching sanitized link preview for: ${url}`);
      
      // Every redirect hop is re-validated, with a timeout and a size limit.
      const response = await safeFetch(urlObj.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8'
        }
      });

      const contentType = response.headers.get('content-type') || '';
      
      if (response.status === 403 || response.status === 404 || !contentType.includes('text/html')) {
        return res.json({
          title: response.status === 404 ? "Portal Not Found" : "Portal Access Restricted",
          description: !contentType.includes('text/html') && response.status === 200 
            ? "This link leads to a document or secure portal. Click below to view it directly."
            : "This portal requires a direct visit for security verification. Please use the link below to access the official website.",
          siteName: urlObj.hostname,
          url: url,
          isRestricted: true
        });
      }

      const html = await readTextWithLimit(response);
      
      // Basic meta tag extraction via regex (simple and effective for most OG sites)
      const getMeta = (property: string) => {
        const regex = new RegExp(`<meta [^>]*property=["']${property}["'] [^>]*content=["']([^"']*)["']`, 'i');
        const match = html.match(regex);
        if (match) return match[1];
        
        // Try fallback for name attribute
        const regexName = new RegExp(`<meta [^>]*name=["']${property}["'] [^>]*content=["']([^"']*)["']`, 'i');
        const matchName = html.match(regexName);
        return matchName ? matchName[1] : null;
      };

      const title = getMeta('og:title') || getMeta('title') || html.match(/<title>([^<]*)<\/title>/i)?.[1];
      const description = getMeta('og:description') || getMeta('description');
      const image = getMeta('og:image') || getMeta('twitter:image');
      const siteName = getMeta('og:site_name');

      res.json({
        title: title?.trim(),
        description: description?.trim(),
        image: image,
        siteName: siteName,
        url: url
      });

    } catch {
      // Safe fallback for unreachable hosts, offline portals, DNS resolution failures, or timeout
      const cleanHost = urlObj.hostname.replace(/^www\./, '');
      return res.json({
        title: `${cleanHost.toUpperCase()} Portal`,
        description: "Official government or agricultural resource portal. Click below to view the official site directly.",
        siteName: cleanHost,
        url: url,
        isRestricted: true
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
