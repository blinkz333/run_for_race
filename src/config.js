// =====================================================
// Run to My Love - Game Configuration
// Change values here to customize the game.
// =====================================================

// ----- The two dates the whole game is built on (YYYY-MM-DD) -----
const RELATIONSHIP_START_DATE = "2014-03-13";
const WEDDING_DAY = "2026-11-14";

export const CONFIG = Object.freeze({
  // ----- Story / Text -----
  GAME_TITLE: "Run to My Love",
  // {years} and {days} are counted from RELATIONSHIP_START_DATE to WEDDING_DAY
  GAME_SUBTITLE: "{years} Years, {days} Days, One Love.",
  RELATIONSHIP_START_DATE,
  WEDDING_DAY,
  GROOM_NAME: "Moo",
  BRIDE_NAME: "Bee",

  // ----- Canvas (logical resolution, 16:9) -----
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 270,
  GROUND_Y: 226, // y position of the top of the ground

  // ----- Font -----
  // Pixel font in assets/fonts (loaded by style.css), monospace until it is ready
  FONT_FAMILY: "'Pixelify Sans', monospace",

  // ----- Scoring (endless: run as far as you can) -----
  PASSIVE_SCORE_PER_SECOND: 5, // points just for running
  HEART_SCORE: 10,
  PIPO_SCORE: 10, // Pipo jelly cup (many colors), mixed in with the hearts
  YUMYUM_SCORE: 20, // Yum Yum Chang Noi pack, often on the top row of a block or arc

  // ----- Health -----
  STARTING_LIVES: 3,
  INVULNERABILITY_DURATION: 1, // seconds

  // ----- Physics (pixels per second) -----
  GRAVITY: 1400,
  JUMP_FORCE: 480,
  DOUBLE_JUMP_FORCE: 460, // second jump in the air (with a front flip)
  SLIDE_DURATION: 0.6, // seconds the groom stays low when sliding
  FAST_FALL_MULTIPLIER: 3, // pressing slide in the air pulls the groom down faster

  // ----- Touch controls (phones) -----
  // 'left' = Cookie Run style (JUMP on the left, SLIDE on the right)
  // 'right' = JUMP on the right, SLIDE on the left
  TOUCH_JUMP_SIDE: "left",

  // ----- Obstacles -----
  OBSTACLE_SPEED: 150, // world scroll speed in pixels per second
  OBSTACLE_SPAWN_INTERVAL: 1.6, // seconds (base value)

  // ----- Difficulty (goes up forever, every LEVEL_SCORE points) -----
  // Level 1 = speed 1.0x. Each new level: speed +SPEED_STEP, obstacle gap -SPAWN_STEP
  // There is no top speed, so the best player is the one who survives the longest
  LEVEL_SCORE: 3000, // points per level (3,000 = level 2, 6,000 = level 3, ...)
  SPEED_STEP: 0.12, // level 2 = 1.12x, level 3 = 1.24x, ...
  SPAWN_STEP: 0.04, // level 2 = 0.96x gap, level 3 = 0.92x, ...
  MIN_SPAWN: 0.75, // obstacles never come closer than 0.75x the base gap (so they never overlap)

  // ----- Power-ups (Magnum = giant, Regency = speed boost) -----
  // While one is on, the groom cannot be hurt and smashes obstacles away
  POWERUP_DURATION: 3, // seconds
  POWERUP_GAP_MIN: 6, // seconds of running between two power-ups (at the base speed)
  POWERUP_GAP_MAX: 10,
  POWERUP_FIRST_DELAY: 0.6, // the first one comes sooner (x the normal gap)
  POWERUP_CHAIN_CHANCE: 0.3, // chance that another one shows up while a power-up is still on
  POWERUP_CONSUME_TIME: 0.6, // seconds the groom spends eating the Magnum / chugging the Regency
  GIANT_SCALE: 2, // Magnum: the groom grows this many times bigger
  BOOST_SPEED: 1.8, // Regency: the world runs this many times faster
  POWERUP_GRACE: 1, // seconds of blinking safety after a power-up ends

  // ----- Score board (Google Sheet, see apps-script/Code.gs) -----
  // Paste the Apps Script web app URL here (ends with /exec).
  // Empty = the SAVE SCORE button is hidden.
  SCORE_API_URL:
    "https://script.google.com/macros/s/AKfycbykf4wXJ7xe3brgFk2JQR7CScTwOj8X2xL-IMeb6vlHuvsEFYXfUlreIe8cXKFy5_JMVQ/exec",
  PLAYER_NAME_MAX: 20, // characters (the Apps Script cuts names at the same length)

  // ----- Audio (0.0 - 1.0) -----
  MUSIC_VOLUME: 0.4,
  SFX_VOLUME: 0.7,

  // ----- Game loop -----
  MAX_DELTA_TIME: 0.05, // cap delta time (seconds) after tab switching

  // ----- Debug -----
  SHOW_FPS: false,

  // ----- Colors (wedding hall palette) -----
  COLORS: Object.freeze({
    CEILING: "#3d0c19",
    WALL: "#7a1c32",
    WALL_PATTERN: "#8a2640",
    WAINSCOT: "#5a1124",
    WAINSCOT_PANEL: "#6b182d",
    GOLD: "#e8c26a",
    GOLD_DARK: "#b08a3e",
    GOLD_LIGHT: "#fff1b8",
    GLOW: "#ffe6a0",
    WINDOW: "#2b2856",
    WINDOW_LIGHT: "#433f7e",
    STAR: "#fff8ef",
    DRAPE: "#fbf7f2",
    DRAPE_SHADOW: "#e3d8d0",
    CRYSTAL: "#dff3ff",
    FLAME: "#ffcf5a",
    CARPET: "#503117c9",
    CARPET_DARK: "#e8d6bb",
    MARBLE: "#d8c09a",
    MARBLE_DARK: "#c4a77c",
    PETAL: "#f28bb0",
    PETAL_WHITE: "#d9466a",
    TEXT: "#fff1b8",
    TEXT_SHADOW: "#3d0c19",
  }),
});
