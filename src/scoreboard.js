// =====================================================
// Score board - asks for the player's name after Game Over and
// saves the run to a Google Sheet through an Apps Script web app.
//   NameDialog = the "Enter your name" box (built here, styled in style.css)
//   sendScore  = posts the run, retrying a few times if the network fails
// Every run has its own id, so a retry never saves the same run twice.
// =====================================================

import { CONFIG } from "./config.js";

export const SaveStatus = Object.freeze({
  IDLE: "IDLE", // not saved yet
  SAVING: "SAVING",
  SAVED: "SAVED",
  FAILED: "FAILED", // can be tried again
});

// Network retries: wait 1s, 2s, 4s between attempts
const MAX_ATTEMPTS = 4;
const FIRST_RETRY_DELAY = 1000; // milliseconds
const REQUEST_TIMEOUT = 10000; // milliseconds per attempt

// The tap that opened the box may "click" whatever lands under the finger;
// buttons ignore clicks this soon after opening
const OPEN_GUARD_TIME = 400; // milliseconds

// The last name typed is remembered on this device
const NAME_STORAGE_KEY = "runToMyLove.playerName";

export function isScoreBoardEnabled() {
  return CONFIG.SCORE_API_URL.trim() !== "";
}

// A random id for one run, e.g. "lq3x9a-4f8k2m1z"
export function makeRunId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Same rules as the Apps Script: no line breaks or control characters,
// single spaces, at most PLAYER_NAME_MAX characters
export function cleanName(name) {
  const cleaned = String(name)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, CONFIG.PLAYER_NAME_MAX).join("");
}

// ---------- Name dialog ----------

export class NameDialog {
  constructor() {
    this.build();
    this.resolve = null; // set while the dialog is open
    this.openedAt = 0;

    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.isJustOpened()) return;
      const name = cleanName(this.input.value);
      if (!name) {
        this.input.focus();
        return;
      }
      saveName(name);
      this.close(name);
    });
    this.cancelButton.addEventListener("click", () => {
      if (!this.isJustOpened()) this.close(null);
    });
    this.element.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation(); // ESC only closes the box, it doesn't also go back to the menu
      this.close(null);
    });
  }

  // Creates the box (hidden) at the end of the page:
  //   #name-dialog > #name-form > title, score, label, #name-input, CANCEL / SAVE buttons
  build() {
    this.element = makeElement("div", { id: "name-dialog", hidden: true });
    this.form = makeElement("form", { id: "name-form", autocomplete: "off" });
    this.scoreText = makeElement("p", { id: "name-score" });
    this.input = makeElement("input", {
      id: "name-input",
      type: "text",
      maxLength: CONFIG.PLAYER_NAME_MAX,
      enterKeyHint: "done",
      autocapitalize: "words",
      spellcheck: false,
      required: true,
    });
    this.cancelButton = makeElement("button", {
      id: "name-cancel",
      type: "button",
      textContent: "CANCEL",
    });

    const buttons = makeElement("div", { className: "name-buttons" });
    buttons.append(
      this.cancelButton,
      makeElement("button", { type: "submit", textContent: "SAVE" }),
    );
    this.form.append(
      makeElement("h2", { textContent: "SAVE YOUR SCORE" }),
      this.scoreText,
      makeElement("label", { htmlFor: "name-input", textContent: "Your name" }),
      this.input,
      buttons,
    );
    this.element.append(this.form);
    document.body.append(this.element);
  }

  isOpen() {
    return this.resolve !== null;
  }

  isJustOpened() {
    return performance.now() - this.openedAt < OPEN_GUARD_TIME;
  }

  // Resolves with the name, or null if the player cancels
  open(score) {
    if (this.isOpen()) return Promise.resolve(null);
    this.scoreText.textContent = `SCORE: ${Math.floor(score).toLocaleString("en-US")}`;
    this.input.value = loadName();
    this.element.hidden = false;
    this.openedAt = performance.now();
    this.input.focus();
    this.input.select();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  close(name) {
    if (!this.isOpen()) return;
    this.element.hidden = true;
    this.input.blur();
    const resolve = this.resolve;
    this.resolve = null;
    resolve(name);
  }
}

// makeElement('p', { id: 'x', textContent: 'Hi' }) = a new p element with those properties
function makeElement(tag, properties = {}) {
  return Object.assign(document.createElement(tag), properties);
}

function loadName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return ""; // private mode or storage blocked
  }
}

function saveName(name) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // not remembered, that's fine
  }
}

// ---------- Sending ----------

// run = { runId, name, score, hearts, pipo, yumyum, level, seconds }
// Resolves true when the Sheet has the run, false if every attempt failed
export async function sendScore(run) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await postOnce(run);
    if (result === "ok") return true;
    if (result === "rejected") return false; // bad data: trying again won't help
    if (attempt < MAX_ATTEMPTS)
      await wait(FIRST_RETRY_DELAY * 2 ** (attempt - 1));
  }
  return false;
}

// 'ok', 'rejected' (the script refused the data) or 'retry' (network / busy)
async function postOnce(run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    // text/plain keeps it a "simple" request, so the browser doesn't
    // send a CORS preflight (Apps Script can't answer one)
    const response = await fetch(CONFIG.SCORE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(run),
      signal: controller.signal,
    });
    if (!response.ok) return "retry";
    const data = await response.json();
    if (data.ok) return "ok";
    return data.error === "busy" ? "retry" : "rejected";
  } catch {
    return "retry"; // offline, timed out, or the answer wasn't JSON
  } finally {
    clearTimeout(timer);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
