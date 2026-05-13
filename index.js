const express = require("express");
const cors = require("cors");
const axios = require("axios");
 
const app = express();
const PORT = process.env.PORT || 3000;
 
app.use(cors());
app.use(express.json());
 
// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ACT_BASE = "https://profile.callofduty.com";
const ACT_API  = "https://my.callofduty.com/api/papi-client";
 
const BASE_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};
 
// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "✅ CODM Tracker Backend is running 🎮" });
});
 
// ─── LOGIN ACTIVISION (email + mot de passe) ──────────────────────────────────
app.post("/auth/activision", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email et mot de passe requis" });
  }
  try {
    const csrfRes = await axios.get(`${ACT_BASE}/do_login?new_SiteId=cod`, {
      headers: BASE_HEADERS,
    });
    const csrfToken = csrfRes.headers["x-xsrf-token"] || "";
    const cookies = (csrfRes.headers["set-cookie"] || []).join("; ");
 
    const loginRes = await axios.post(
      `${ACT_BASE}/do_login?new_SiteId=cod`,
      new URLSearchParams({
        username: email,
        password: password,
        remember_me: "true",
        _csrf: csrfToken,
      }).toString(),
      {
        headers: {
          ...BASE_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookies,
          "X-XSRF-TOKEN": csrfToken,
          "Referer": `${ACT_BASE}/do_login?new_SiteId=cod`,
        },
        maxRedirects: 0,
        validateStatus: (s) => s < 400,
      }
    );
 
    const sessionCookies = (loginRes.headers["set-cookie"] || []).join("; ");
    if (!sessionCookies.includes("ACT_SSO_COOKIE")) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }
 
    res.json({ success: true, cookies: sessionCookies });
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(500).json({ success: false, message: "Erreur de connexion Activision" });
  }
});
 
// ─── LOGIN FACEBOOK → ACTIVISION ─────────────────────────────────────────────
app.post("/auth/facebook", async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ success: false, message: "Token Facebook requis" });
  }
  try {
    const fbRes = await axios.post(
      `${ACT_BASE}/api/auth/identityProvider/token`,
      { provider: "facebook", token: accessToken },
      { headers: BASE_HEADERS, maxRedirects: 0, validateStatus: (s) => s < 400 }
    );
 
    const sessionCookies = (fbRes.headers["set-cookie"] || []).join("; ");
    if (!sessionCookies.includes("ACT_SSO_COOKIE")) {
      return res.status(401).json({ success: false, message: "Token Facebook invalide ou compte non lié à Activision" });
    }
 
    res.json({ success: true, cookies: sessionCookies });
  } catch (err) {
    console.error("Facebook auth error:", err.message);
    res.status(500).json({ success: false, message: "Erreur d'authentification Facebook" });
  }
});
 
// ─── STATS COD MOBILE ─────────────────────────────────────────────────────────
// POST /stats  { cookies, activisionId }
app.post("/stats", async (req, res) => {
  const { cookies, activisionId } = req.body;
  if (!cookies || !activisionId) {
    return res.status(400).json({ success: false, message: "Cookies et activisionId requis" });
  }
  try {
    const encoded = encodeURIComponent(activisionId);
 
    // ✅ Endpoint spécifique COD Mobile
    const statsRes = await axios.get(
      `${ACT_API}/crm/cod/v2/title/mobile/platform/uno/gamer/${encoded}/profile/type/mp`,
      {
        headers: {
          ...BASE_HEADERS,
          "Cookie": cookies,
          "X-XSRF-TOKEN": extractCookie(cookies, "XSRF-TOKEN"),
          "ACT_SSO_COOKIE": extractCookie(cookies, "ACT_SSO_COOKIE"),
        },
      }
    );
 
    const data    = statsRes.data?.data?.lifetime?.all?.properties || {};
    const ranked  = statsRes.data?.data?.lifetime?.mode?.ranked?.properties || {};
    const br      = statsRes.data?.data?.lifetime?.mode?.br?.properties || {};
    const mp      = statsRes.data?.data?.lifetime?.mode?.mp?.properties || {};
 
    const stats = {
      username: activisionId,
      level: statsRes.data?.data?.level || 0,
 
      // ── Stats globales ──
      kd:               (data.kdRatio || 0).toFixed(2),
      kills:            data.kills || 0,
      deaths:           data.deaths || 0,
      wins:             data.wins || 0,
      gamesPlayed:      data.gamesPlayed || 0,
      winRate:          (((data.wins || 0) / (data.gamesPlayed || 1)) * 100).toFixed(1),
      avgKills:         (data.killsPerGame || 0).toFixed(1),
      headshots:        data.headshots || 0,
      accuracy:         ((data.accuracy || 0) * 100).toFixed(1),
      scorePerGame:     Math.round(data.scorePerGame || 0),
      longestStreak:    data.longestKillStreak || 0,
 
      // ── Battle Royale ──
      br: {
        kd:          (br.kdRatio || 0).toFixed(2),
        wins:        br.wins || 0,
        gamesPlayed: br.gamesPlayed || 0,
        top10:       br.topTen || 0,
        avgKills:    (br.killsPerGame || 0).toFixed(1),
        winRate:     (((br.wins || 0) / (br.gamesPlayed || 1)) * 100).toFixed(1),
      },
 
      // ── Multijoueur ──
      mp: {
        kd:          (mp.kdRatio || 0).toFixed(2),
        wins:        mp.wins || 0,
        gamesPlayed: mp.gamesPlayed || 0,
        winRate:     (((mp.wins || 0) / (mp.gamesPlayed || 1)) * 100).toFixed(1),
        scorePerGame: Math.round(mp.scorePerGame || 0),
      },
 
      // ── Ranked ──
      ranked: {
        kd:          (ranked.kdRatio || 0).toFixed(2),
        wins:        ranked.wins || 0,
        gamesPlayed: ranked.gamesPlayed || 0,
        winRate:     (((ranked.wins || 0) / (ranked.gamesPlayed || 1)) * 100).toFixed(1),
      },
    };
 
    res.json({ success: true, stats });
  } catch (err) {
    console.error("Stats error:", err.message);
    res.json({
      success: false,
      message: "Stats temporairement indisponibles — données demo affichées",
      stats: getMockStats(activisionId),
    });
  }
});
 
// ─── UTILITAIRES ──────────────────────────────────────────────────────────────
function extractCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : "";
}
 
function getMockStats(username) {
  return {
    username,
    level: 87,
    kd: "4.20",
    kills: 12840,
    deaths: 3057,
    wins: 46,
    gamesPlayed: 847,
    winRate: "12.0",
    avgKills: "5.8",
    headshots: 3210,
    accuracy: "28.4",
    scorePerGame: 4200,
    longestStreak: 24,
    br:     { kd: "4.20", wins: 46, gamesPlayed: 382, top10: 260, avgKills: "5.8", winRate: "12.0" },
    mp:     { kd: "3.80", wins: 174, gamesPlayed: 284, winRate: "61.0", scorePerGame: 4200 },
    ranked: { kd: "3.80", wins: 34, gamesPlayed: 63, winRate: "54.0" },
  };
}
 
// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ CODM Tracker Backend en ligne sur le port ${PORT}`);
});
 
