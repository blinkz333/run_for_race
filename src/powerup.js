// =====================================================
// Power-ups - float just above the carpet now and then, right in the groom's path.
//   MAGNUM  = giant chocolate ice cream -> the groom grows GIANT for a few seconds
//   REGENCY = brandy bottle             -> SPEED BOOST for a few seconds
// While a power-up is on, the groom cannot be hurt and smashes obstacles away.
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";
import { intersects } from "./obstacle.js";

const GROUND_Y = CONFIG.GROUND_Y;
const SPAWN_MARGIN = 8; // new things appear just off the right edge of the view

export const PowerUpType = Object.freeze({
  MAGNUM: "MAGNUM",
  REGENCY: "REGENCY",
});

// Floats low, right in the groom's path: running or sliding grabs it, jumping misses it
const FLOAT_BOTTOM = GROUND_Y - 14; // bottom of the item (pixels)
const OBSTACLE_CLEARANCE = 70; // never spawn this close to an obstacle (pixels)
const RETRY_DISTANCE = 40; // spot taken by an obstacle -> try again a bit later (pixels)
const CHAIN_DELAY = 1; // a chained power-up shows up about this many seconds after the last one

// Eating / chugging animation, held at the groom's mouth
const MAGNUM_HELD_SCALE = 0.5; // the Magnum is drawn this big in his hand
const MAGNUM_BITES = 3; // bites to finish it (the stick is left at the end)
const MAGNUM_BITE_ROWS = 5; // rows of chocolate gone per bite
const MAGNUM_TILT = -0.4; // radians: the stick leans forward, the top points at the mouth
const REGENCY_HELD_SCALE = 0.6;
const REGENCY_START_ANGLE = -1.25; // radians: bottle lying forward, neck at the mouth
const REGENCY_END_ANGLE = -2.6; // bottoms up
const DRINK_COLOR = "#e8a04a";

const BOB_SPEED = 4;
const BOB_HEIGHT = 2;
const GLOW_SPEED = 6;

// ---------- Magnum: chocolate ice cream with a bite (12x22) ----------

const MAGNUM_MAP = [
  ".cccccc.....",
  "cclcccc.....",
  "clccccvv....",
  "clcccccvvv..",
  "clccccccvvvc",
  "clcccDcccccc",
  "clccccccccDc",
  "clcccccccccc",
  "clccDccccccc",
  "clcccccccccc",
  "clccccccDccc",
  "clcccccccccc",
  "clcccDcccccc",
  "clcccccccccc",
  "cclccccccccD",
  ".DDDDDDDDDD.",
  "....sssS....",
  "....sssS....",
  "....sssS....",
  "....sssS....",
  "....sssS....",
  "...ssssSS...",
];
const MAGNUM_PALETTE = {
  c: "#7a4528", // chocolate
  l: "#a8693f", // chocolate shine
  D: "#4a2616", // dark chocolate crack / shadow
  v: "#f6ead0", // vanilla inside the bite
  s: "#d9b27c", // wooden stick
  S: "#b8925e", // stick shadow
};

// ---------- Regency: amber brandy bottle with a gold cap and cream label (10x22) ----------

const REGENCY_MAP = [
  "...oooo...",
  "...oGgo...",
  "...oggo...",
  "...oooo...",
  "....oAo...",
  "....oAo...",
  "...oaAao..",
  "..oaaAaao.",
  ".oaaaaAaao",
  "oaAaaaaaao",
  "oaAcccccao",
  "oaAcgggcao",
  "oaAcgrgcao",
  "oaAcgggcao",
  "oaAcccccao",
  "oaAcrrrcao",
  "oaAcccccao",
  "oaAaaaaaao",
  "oaAaaaaaao",
  "oaaaaaaaao",
  "oddddddddo",
  ".oooooooo.",
];
const REGENCY_PALETTE = {
  o: "#3a1a08", // outline
  a: "#b5651d", // amber glass
  A: "#e8a04a", // glass shine
  d: "#6e3410", // brandy at the bottom
  g: "#e8c26a", // gold
  G: "#fff1b8", // gold shine
  c: "#f6ead0", // cream label
  r: "#c0303a", // red on the label
};

function makeSprite(map, palette) {
  const canvas = document.createElement("canvas");
  canvas.width = map[0].length;
  canvas.height = map.length;
  const ctx = canvas.getContext("2d");
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

export const POWERUP_SPRITES = {
  [PowerUpType.MAGNUM]: makeSprite(MAGNUM_MAP, MAGNUM_PALETTE),
  [PowerUpType.REGENCY]: makeSprite(REGENCY_MAP, REGENCY_PALETTE),
};

// Glow colors behind each power-up
const GLOW_COLORS = {
  [PowerUpType.MAGNUM]: "255, 230, 160",
  [PowerUpType.REGENCY]: "255, 190, 110",
};

class PowerUp {
  constructor(type, x) {
    this.type = type;
    this.sprite = POWERUP_SPRITES[type];
    this.width = this.sprite.width;
    this.height = this.sprite.height;
    this.x = x;
    this.baseY = FLOAT_BOTTOM - this.height;
    this.y = this.baseY;
    this.age = 0;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.age += dt;
    this.y = this.baseY + Math.sin(this.age * BOB_SPEED) * BOB_HEIGHT;
  }

  // Generous, so it is easy to grab
  getHitbox() {
    return {
      x: this.x - 3,
      y: this.baseY - 4,
      width: this.width + 6,
      height: this.height + 8,
    };
  }

  draw(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const centerX = x + this.width / 2;
    const centerY = y + this.height / 2;

    // Pulsing round glow so it stands out from the hearts
    const pulse = 0.5 + 0.5 * Math.sin(this.age * GLOW_SPEED);
    const radius = 15 + pulse * 3;
    const glow = ctx.createRadialGradient(
      centerX,
      centerY,
      2,
      centerX,
      centerY,
      radius,
    );
    glow.addColorStop(
      0,
      `rgba(${GLOW_COLORS[this.type]}, ${0.55 + pulse * 0.2})`,
    );
    glow.addColorStop(1, `rgba(${GLOW_COLORS[this.type]}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    ctx.drawImage(this.sprite, x, y);

    // Twinkles going round it
    ctx.fillStyle = "#fff8ef";
    const angle = this.age * 3;
    for (let i = 0; i < 3; i++) {
      const a = angle + (i * Math.PI * 2) / 3;
      ctx.fillRect(
        Math.round(centerX + Math.cos(a) * 12),
        Math.round(centerY + Math.sin(a) * 14),
        1,
        1,
      );
    }
  }
}

export class PowerUpManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.items = [];
    this.distanceToNext = this.randomGap() * CONFIG.POWERUP_FIRST_DELAY;
    this.bag = []; // Magnum and Regency take turns in a random order
    this.chainPending = false; // a chained power-up is on its way (spawns even while powered up)
  }

  // Called when the groom grabs a power-up: sometimes another one follows soon after
  onCollected(speed) {
    if (Math.random() >= CONFIG.POWERUP_CHAIN_CHANCE) return;
    this.chainPending = true;
    this.distanceToNext = speed * CHAIN_DELAY;
  }

  // Distance (pixels) between two power-ups at the base speed
  randomGap() {
    const seconds =
      CONFIG.POWERUP_GAP_MIN +
      Math.random() * (CONFIG.POWERUP_GAP_MAX - CONFIG.POWERUP_GAP_MIN);
    return CONFIG.OBSTACLE_SPEED * seconds;
  }

  // obstacleManager is used to keep power-ups away from obstacles.
  // paused = true while a power-up is on (no new one until it ends, unless one is chained)
  update(dt, speed, obstacleManager, paused) {
    if (!paused || this.chainPending) this.distanceToNext -= speed * dt;
    if (this.distanceToNext <= 0) {
      const x = view.width + SPAWN_MARGIN;
      if (this.isNearObstacle(x, obstacleManager)) {
        this.distanceToNext = RETRY_DISTANCE;
      } else {
        if (this.bag.length === 0)
          this.bag = shuffle([PowerUpType.MAGNUM, PowerUpType.REGENCY]);
        this.items.push(new PowerUp(this.bag.pop(), x));
        this.distanceToNext = this.randomGap();
        this.chainPending = false;
      }
    }

    for (const item of this.items) item.update(dt, speed);
    this.items = this.items.filter((item) => item.x + item.width > 0);
  }

  // Is an obstacle (on screen or the next one) too close to x?
  isNearObstacle(x, obstacleManager) {
    const spots = obstacleManager.obstacles.map((o) => o.x + o.width / 2);
    const next = obstacleManager.peekNext();
    spots.push(
      view.width +
        SPAWN_MARGIN +
        obstacleManager.distanceToNext +
        next.width / 2,
    );
    return spots.some((spot) => Math.abs(spot - x) < OBSTACLE_CLEARANCE);
  }

  // Removes and returns the first power-up touching the box, or null
  collect(box) {
    const item = this.items.find((powerUp) =>
      intersects(box, powerUp.getHitbox()),
    );
    if (item) this.items = this.items.filter((powerUp) => powerUp !== item);
    return item ?? null;
  }

  draw(ctx) {
    for (const item of this.items) item.draw(ctx);
  }
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// The groom eating a Magnum or chugging a Regency.
// (mouthX, mouthY) = his mouth on screen, scale = his size (2 while giant),
// progress = 0 (just grabbed) .. 1 (finished)
export function drawConsume(ctx, type, progress, mouthX, mouthY, scale) {
  const sprite = POWERUP_SPRITES[type];
  ctx.save();
  ctx.translate(Math.round(mouthX), Math.round(mouthY));
  if (type === PowerUpType.MAGNUM) {
    // Held in front of the mouth, tilted towards it; each bite takes rows off the top
    // and pushes the rest up into the mouth, until only the stick is left
    ctx.rotate(MAGNUM_TILT);
    ctx.scale(scale * MAGNUM_HELD_SCALE, scale * MAGNUM_HELD_SCALE);
    const bites = Math.min(
      MAGNUM_BITES,
      Math.floor(progress * (MAGNUM_BITES + 1)),
    );
    const cut = bites * MAGNUM_BITE_ROWS;
    ctx.drawImage(
      sprite,
      0,
      cut,
      sprite.width,
      sprite.height - cut,
      1,
      -4,
      sprite.width,
      sprite.height - cut,
    );
  } else {
    // Neck at the mouth, the bottle tips up until it is bottoms up
    ctx.scale(scale, scale);
    const angle =
      REGENCY_START_ANGLE +
      (REGENCY_END_ANGLE - REGENCY_START_ANGLE) * Math.min(1, progress * 1.4);
    ctx.save();
    ctx.rotate(angle);
    ctx.scale(REGENCY_HELD_SCALE, REGENCY_HELD_SCALE);
    ctx.drawImage(sprite, -Math.round(sprite.width / 2), 0);
    ctx.restore();
    // A few drops escaping at the corner of the mouth
    ctx.fillStyle = DRINK_COLOR;
    const drip = (progress * 10) % 1;
    ctx.fillRect(-1, Math.round(1 + drip * 4), 1, 1);
    if (progress > 0.4)
      ctx.fillRect(0, Math.round(2 + ((drip + 0.5) % 1) * 4), 1, 1);
  }
  ctx.restore();
}

// White speed lines rushing past during the Regency boost (screen space)
// strength 0..1 fades them in and out
export function drawSpeedLines(ctx, time, strength) {
  if (strength <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.75 * strength;
  ctx.fillStyle = "#fff8ef";
  for (let i = 0; i < 24; i++) {
    // Each line has its own height and speed, from a fixed pattern
    const y = 40 + ((i * 37) % 180);
    const length = 30 + ((i * 13) % 40);
    const speed = 700 + ((i * 97) % 400);
    const span = view.width + length;
    const x = view.width - ((time * speed + i * 83) % span);
    ctx.fillRect(Math.round(x), y, length, 1);
  }
  ctx.restore();
}
