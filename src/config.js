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
  SMASH_SCORE: 100, // each obstacle smashed while a power-up is on

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

  // ----- Difficulty (goes up every LEVEL_SCORE points) -----
  // Level 1 = speed 1.0x. Every SPEED_LEVELS levels the speed jumps up by SPEED_STEP
  // (a big step you can clearly feel). Every level: obstacle gap -SPAWN_STEP,
  // and power-ups come less often (see POWERUP_GAP_STEP)
  LEVEL_SCORE: 3000, // points per level (3,000 = level 2, 6,000 = level 3, ...)
  SPEED_LEVELS: 2, // the speed goes up at level 3, 5, 7, 9, ...
  SPEED_STEP: 0.2, // level 3 = 1.2x, level 5 = 1.4x, level 11 = 2x, level 21 = 3x, ... (no top speed)
  SPAWN_STEP: 0.015, // level 2 = 0.985x gap, level 11 = 0.85x, level 21 = 0.7x, ...
  MIN_SPAWN: 0.5, // ... down to 0.5x (from level 35)
  MIN_SPAWN_TIME: 0.8, // seconds of the groom's time: obstacles never come closer, so he can always land in between
  // The groom jumps, slides and runs faster at higher speed: speed level ^ JUMP_SPEEDUP times faster.
  // 1 = a jump always covers the same distance on screen (so obstacles can stand much closer),
  // 0 = he never gets faster (obstacles must be far apart at high speed).
  JUMP_SPEEDUP: 0.5,
  // Groups: 2 - 4 obstacles side by side that one jump (or one slide) gets past.
  // They start once the level is fast enough, and get more common and tighter as it speeds up.
  GROUP_CHANCE_STEP: 0.3, // chance of a group for every 1x of speed above 1x (2x = 30%, 3x = 60%, ...)
  GROUP_MAX_CHANCE: 0.7, // ... never more than 70%
  GROUP_MAX_SIZE: 4, // most obstacles in one group (fewer fit at low speed)

  // ----- Power-ups (Magnum = giant, Regency = speed boost) -----
  // While one is on, the groom cannot be hurt and smashes obstacles away
  POWERUP_DURATION: 3, // seconds
  POWERUP_GAP_MIN: 6, // seconds of running between two power-ups (at level 1, any speed)
  POWERUP_GAP_MAX: 10,
  POWERUP_GAP_STEP: 0.15, // each level makes that gap longer: level 2 = 1.15x, level 3 = 1.3x, ...
  POWERUP_GAP_MAX_SCALE: 2.5, // ... up to 2.5x (15 - 25 seconds, from level 11)
  POWERUP_FIRST_DELAY: 0.6, // the first one comes sooner (x the normal gap)
  POWERUP_CHAIN_CHANCE: 0.3, // chance (at level 1) that another one shows up while a power-up is still on
  POWERUP_CHAIN_STEP: 0.05, // that chance drops this much per level (none from level 7)
  POWERUP_CONSUME_TIME: 0.6, // seconds the groom spends eating the Magnum / chugging the Regency
  GIANT_SCALE: 2, // Magnum: the groom grows this many times bigger
  BOOST_SPEED: 1.8, // Regency: the world runs this many times faster
  MAX_BOOST_SPEED: 3.6, // ... but never faster than 3.6x the base speed (from level 27 the boost adds no speed)
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
    CARPET_DARK: "#7d5a3a", // carpet pattern: only a little lighter than CARPET, so it doesn't flicker when scrolling
    MARBLE: "#d8c09a",
    MARBLE_DARK: "#c4a77c",
    PETAL: "#f28bb0",
    PETAL_WHITE: "#d9466a",
    TEXT: "#fff1b8",
    TEXT_SHADOW: "#3d0c19",
  }),
});
