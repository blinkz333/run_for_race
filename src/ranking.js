// =====================================================
// Ranking page - shows each player's best score from the Google Sheet,
// for a big screen at the wedding. It asks the Apps Script (SCORE_API_URL)
// for the ranking every few seconds, so new scores appear by themselves.
//   ranking.html?limit=20    show 20 players (1 - 20, default 10)
//   ranking.html?refresh=15  ask every 15 seconds (5 - 300, default 10)
// =====================================================

import { CONFIG } from "./config.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20; // more than this won't fit on one screen (the Apps Script can send up to 50)
const DEFAULT_REFRESH = 10; // seconds
const MIN_REFRESH = 5;
const MAX_REFRESH = 300;
const REQUEST_TIMEOUT = 15000; // milliseconds
const PODIUM_SIZE = 1; // only the winner stands on the podium
const ROWS_PER_COLUMN = 9; // more places than this go into a second column ...
const MAX_COLUMNS = 2; // ... and after that the rows get smaller (names stay readable)
const NEW_TIME = 30000; // milliseconds a new or better score keeps its NEW! badge

const params = new URLSearchParams(location.search);
const limit = clampInt(params.get("limit"), 1, MAX_LIMIT, DEFAULT_LIMIT);
const refreshSeconds = clampInt(
  params.get("refresh"),
  MIN_REFRESH,
  MAX_REFRESH,
  DEFAULT_REFRESH,
);

const elements = {
  couple: document.getElementById("couple"),
  title: document.getElementById("title"),
  podium: document.getElementById("podium"),
  list: document.getElementById("list"),
  message: document.getElementById("message"),
  live: document.getElementById("live"),
  status: document.getElementById("status"),
  stats: document.getElementById("stats"),
};

// name key -> best score seen so far, so new and better scores can be marked
let knownScores = null;
const newUntil = new Map(); // name key -> time the NEW! badge ends

elements.couple.textContent = `${CONFIG.GROOM_NAME} ♥ ${CONFIG.BRIDE_NAME}`;
elements.title.textContent = CONFIG.GAME_TITLE;

if (CONFIG.SCORE_API_URL.trim() === "") {
  showMessage(
    "SCORE_API_URL in src/config.js is empty, so there is no ranking to show.",
  );
  setStatus("OFFLINE", false);
} else {
  refresh();
  setInterval(refresh, refreshSeconds * 1000);
}

// ---------- Loading ----------

async function refresh() {
  try {
    const data = await fetchRanking();
    render(data);
    setStatus(`LIVE · UPDATED ${formatClock(new Date())}`, true);
  } catch (error) {
    // Keep showing the last ranking; the next refresh tries again
    setStatus("RECONNECTING...", false);
  }
}

async function fetchRanking() {
  const url = new URL(CONFIG.SCORE_API_URL.trim());
  url.searchParams.set("limit", String(limit));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok || !Array.isArray(data.top)) throw new Error("bad reply");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Drawing ----------

function render(data) {
  const players = data.top.slice(0, limit);
  markNewScores(players);

  // The winner on the podium (an empty place stays until someone plays)
  elements.podium.replaceChildren(
    ...Array.from({ length: PODIUM_SIZE }, (_, i) =>
      makePodiumPlace(i + 1, players[i]),
    ),
  );

  // Everyone else (2nd and down) in the list
  const rest = players.slice(PODIUM_SIZE);
  const columns = Math.min(
    MAX_COLUMNS,
    Math.max(1, Math.ceil(rest.length / ROWS_PER_COLUMN)),
  );
  const rows = Math.max(ROWS_PER_COLUMN, Math.ceil(rest.length / columns));
  elements.list.style.setProperty("--columns", columns);
  elements.list.style.setProperty("--rows", rows);
  elements.list.style.setProperty("--row-scale", ROWS_PER_COLUMN / rows); // smaller text when there are more rows
  elements.list.classList.toggle("is-columns", columns > 1);
  elements.list.replaceChildren(...rest.map(makeRow));
  elements.list.hidden = rest.length === 0;

  if (players.length === 0) showMessage("No scores yet. Be the first to play!");
  else hideMessage();

  elements.stats.textContent = `${formatNumber(data.players || 0)} PLAYERS · ${formatNumber(data.runs || 0)} RUNS`;
}
function makePodiumPlace(rank, player) {
  const place = element("div", "podium-place");
  place.dataset.rank = String(rank);
  if (!player) place.classList.add("is-empty");
  if (player && isNew(player)) place.classList.add("is-new");

  place.append(
    element("div", "podium-medal", String(rank)),
    element("div", "podium-name", player ? player.name : "-"),
    element("div", "podium-score", player ? formatNumber(player.score) : "0"),
    element("div", "podium-detail", player ? describe(player) : ""),
    element("div", "podium-step"),
  );
  if (player && isNew(player))
    place
      .querySelector(".podium-name")
      .append(element("span", "new-badge", "NEW!"));
  return place;
}

function makeRow(player) {
  const row = element("li", "ranking-row");
  if (isNew(player)) row.classList.add("is-new");
  const name = element("span", "row-name", player.name);
  if (isNew(player)) name.append(element("span", "new-badge", "NEW!"));
  row.append(
    element("span", "row-rank", String(player.rank)),
    name,
    element("span", "row-detail", describe(player)),
    element("span", "row-score", formatNumber(player.score)),
  );
  return row;
}

// Names are put in with textContent, never as HTML, so a name can't break the page
function element(tag, className, text = "") {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

// ---------- New scores ----------

// A name that wasn't there before, or has a better score than last time, is NEW
// for NEW_TIME. Nothing is NEW on the very first load (the page just opened).
function markNewScores(players) {
  const now = Date.now();
  const scores = new Map(
    players.map((player) => [nameKey(player.name), player.score]),
  );
  if (knownScores) {
    for (const [key, score] of scores) {
      const before = knownScores.get(key);
      if (before === undefined || score > before)
        newUntil.set(key, now + NEW_TIME);
    }
  }
  knownScores = scores;
  for (const [key, until] of newUntil) if (until <= now) newUntil.delete(key);
}

function isNew(player) {
  return newUntil.has(nameKey(player.name));
}

// Same rule as the Apps Script: capital letters and spaces don't matter
function nameKey(name) {
  return String(name).toLowerCase().replace(/\s+/g, "");
}

// ---------- Text ----------

function describe(player) {
  return `LV ${player.level} · ${formatDuration(player.seconds)}`;
}

function formatNumber(value) {
  return Math.floor(Number(value) || 0).toLocaleString("en-US");
}

// 258 -> "4:18"
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function formatClock(date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setStatus(text, online) {
  elements.status.textContent = text;
  elements.live.classList.toggle("is-offline", !online);
}

function showMessage(text) {
  elements.message.textContent = text;
  elements.message.hidden = false;
}

function hideMessage() {
  elements.message.hidden = true;
}

function clampInt(value, min, max, fallback) {
  const number = parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
