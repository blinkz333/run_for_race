// =====================================================
// "Add to Home Screen" banner - on phones, the menu shows a small banner
// at the bottom that explains how to put the game on the home screen,
// so guests can open it again with one tap (full screen, no address bar).
//   Chrome (Android):  an INSTALL button opens Chrome's own install box.
//                      If Chrome doesn't offer it, the banner says to use ⋮ instead.
//   Safari / Chrome on iPhone and iPad: says to tap Share, then Add to Home Screen
//                      (iOS has no install button that a page can open).
//   LINE (opened from a chat): can't add to the home screen, so an OPEN button
//                      opens the game in Safari / Chrome.
//   Facebook / Instagram: same problem, the banner says to open it in a browser.
// The banner never shows on computers, inside the home screen app itself,
// or after the player closes it with X.
// =====================================================

import { GameState } from "./game.js";

const STORAGE_KEY = "runToMyLove.installBannerClosed";
const CHECK_INTERVAL = 300; // milliseconds between checks of the game screen
const SHOW_DELAY = 300; // milliseconds on the menu before the banner slides in

// iOS "Share" icon: an arrow going up out of a box (the box is drawn in style.css)
const SHARE_ICON = '<span class="install-share" aria-label="Share">↑</span>';

export function startInstallBanner(game) {
  const browser = detectBrowser();
  if (!browser || isHomeScreenApp() || wasClosed()) return;

  let installPrompt = null; // Chrome's install box, when Chrome offers one
  const banner = createBanner();
  document.body.appendChild(banner.element);
  showInstructions();

  // Chrome (Android) offers its own install box: show an INSTALL button for it
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // keep Chrome's own mini bar away; our button opens the box
    installPrompt = event;
    showInstructions();
  });
  window.addEventListener("appinstalled", () => close(false));

  banner.action.addEventListener("click", async () => {
    if (browser === "line") {
      location.href = externalBrowserUrl();
      return;
    }
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null; // Chrome's box can only be opened once
    if (outcome === "accepted") close(true);
    else showInstructions();
  });
  banner.close.addEventListener("click", () => close(true));

  // Taps on the banner are for the banner only (not START GAME, not full screen)
  for (const type of ["pointerdown", "pointerup"]) {
    banner.element.addEventListener(type, (event) => event.stopPropagation());
  }

  // Only on the menu: never covers the game while playing
  let menuSince = null;
  const timer = setInterval(() => {
    const onMenu = game.state === GameState.MENU && !game.fade;
    menuSince = onMenu ? (menuSince ?? Date.now()) : null;
    banner.element.classList.toggle(
      "is-visible",
      onMenu && Date.now() - menuSince >= SHOW_DELAY,
    );
  }, CHECK_INTERVAL);

  function showInstructions() {
    const text = getInstructions(browser, Boolean(installPrompt));
    banner.title.textContent = text.title;
    banner.steps.innerHTML = text.steps; // fixed text from this file only (has the Share icon)
    banner.action.textContent = text.button || "";
    banner.action.hidden = !text.button;
  }

  function close(remember) {
    clearInterval(timer);
    banner.element.remove();
    if (remember) rememberClosed();
  }
}

// ---------- Which browser ----------

// 'android-chrome', 'ios' (Safari or Chrome on iPhone / iPad), 'line', 'in-app' or null (no banner)
function detectBrowser() {
  const agent = navigator.userAgent;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (!isTouch) return null; // computers: no home screen
  if (/\bLine\//i.test(agent)) return "line";
  if (/FBAN|FBAV|Instagram/i.test(agent)) return "in-app";
  const isIOS =
    /iPhone|iPad|iPod/.test(agent) ||
    (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (
    /Android/.test(agent) &&
    /Chrome\//.test(agent) &&
    !/SamsungBrowser|EdgA|OPR\//.test(agent)
  )
    return "android-chrome";
  return null; // other browsers: not supported (Chrome and Safari only)
}

// Opened from the home screen icon: already "installed"
function isHomeScreenApp() {
  return (
    navigator.standalone === true ||
    window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)")
      .matches
  );
}

function getInstructions(browser, canInstall) {
  if (browser === "line") {
    return {
      title: "เปิดใน Chrome หรือ Safari",
      steps: "ใน LINE เพิ่มเกมไว้หน้าจอโฮมไม่ได้ กดปุ่มนี้เพื่อเปิดใน browser",
      button: "เปิด",
    };
  }
  if (browser === "in-app") {
    return {
      title: "เปิดใน Chrome หรือ Safari",
      steps:
        "แตะ <b>•••</b> แล้วเลือก <b>เปิดในเบราว์เซอร์</b> (Open in browser) จะเพิ่มเกมไว้หน้าจอโฮมได้",
    };
  }
  if (browser === "ios") {
    return {
      title: "เพิ่มเกมไว้หน้าจอโฮม เล่นเต็มจอ",
      steps: `แตะ ${SHARE_ICON} แชร์ (หรือ <b>•••</b> แล้วแชร์) แล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b> (Add to Home Screen)`,
    };
  }
  if (canInstall) {
    return {
      title: "ติดตั้งเกมไว้หน้าจอหลัก",
      steps: "กดครั้งเดียว เปิดเล่นเต็มจอได้ทันที",
      button: "ติดตั้ง",
    };
  }
  return {
    title: "เพิ่มเกมไว้หน้าจอหลัก เล่นเต็มจอ",
    steps:
      "แตะ <b>⋮</b> มุมขวาบน แล้วเลือก <b>เพิ่มลงในหน้าจอหลัก</b> (Add to Home screen)",
  };
}

// LINE opens a link in the phone's own browser when it ends with openExternalBrowser=1
function externalBrowserUrl() {
  const url = new URL(location.href);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}

// ---------- Banner ----------

function createBanner() {
  const element = document.createElement("div");
  element.id = "install-banner";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-label", "Add to Home Screen");

  const icon = document.createElement("div");
  icon.className = "install-icon"; // the game's icon (picture set in style.css)

  const text = document.createElement("div");
  text.className = "install-text";
  const title = document.createElement("p");
  title.className = "install-title";
  const steps = document.createElement("p");
  steps.className = "install-steps";
  text.append(title, steps);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "install-action";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "install-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";

  element.append(icon, text, action, close);
  return { element, title, steps, action, close };
}

// The X is remembered on this phone (if the browser allows saving)
function wasClosed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberClosed() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // private mode: the banner just comes back next time
  }
}
