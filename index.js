const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "CODM Tracker Backend is running 🎮" });
});

// ─── GET STATS BY ACTIVISION ID ───────────────────────────────────────────────
// Example: GET /stats/GhostSniper%231234567
app.get("/stats/:activisionId", async (req, res) => {
  const { activisionId } = req.params;

  try {
    // Decode the Activision ID (e.g. GhostSniper#1234567)
    const decoded = decodeURIComponent(activisionId);

    // Call the unofficial COD stats API
    const response = await axios.get(
      `https://call-of-duty-modern-warfare.p.rapidapi.com/warzone/${encodeURIComponent(decoded)}/mp`,
      {
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "call-of-duty-modern-warfare.p.rapidapi.com",
        },
      }
    );

    const data = response.data;

    // Format the response for our app
    const stats = {
      username: decoded,
      level: data.level || 0,
      kd: data.lifetime?.all?.properties?.kdRatio?.toFixed(2) || "0.00",
      wins: data.lifetime?.all?.properties?.wins || 0,
      kills: data.lifetime?.all?.properties?.kills || 0,
      deaths: data.lifetime?.all?.properties?.deaths || 0,
      winRate: (
        ((data.lifetime?.all?.properties?.wins || 0) /
          (data.lifetime?.all?.properties?.gamesPlayed || 1)) *
        100
      ).toFixed(1),
      gamesPlayed: data.lifetime?.all?.properties?.gamesPlayed || 0,
      avgKills: data.lifetime?.all?.properties?.killsPerGame?.toFixed(1) || "0.0",
      headshots: data.lifetime?.all?.properties?.headshots || 0,
      accuracy: (
        (data.lifetime?.all?.properties?.accuracy || 0) * 100
      ).toFixed(1),
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error fetching stats:", error.message);

    // If API fails, return mock data so the app still works
    res.json({
      success: false,
      message: "Stats temporairement indisponibles",
      stats: getMockStats(decodeURIComponent(activisionId)),
    });
  }
});

// ─── MOCK STATS FALLBACK ──────────────────────────────────────────────────────
function getMockStats(username) {
  return {
    username,
    level: 87,
    kd: "4.20",
    wins: 46,
    kills: 12840,
    deaths: 3057,
    winRate: "12.0",
    gamesPlayed: 847,
    avgKills: "5.8",
    headshots: 3210,
    accuracy: "28.4",
  };
}

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ CODM Tracker Backend running on port ${PORT}`);
});
