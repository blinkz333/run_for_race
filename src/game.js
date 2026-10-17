// =====================================================
// Game - owns the game loop, input and the game state.
// =====================================================

import { CONFIG } from "./config.js";
import { Renderer, START_BUTTON, SOUND_BUTTON } from "./renderer.js";
import { Player } from "./player.js";
import { ObstacleManager } from "./obstacle.js";
import { HeartManager, ItemKind } from "./collectible.js";
import {
  PowerUpManager,
  PowerUpType,
  POWERUP_SPRITES,
  drawSpeedLines,
  drawConsume,
} from "./powerup.js";
import { Effects } from "./effects.js";
import { view } from "./view.js";
import { SoundManager } from "./audio.js";
import { Hud, POPUP_DURATION } from "./hud.js";
import { Screens, getGameOverLayout } from "./screens.js";
import {
  NameDialog,
  SaveStatus,
  isScoreBoardEnabled,
  makeRunId,
  sendScore,
} from "./scoreboard.js";

export const GameState = Object.freeze({
  BOOT: "BOOT",
  MENU: "MENU",
  PLAYING: "PLAYING",
  GAME_OVER: "GAME_OVER",
});

const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"];
const SLIDE_KEYS = ["ArrowDown", "KeyS"];
const START_KEYS = ["Space", "Enter"];
const MENU_KEYS = ["Escape"];
const MUTE_KEY = "KeyM";
const GAME_KEYS = [
  ...new Set([...JUMP_KEYS, ...SLIDE_KEYS, ...START_KEYS, ...MENU_KEYS]),
];

// The sound button is small, so taps a little outside it still count (pixels)
const SOUND_BUTTON_PADDING = 6;

// Phone held upright: the "turn your phone" hint covers the game, so taps are ignored
const PORTRAIT_TOUCH = window.matchMedia(
  "(orientation: portrait) and (pointer: coarse)",
);

// A quick tap still lights the touch button for this long (seconds)
const BUTTON_FLASH_TIME = 0.12;

// Hit feedback
const BLINK_RATE = 6; // groom blinks this many times per second while invulnerable (faster tires the eyes)
const SHAKE_DURATION = 0.25; // seconds
const SHAKE_STRENGTH = 2; // pixels
const HURT_FLASH_DURATION = 0.2; // seconds

// Wait a moment before Game Over accepts input, so a panicked tap does not skip it
const RETRY_DELAY = 0.6; // seconds

// Screen changes: fade to dark, switch, fade back in
const FADE_TIME = 0.3; // seconds for each half
const FADE_STEPS = 6; // the fade moves in a few hard steps, like an old console
const FADE_COLOR = "#1e0710";

// A speed-up takes this many seconds (short, so it is easy to feel)
const SPEED_RAMP_TIME = 0.5;
// The world never moves more than this many pixels in one update step
const MAX_STEP_DISTANCE = 6;

// Power-ups
const BOOST_EASE_TIME = 0.25; // the Regency boost kicks in (and wears off) this fast
const POWERUP_WARNING = 0.6; // the groom blinks for the last seconds of a power-up
const POWERUP_CATCH_ZONE = 30; // power-ups this close to the right edge clear the hearts under them
const AFTERIMAGES = [
  { offset: 7, alpha: 0.35 },
  { offset: 14, alpha: 0.15 },
]; // faded copies of the groom behind him during the boost

// Score board: what the SAVE SCORE button says
const SAVE_LABELS = {
  [SaveStatus.IDLE]: "SAVE SCORE",
  [SaveStatus.SAVING]: "SAVING...",
  [SaveStatus.SAVED]: "SAVED!",
  [SaveStatus.FAILED]: "TRY AGAIN",
};
const SAVE_KEY = "Enter";

const POWERUP_INFO = {
  [PowerUpType.MAGNUM]: {
    banner: "MAGNUM - GIANT!",
    consumeSound: "chomp",
    sound: "giant",
  },
  [PowerUpType.REGENCY]: {
    banner: "REGENCY - SPEED BOOST!",
    consumeSound: "gulp",
    sound: "boost",
  },
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.renderer = new Renderer(this.ctx);
    this.player = new Player();
    this.obstacles = new ObstacleManager();
    this.hearts = new HeartManager();
    this.powerUps = new PowerUpManager();
    this.effects = new Effects();
    this.audio = new SoundManager();
    this.hud = new Hud(this.renderer);
    this.screens = new Screens(this.renderer);
    this.nameDialog = new NameDialog();

    this.state = GameState.BOOT;
    this.scrollX = 0; // how far the world has scrolled (pixels)
    this.lastScrollX = 0; // scrollX on the previous frame (for the effects)
    this.playerWasSliding = false; // for the slide sound
    this.speed = CONFIG.OBSTACLE_SPEED; // speed for the current level (pixels per second)
    this.worldSpeed = this.speed; // what the world really scrolls at (level speed x boost)
    this.time = 0; // seconds since the game opened (for UI animation)
    this.playTime = 0; // seconds since the current run started
    this.lastTime = 0;

    // Score and level (the game gets faster every CONFIG.LEVEL_SCORE points)
    this.score = 0;
    this.heartsCollected = 0;
    this.pipoCollected = 0;
    this.yumyumCollected = 0;
    this.level = 1;
    this.levelText = "";
    this.levelAge = Infinity; // seconds since the last "SPEED UP" banner appeared
    this.popups = []; // floating "+10" / "+20" texts

    // Power-ups: seconds left for each (0 = off)
    this.giantTimer = 0;
    this.boostTimer = 0;
    this.boostFactor = 1; // eases between 1 and CONFIG.BOOST_SPEED
    this.consume = null; // { type, time } while eating / chugging a power-up (it starts after)

    // Score board (Google Sheet)
    this.runId = ""; // a new id every run, so a retried save is never counted twice
    this.saveStatus = SaveStatus.IDLE;
    this.saveName = ""; // the name this run was saved under

    // Lives and hit feedback
    this.lives = CONFIG.STARTING_LIVES;
    this.invulnerableTimer = 0;
    this.shakeTimer = 0;
    this.hurtFlashTimer = 0;

    this.stateTime = 0; // seconds since the current state started

    // Screen fade: { action, time, switched } while fading, otherwise null
    this.fade = null;

    // Touch buttons: which pointer is holding which action, plus a short flash per tap
    this.heldPointers = new Map(); // pointerId -> 'jump' | 'slide'
    this.buttonFlash = { jump: 0, slide: 0 };

    // FPS counter (debug)
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTimer = 0;

    this.loop = this.loop.bind(this);
    this.setupInput();
  }

  setupInput() {
    window.addEventListener("keydown", (event) => {
      if (this.nameDialog.isOpen()) return; // typing a name: every key goes to the name box
      if (event.code === MUTE_KEY && !event.repeat) {
        this.audio.toggleMute();
        return;
      }
      if (!GAME_KEYS.includes(event.code)) return;
      event.preventDefault(); // stop the page from scrolling
      if (event.repeat) return; // ignore auto-repeat when a key is held
      if (this.fade) return; // the screen is changing

      const isStart = START_KEYS.includes(event.code);
      const isMenu = MENU_KEYS.includes(event.code);

      if (this.state === GameState.MENU) {
        if (isStart) this.fadeTo(() => this.startGame());
      } else if (this.state === GameState.PLAYING) {
        if (JUMP_KEYS.includes(event.code)) this.player.requestJump();
        if (SLIDE_KEYS.includes(event.code)) this.player.requestSlide();
      } else if (this.state === GameState.GAME_OVER) {
        if (event.code === SAVE_KEY && this.canSaveScore()) this.saveScore();
        else if (isStart) this.retry();
        if (isMenu) this.backToMenu();
      }
    });

    // Mouse / touch / pen
    window.addEventListener(
      "pointerdown",
      (event) => {
        if (this.nameDialog.isOpen()) return; // the name box handles its own taps
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        if (PORTRAIT_TOUCH.matches) return;

        // The sound button works on every screen, and is checked first
        // so tapping it during a run does not also jump
        const point = this.toGamePoint(event);
        if (pointInRect(point, SOUND_BUTTON, SOUND_BUTTON_PADDING)) {
          this.audio.toggleMute();
          return;
        }
        if (this.fade) return; // the screen is changing

        // Menu and Game Over buttons sit in the centered 480px area
        const uiPoint = { x: point.x - view.offsetX, y: point.y };
        if (this.state === GameState.MENU) {
          if (pointInRect(uiPoint, START_BUTTON))
            this.fadeTo(() => this.startGame());
        } else if (this.state === GameState.PLAYING) {
          // The whole half of the screen works, not only the drawn button
          const action = this.getTouchAction(point);
          if (action === "jump") this.player.requestJump();
          else this.player.requestSlide();
          this.heldPointers.set(event.pointerId, action);
          this.buttonFlash[action] = BUTTON_FLASH_TIME;
        } else if (this.state === GameState.GAME_OVER) {
          const layout = getGameOverLayout(isScoreBoardEnabled());
          if (layout.save && pointInRect(uiPoint, layout.save))
            this.saveScore();
          if (pointInRect(uiPoint, layout.retry)) this.retry();
          if (pointInRect(uiPoint, layout.menu)) this.backToMenu();
        }
      },
      { passive: false },
    );

    // Release the button when the finger lifts or leaves the screen
    const releasePointer = (event) => this.heldPointers.delete(event.pointerId);
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);

    // Stop the long-press menu on mobile (but let the name box paste)
    window.addEventListener("contextmenu", (event) => {
      if (!this.nameDialog.isOpen()) event.preventDefault();
    });
  }

  // Converts a pointer position on the page into game coordinates (view.width x 270)
  toGamePoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * view.width,
      y: ((event.clientY - rect.top) / rect.height) * CONFIG.CANVAS_HEIGHT,
    };
  }

  // Which action a tap triggers, based on TOUCH_JUMP_SIDE in config.js
  getTouchAction(point) {
    const isLeft = point.x < view.width / 2;
    const jumpOnLeft = CONFIG.TOUCH_JUMP_SIDE !== "right";
    return isLeft === jumpOnLeft ? "jump" : "slide";
  }

  // Button is lit while a finger holds it, or briefly after a quick tap
  isButtonPressed(action) {
    if (this.buttonFlash[action] > 0) return true;
    for (const held of this.heldPointers.values()) {
      if (held === action) return true;
    }
    return false;
  }

  // ---------- State changes ----------

  setState(state) {
    this.state = state;
    this.stateTime = 0;
    this.heldPointers.clear();
  }
  start() {
    // BOOT finished -> show the start screen
    this.setState(GameState.MENU);
    this.audio.playMusic("wedding"); // starts after the first tap / key press
    this.fade = { action: null, time: FADE_TIME, switched: true }; // fade in from dark
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  startGame() {
    this.player.reset();
    this.player.startRunning();
    this.obstacles.reset();
    this.hearts.reset();
    this.powerUps.reset();
    this.effects.reset();
    this.speed = CONFIG.OBSTACLE_SPEED;
    this.worldSpeed = this.speed;
    this.giantTimer = 0;
    this.boostTimer = 0;
    this.boostFactor = 1;
    this.consume = null;
    this.playTime = 0;
    this.score = 0;
    this.heartsCollected = 0;
    this.pipoCollected = 0;
    this.yumyumCollected = 0;
    this.level = 1;
    this.levelAge = Infinity;
    this.popups = [];
    this.lives = CONFIG.STARTING_LIVES;
    this.invulnerableTimer = 0;
    this.shakeTimer = 0;
    this.hurtFlashTimer = 0;
    this.buttonFlash.jump = 0;
    this.buttonFlash.slide = 0;
    this.runId = makeRunId();
    this.saveStatus = SaveStatus.IDLE;
    this.saveName = "";
    this.setState(GameState.PLAYING);
    this.audio.playMusic("run");
  }

  // Game Over -> play again (after a short delay)
  retry() {
    if (this.stateTime < RETRY_DELAY) return;
    this.fadeTo(() => this.startGame());
  }

  // Game Over -> start screen (after a short delay)
  backToMenu() {
    if (this.stateTime < RETRY_DELAY) return;
    this.fadeTo(() => this.showMenu());
  }

  showMenu() {
    this.player.reset();
    this.obstacles.reset();
    this.hearts.reset();
    this.powerUps.reset();
    this.effects.reset();
    this.giantTimer = 0;
    this.boostTimer = 0;
    this.boostFactor = 1;
    this.consume = null;
    this.popups = [];
    this.setState(GameState.MENU);
    this.audio.playMusic("wedding");
  }

  gameOver() {
    this.invulnerableTimer = 0;
    this.giantTimer = 0;
    this.boostTimer = 0;
    this.boostFactor = 1;
    this.consume = null;
    this.levelAge = Infinity;
    this.player.reset();
    this.player.passOut(); // lies on the carpet, drunk, hugging a Regency bottle
    this.setState(GameState.GAME_OVER);
    this.audio.stopMusic();
    this.audio.play("gameOver");
  }

  // ---------- Score board ----------

  // SAVE SCORE works once per run (and again if saving failed)
  canSaveScore() {
    if (!isScoreBoardEnabled() || this.stateTime < RETRY_DELAY || this.fade)
      return false;
    return (
      this.saveStatus === SaveStatus.IDLE ||
      this.saveStatus === SaveStatus.FAILED
    );
  }

  // Asks for a name, then sends the run to the Google Sheet.
  // TRY AGAIN re-sends under the same name without asking again.
  async saveScore() {
    if (!this.canSaveScore() || this.nameDialog.isOpen()) return;
    this.audio.play("click");
    let name = this.saveStatus === SaveStatus.FAILED ? this.saveName : "";
    if (!name) name = await this.nameDialog.open(this.score);
    if (!name || this.state !== GameState.GAME_OVER) return; // cancelled

    const runId = this.runId;
    this.saveName = name;
    this.saveStatus = SaveStatus.SAVING;
    const saved = await sendScore({
      runId,
      name,
      score: Math.floor(this.score),
      hearts: this.heartsCollected,
      pipo: this.pipoCollected,
      yumyum: this.yumyumCollected,
      level: this.level,
      seconds: Math.round(this.playTime),
    });
    if (runId !== this.runId) return; // a new run already started; the save still went through
    this.saveStatus = saved ? SaveStatus.SAVED : SaveStatus.FAILED;
    this.audio.play(saved ? "yumyum" : "hit");
  }

  // ---------- Screen fade ----------

  // Fades to dark, runs `action` (the screen change), then fades back in
  fadeTo(action) {
    if (this.fade) return;
    this.fade = { action, time: 0, switched: false };
    this.audio.play("click");
  }

  updateFade(dt) {
    if (!this.fade) return;
    this.fade.time += dt;
    if (!this.fade.switched && this.fade.time >= FADE_TIME) {
      this.fade.switched = true;
      this.fade.action?.();
    }
    if (this.fade.time >= FADE_TIME * 2) this.fade = null;
  }

  drawFade() {
    if (!this.fade) return;
    const { time } = this.fade;
    const amount = time < FADE_TIME ? time / FADE_TIME : 2 - time / FADE_TIME; // 0 -> 1 -> 0
    const stepped = Math.ceil(clamp01(amount) * FADE_STEPS) / FADE_STEPS;
    if (stepped <= 0) return;
    this.ctx.save();
    this.ctx.globalAlpha = stepped;
    this.ctx.fillStyle = FADE_COLOR;
    this.ctx.fillRect(0, 0, view.width, CONFIG.CANVAS_HEIGHT);
    this.ctx.restore();
  }

  // ---------- Score ----------

  addScore(points) {
    this.score += points;
  }

  // Picks up every heart, Pipo and Yum Yum pack the groom touches
  collectHearts() {
    const collected = this.hearts.collect(this.player.getHitbox());
    for (const item of collected) {
      this.effects.heartBurst(
        item.x + item.width / 2,
        item.y + item.height / 2,
      );
      this.popups.push({
        x: item.x + item.width / 2,
        y: item.y - 4,
        age: 0,
        text: `+${item.score}`,
      });
      if (item.kind === ItemKind.YUMYUM) this.yumyumCollected += 1;
      else if (item.kind === ItemKind.PIPO) this.pipoCollected += 1;
      else this.heartsCollected += 1;
      this.audio.play(item.kind === ItemKind.YUMYUM ? "yumyum" : "heart");
      this.addScore(item.score);
    }
  }

  // ---------- Power-ups ----------

  // Safe while eating / chugging too, so the animation can't be interrupted by a hit
  isPoweredUp() {
    return this.giantTimer > 0 || this.boostTimer > 0 || this.consume !== null;
  }

  // Seconds left on the power-up that ends last
  powerUpTimeLeft() {
    return Math.max(this.giantTimer, this.boostTimer);
  }

  // Grabs a power-up if the groom touches one: he eats / chugs it first, then it starts
  collectPowerUp() {
    const powerUp = this.powerUps.collect(this.player.getHitbox());
    if (!powerUp) return;
    if (this.consume) this.startPowerUp(this.consume.type); // still busy with the last one: finish it now
    this.consume = { type: powerUp.type, time: 0 };
    const info = POWERUP_INFO[powerUp.type];
    this.levelText = info.banner;
    this.levelAge = 0;
    this.invulnerableTimer = 0;
    this.effects.heartBurst(
      powerUp.x + powerUp.width / 2,
      powerUp.y + powerUp.height / 2,
    );
    this.audio.play(info.consumeSound);
    this.powerUps.onCollected();
  }

  // The power-up kicks in (grabbing the same one again restarts its time)
  startPowerUp(type) {
    if (type === PowerUpType.MAGNUM) {
      this.giantTimer = CONFIG.POWERUP_DURATION;
      this.player.setGiant(true);
    } else {
      this.boostTimer = CONFIG.POWERUP_DURATION;
    }
    this.audio.play(POWERUP_INFO[type].sound);
  }

  // Counts the power-ups down; when the last one ends the groom gets a moment of safety
  updatePowerUps(dt) {
    if (this.consume) {
      this.consume.time += dt;
      if (this.consume.time >= CONFIG.POWERUP_CONSUME_TIME) {
        this.startPowerUp(this.consume.type);
        this.consume = null;
      }
    }

    const wasPoweredUp = this.isPoweredUp();
    if (this.giantTimer > 0) {
      this.giantTimer = Math.max(0, this.giantTimer - dt);
      if (this.giantTimer === 0) this.player.setGiant(false);
    }
    if (this.boostTimer > 0)
      this.boostTimer = Math.max(0, this.boostTimer - dt);

    if (wasPoweredUp && !this.isPoweredUp()) {
      this.invulnerableTimer = CONFIG.POWERUP_GRACE;
      this.audio.play("powerDown");
    }

    // The boost never takes the world past MAX_BOOST_SPEED (it gets smaller at high levels)
    const boostLimit =
      (CONFIG.OBSTACLE_SPEED * CONFIG.MAX_BOOST_SPEED) / this.speed;
    const boostTarget =
      this.boostTimer > 0
        ? Math.max(1, Math.min(CONFIG.BOOST_SPEED, boostLimit))
        : 1;
    this.boostFactor +=
      (boostTarget - this.boostFactor) * Math.min(1, dt / BOOST_EASE_TIME);
  }

  // While powered up, every obstacle the groom touches is knocked away
  // and is worth SMASH_SCORE points
  // (no screen shake here: with many smashes in a row it made players dizzy)
  smashObstacles() {
    let obstacle = this.obstacles.findCollision(this.player.getHitbox());
    while (obstacle) {
      obstacle.smash();
      this.effects.hitStars(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height / 2,
      );
      this.popups.push({
        x: obstacle.x + obstacle.width / 2,
        y: obstacle.y - 4,
        age: 0,
        text: `+${CONFIG.SMASH_SCORE}`,
      });
      this.addScore(CONFIG.SMASH_SCORE);
      this.audio.play("smash");
      obstacle = this.obstacles.findCollision(this.player.getHitbox());
    }
  }
  // Called when the groom touches an obstacle
  hitPlayer() {
    const player = this.player;
    this.effects.hitStars(
      player.x + player.width / 2,
      player.y + player.height / 2 - 4,
    );
    this.lives -= 1;
    this.shakeTimer = SHAKE_DURATION;
    this.hurtFlashTimer = HURT_FLASH_DURATION;
    this.audio.play("hit");

    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver();
    } else {
      this.invulnerableTimer = CONFIG.INVULNERABILITY_DURATION;
    }
  }

  // ---------- Loop ----------

  loop(now) {
    // Delta time in seconds, capped to avoid huge jumps after tab switching
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(Math.max(dt, 0), CONFIG.MAX_DELTA_TIME);

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    this.updateFade(dt);

    if (this.state === GameState.PLAYING) {
      // At high speed the world moves far in one frame, so the run is updated in
      // small steps; otherwise the groom could skip right through a thin obstacle
      const steps = Math.max(
        1,
        Math.ceil((this.worldSpeed * dt) / MAX_STEP_DISTANCE),
      );
      for (let i = 0; i < steps && this.state === GameState.PLAYING; i++) {
        this.updatePlaying(dt / steps);
      }
    } else {
      // MENU, GAME_OVER: the hall stands still, the groom breathes
      this.player.update(dt);
    }

    // Particles scroll away with the floor
    this.effects.update(dt, this.scrollX - this.lastScrollX);
    this.lastScrollX = this.scrollX;

    // Popups and the level banner animate in every state
    for (const popup of this.popups) popup.age += dt;
    this.popups = this.popups.filter((popup) => popup.age < POPUP_DURATION);
    this.levelAge += dt;

    this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - dt);

    this.fpsFrames += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }
  }

  // Speed and obstacle gap for a level (level 1 = the base values)
  getDifficulty(level = this.level) {
    const steps = level - 1;
    const speedSteps = Math.floor(steps / CONFIG.SPEED_LEVELS);
    return {
      speed: 1 + speedSteps * CONFIG.SPEED_STEP, // no top speed: it keeps going up
      spawn: Math.max(CONFIG.MIN_SPAWN, 1 - steps * CONFIG.SPAWN_STEP),
    };
  }

  // A new level every LEVEL_SCORE points, with a banner and a sound.
  // The banner only says SPEED UP when the speed really goes up.
  updateLevel() {
    const level = 1 + Math.floor(this.score / CONFIG.LEVEL_SCORE);
    if (level <= this.level) return;
    const speedUp =
      this.getDifficulty(level).speed > this.getDifficulty().speed;
    this.level = level;
    this.levelText = speedUp ? `LEVEL ${level} - SPEED UP!` : `LEVEL ${level}`;
    this.levelAge = 0;
    this.audio.play("milestone");
  }

  updatePlaying(dt) {
    this.playTime += dt;
    this.updateLevel();

    const difficulty = this.getDifficulty();
    const targetSpeed = CONFIG.OBSTACLE_SPEED * difficulty.speed;
    const maxChange =
      ((CONFIG.OBSTACLE_SPEED * CONFIG.SPEED_STEP) / SPEED_RAMP_TIME) * dt;
    this.speed += Math.max(
      -maxChange,
      Math.min(maxChange, targetSpeed - this.speed),
    );
    this.updatePowerUps(dt);
    this.worldSpeed = this.speed * this.boostFactor;

    this.scrollX += this.worldSpeed * dt;
    // The groom moves faster at higher levels, so obstacles can stand closer together
    const timeScale = this.playerTimeScale();
    this.updatePlayer(dt, timeScale);
    this.obstacles.update(dt, this.worldSpeed, {
      spawnScale: difficulty.spawn,
      spacingSpeed: this.speed / timeScale,
      speedLevel: this.speed / CONFIG.OBSTACLE_SPEED,
    });
    this.hearts.update(
      dt,
      this.worldSpeed,
      this.obstacles,
      this.worldSpeed / timeScale,
    );
    this.powerUps.update(
      dt,
      this.worldSpeed,
      this.obstacles,
      this.isPoweredUp(),
      this.level,
    );

    // A power-up that just appeared clears the hearts under it, so it stands out
    for (const powerUp of this.powerUps.items) {
      if (powerUp.x > view.width - POWERUP_CATCH_ZONE)
        this.hearts.collect(powerUp.getHitbox());
    }

    // Collision: powered up = smash, just hit = safe for a moment, otherwise ouch
    if (this.isPoweredUp()) {
      this.smashObstacles();
    } else if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    } else if (this.obstacles.findCollision(this.player.getHitbox())) {
      this.hitPlayer();
    }

    // Score: points for running, plus hearts, Pipo and Yum Yum
    if (this.state === GameState.PLAYING) {
      this.collectHearts();
      this.collectPowerUp();
      this.addScore(CONFIG.PASSIVE_SCORE_PER_SECOND * dt);
    }

    this.buttonFlash.jump = Math.max(0, this.buttonFlash.jump - dt);
    this.buttonFlash.slide = Math.max(0, this.buttonFlash.slide - dt);
  }

  // How many times faster the groom jumps / slides / runs than at level 1.
  // JUMP_SPEEDUP 1 = a jump always covers the same distance on screen, 0 = never faster.
  playerTimeScale() {
    return Math.pow(this.speed / CONFIG.OBSTACLE_SPEED, CONFIG.JUMP_SPEEDUP);
  }

  // Moves the groom and kicks up dust / sparks / sounds for what he just did
  updatePlayer(dt, timeScale = 1) {
    const player = this.player;
    const wasOnGround = player.onGround;
    const jumpsBefore = player.jumpCount;
    player.update(dt * timeScale);

    const centerX = player.x + player.width / 2;
    if (wasOnGround && !player.onGround) {
      this.effects.footPuff(centerX, 4, 0.7); // take off
      this.audio.play("jump");
    } else if (!wasOnGround && player.onGround) {
      this.effects.footPuff(centerX, 6, 1); // landing
    }
    if (player.jumpCount > jumpsBefore && jumpsBefore > 0) {
      this.effects.doubleJump(centerX, player.y + player.height);
      this.audio.play("doubleJump");
    }
    // A slide can start from a key press between frames, so compare with the last frame
    if (player.sliding && !this.playerWasSliding) this.audio.play("slide");
    this.playerWasSliding = player.sliding;
    if (player.onGround && player.running) {
      this.effects.trail(dt, player.x + 4, player.sliding);
    }
  }

  // ---------- Drawing ----------

  render() {
    const ctx = this.ctx;
    this.renderer.clear();

    // World (shakes for a moment when the groom is hit)
    ctx.save();
    if (this.shakeTimer > 0) {
      const dx = Math.round((Math.random() * 2 - 1) * SHAKE_STRENGTH);
      const dy = Math.round((Math.random() * 2 - 1) * SHAKE_STRENGTH);
      ctx.translate(dx, dy);
    }
    this.renderer.drawBackground(this.scrollX);
    drawSpeedLines(
      ctx,
      this.time,
      (this.boostFactor - 1) / (CONFIG.BOOST_SPEED - 1),
    );
    this.obstacles.draw(ctx);
    this.hearts.draw(ctx);
    this.powerUps.draw(ctx);
    const passedOut = this.state === GameState.GAME_OVER;
    if (!passedOut && this.isPlayerVisible()) this.drawPlayer();
    this.effects.draw(ctx);
    ctx.restore();

    this.hud.drawHurtFlash(this.hurtFlashTimer / HURT_FLASH_DURATION);

    if (this.state === GameState.MENU) {
      this.renderer.drawMenu(this.time);
    } else {
      this.drawRunHud();
      // Game Over: the passed-out groom is drawn on top of the dark overlay so he stays in view
      if (passedOut) this.drawPlayer();
    }

    this.renderer.drawSoundButton(this.audio.muted);
    this.drawFade(); // on top of everything
  }

  // The groom, with faded copies behind him during the speed boost,
  // and the Magnum / Regency at his mouth while he eats / chugs it
  drawPlayer() {
    const ctx = this.ctx;
    if (this.boostTimer > 0) {
      for (const image of AFTERIMAGES) {
        ctx.save();
        ctx.globalAlpha = image.alpha;
        ctx.translate(-image.offset, 0);
        this.player.draw(ctx);
        ctx.restore();
      }
    }
    this.player.draw(ctx);
    if (this.consume && this.player.flipTimer <= 0) {
      const mouth = this.player.getMouth();
      const progress = this.consume.time / CONFIG.POWERUP_CONSUME_TIME;
      drawConsume(
        ctx,
        this.consume.type,
        progress,
        mouth.x,
        mouth.y,
        this.player.scale,
      );
    }
  }

  // HUD for PLAYING and GAME_OVER
  drawRunHud() {
    // The heart that was just lost blinks while the groom is invulnerable
    this.hud.drawLives(
      this.lives,
      this.invulnerableTimer > 0 && this.isBlinkOn(),
    );
    this.hud.drawPowerUps([
      {
        sprite: POWERUP_SPRITES[PowerUpType.MAGNUM],
        left: this.giantTimer / CONFIG.POWERUP_DURATION,
      },
      {
        sprite: POWERUP_SPRITES[PowerUpType.REGENCY],
        left: this.boostTimer / CONFIG.POWERUP_DURATION,
      },
    ]);
    this.hud.drawScore(this.score);
    this.hud.drawPopups(this.popups);
    this.hud.drawBanner(this.levelText, this.levelAge);

    if (this.state === GameState.PLAYING) {
      this.renderer.drawTouchButtons({
        jump: this.isButtonPressed("jump"),
        slide: this.isButtonPressed("slide"),
      });
      this.renderer.drawHint(this.fps);
    } else if (this.state === GameState.GAME_OVER) {
      this.screens.drawGameOver(
        this.score,
        this.heartsCollected,
        this.pipoCollected,
        this.yumyumCollected,
        this.stateTime >= RETRY_DELAY,
        isScoreBoardEnabled()
          ? {
              label: SAVE_LABELS[this.saveStatus],
              enabled: this.saveStatus !== SaveStatus.SAVING,
              pressable:
                this.saveStatus === SaveStatus.IDLE ||
                this.saveStatus === SaveStatus.FAILED,
            }
          : null,
      );
    }
  }

  // Blinks on/off BLINK_RATE times per second
  isBlinkOn(timer = this.invulnerableTimer) {
    return Math.floor(timer * BLINK_RATE) % 2 === 0;
  }

  // The groom blinks while invulnerable, and when a power-up is about to end
  isPlayerVisible() {
    const timeLeft = this.powerUpTimeLeft();
    if (timeLeft > 0)
      return timeLeft > POWERUP_WARNING || this.isBlinkOn(timeLeft);
    return this.invulnerableTimer <= 0 || this.isBlinkOn();
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// padding = extra pixels around the rect that still count as inside
function pointInRect(point, rect, padding = 0) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}
