// =====================================================
// Bot - plays the game by itself, for testing.
// Open the game with ?bot at the end of the address:
//   ?bot            start at level 1
//   ?bot&level=30   start at level 30
//   ?bot&miss=10    the bot ignores 10% of obstacles (so it can lose)
//   ?bot&human      plays like a person: needs time to react, and presses
//                   a little early or late (to see how far a player gets)
// It starts the run, plays, and presses RETRY after every Game Over.
// =====================================================

import { CONFIG } from "./config.js";
import { GameState } from "./game.js";

const JUMP_DISTANCE = 40; // pixels before a ground obstacle: jump ...
const JUMP_TIME = 0.08; // ... or this many seconds before it, when that is further (high speed)
const SLIDE_DISTANCE = 40; // pixels before a high obstacle: slide
const DOUBLE_JUMP_TIME = 0.42; // seconds (of the groom's time) before a flying / double obstacle: first jump
const DOUBLE_JUMP_SPEED = -250; // second jump once the groom has slowed to this (going up)
// Human mode
const REACTION_TIME = 0.25; // seconds from an obstacle coming on screen until the player notices it
const REACTION_SPREAD = 0.05; // ... give or take
const AIM_TIME = 0.25; // a person presses jump / slide about this long (groom's time) before an obstacle ...
const TIMING_SPREAD = 0.045; // ... give or take this much (standard deviation)
const RETRY_WAIT = 1.5; // seconds on the Game Over screen before trying again
const PANEL_REFRESH = 250; // milliseconds between updates of the stats box

export function startBot(game) {
  const params = new URLSearchParams(location.search);
  const startLevel = Math.max(1, parseInt(params.get("level"), 10) || 1);
  const missChance =
    Math.min(100, Math.max(0, parseFloat(params.get("miss")) || 0)) / 100;
  const human = params.has("human");

  const stats = {
    runs: 0,
    hits: 0,
    lastHit: "-",
    bestLevel: 0,
    lastLevel: 0,
    lastTime: 0,
  };
  const player = game.player;
  const plans = new WeakMap(); // obstacle -> how the bot will handle it

  // Every run starts at startLevel, already at that level's speed
  const startGame = game.startGame.bind(game);
  game.startGame = () => {
    startGame();
    stats.runs += 1;
    game.score = (startLevel - 1) * CONFIG.LEVEL_SCORE;
    game.updateLevel();
    game.speed = CONFIG.OBSTACLE_SPEED * game.getDifficulty().speed;
    game.worldSpeed = game.speed;
  };

  // Bot runs never go on the score board
  game.canSaveScore = () => false;

  const hitPlayer = game.hitPlayer.bind(game);
  game.hitPlayer = () => {
    const obstacle = game.obstacles.findCollision(player.getHitbox());
    stats.hits += 1;
    stats.lastHit = obstacle ? `${obstacle.type} at level ${game.level}` : "-";
    hitPlayer();
  };

  const gameOver = game.gameOver.bind(game);
  game.gameOver = () => {
    stats.lastLevel = game.level;
    stats.lastTime = game.playTime;
    stats.bestLevel = Math.max(stats.bestLevel, game.level);
    console.log(
      `[bot] run ${stats.runs}: level ${game.level}, ${Math.round(game.playTime)} s, score ${Math.floor(game.score)}`,
    );
    gameOver();
  };

  // The bot thinks right before every player update (also in the small
  // high-speed steps), so it never reacts too late
  const playerUpdate = player.update.bind(player);
  player.update = (dt) => {
    if (game.state === GameState.PLAYING && player.running)
      think(game, plans, missChance, human);
    playerUpdate(dt);
  };

  // Start the first run, and retry after every Game Over
  setInterval(() => {
    if (game.fade) return;
    if (game.state === GameState.MENU) game.fadeTo(() => game.startGame());
    if (game.state === GameState.GAME_OVER && game.stateTime >= RETRY_WAIT)
      game.retry();
  }, 100);

  // Stats box in the bottom-left corner (the sound button is top-left)
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:10;padding:6px 8px;" +
    "background:rgba(0,0,0,0.7);color:#fff1b8;font:12px monospace;white-space:pre;pointer-events:none";
  document.body.appendChild(panel);
  setInterval(() => {
    const speed = (game.worldSpeed / CONFIG.OBSTACLE_SPEED).toFixed(2);
    panel.textContent =
      `BOT${human ? " (human)" : ""}  start level ${startLevel}  miss ${Math.round(missChance * 100)}%\n` +
      `run ${stats.runs}  level ${game.level}  speed ${speed}x  lives ${game.lives}\n` +
      `time ${Math.round(game.playTime)} s  score ${Math.floor(game.score)}\n` +
      `hits ${stats.hits}  last hit: ${stats.lastHit}\n` +
      `best level ${stats.bestLevel}  last run: level ${stats.lastLevel}, ${Math.round(stats.lastTime)} s`;
  }, PANEL_REFRESH);
}

// Looks at the obstacles ahead and presses jump / slide like a player would
function think(game, plans, missChance, human) {
  const player = game.player;
  for (const obstacle of game.obstacles.obstacles) {
    if (obstacle.smashed) continue;
    let plan = plans.get(obstacle);
    if (!plan) {
      // Decided once, when the obstacle appears
      plan = {
        ignore: Math.random() < missChance,
        noticeAt: human
          ? game.playTime + REACTION_TIME + gaussian() * REACTION_SPREAD
          : 0,
        early: human ? gaussian() * TIMING_SPREAD : 0, // seconds (minus = late)
      };
      plans.set(obstacle, plan);
    }
    if (plan.ignore || game.playTime < plan.noticeAt) continue;

    const distance = obstacle.x - (player.x + player.width);
    if (distance <= 0) continue; // already reached the groom
    // Timing is measured in the groom's own time (he jumps faster at high speed),
    // but a person's early / late press is in real seconds
    const timeScale = game.playerTimeScale();
    const timeLeft = (distance / game.worldSpeed) * timeScale;
    const early = plan.early * timeScale;

    if (obstacle.dodge === "double") {
      if (timeLeft < DOUBLE_JUMP_TIME + early) {
        if (player.onGround) player.requestJump();
        else if (player.jumpCount === 1 && player.velocityY > DOUBLE_JUMP_SPEED)
          player.requestJump();
      }
      continue;
    }
    // The bot presses as late as it safely can; a person aims for the middle
    const jumpSpeed = game.worldSpeed / timeScale; // pixels per second of the groom's time
    const pressAt = human
      ? AIM_TIME + early
      : obstacle.dodge === "slide"
        ? SLIDE_DISTANCE / jumpSpeed
        : Math.max(JUMP_DISTANCE / jumpSpeed, JUMP_TIME);
    if (timeLeft >= pressAt) continue;
    if (obstacle.dodge === "slide") {
      if (!player.sliding) player.requestSlide();
    } else if (player.onGround) {
      player.requestJump();
    }
  }
}

// Random number around 0 (standard deviation 1)
function gaussian() {
  return (
    Math.sqrt(-2 * Math.log(1 - Math.random())) *
    Math.cos(2 * Math.PI * Math.random())
  );
}
