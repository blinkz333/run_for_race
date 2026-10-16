// =====================================================
// Collectibles, laid out Cookie Run "bonus time" style, so players get greedy:
//   - thick blocks of hearts and Pipo jelly cups on the carpet (top rows need a jump)
//   - a thick arc over every obstacle you jump, following the jump
//   - rows take turns between two "looks" (hearts, one Pipo color, or a rainbow
//     of Pipo colors), so it never looks the same twice
//   - Yum Yum Chang Noi packs (worth more) often fill the top row
// A column of items is spawned every HEART_SPACING pixels of distance,
// so the blocks stay evenly packed at any speed.
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";
import { intersects } from "./obstacle.js";

const GROUND_Y = CONFIG.GROUND_Y;
const SPAWN_MARGIN = 8; // new things appear just off the right edge of the view

export const ItemKind = Object.freeze({
  HEART: "HEART",
  PIPO: "PIPO",
  YUMYUM: "YUMYUM",
});

// Layout
const HEART_SPACING = 12; // pixels between two columns of hearts
const ROW_SPACING = 11; // pixels between two rows of hearts
const FIRST_SPAWN_DELAY = 1; // seconds before the first block
const BLOCK_COLUMNS_MIN = 8; // columns per carpet block
const BLOCK_COLUMNS_MAX = 16;
const BLOCK_ROWS_MIN = 2; // rows per carpet block (rows 3 and 4 need a jump)
const BLOCK_ROWS_MAX = 4;
const BLOCK_GAP_MIN = 80; // empty carpet between blocks (pixels)
const BLOCK_GAP_MAX = 180;
const SLIDE_MARGIN = 10; // under a slide obstacle only the bottom row fits (pixels around it)
const LOW_Y = GROUND_Y - 16; // top of a heart on the carpet

// Arcs follow the groom's jump: air time = 2 x JUMP_FORCE / GRAVITY
const JUMP_AIR_TIME = (2 * CONFIG.JUMP_FORCE) / CONFIG.GRAVITY;
const ARC_WIDTH_SCALE = 0.9; // slightly narrower than the real jump, so it is easy to catch
const ARCS = {
  jump: { width: 1, height: 64 }, // width = x jump distance, height = pixels above LOW_Y
  double: { width: 1.6, height: 118 }, // the double jump goes higher and further
};
const ARC_ROWS = 3; // the arc is this many items thick

// Yum Yum packs: a whole top row of packs (on every second column, they are wider)
const YUMYUM_ROW_CHANCE = 0.4; // chance for a block or an arc to get a Yum Yum top row
const YUMYUM_PEAK_CHANCE = 0.5; // otherwise, chance for one pack at the top of an arc

const BOB_SPEED = 5; // gentle up/down floating
const BOB_HEIGHT = 1.5;
const SPARKLE_SPEED = 8;
const SPARKLE_COLOR = "#fff1b8";

// Collectible heart (9x8): o = outline, x = fill, h = shine
const HEART_MAP = [
  ".oo...oo.",
  "oxxo.oxxo",
  "oxhxoxxxo",
  "oxxxxxxxo",
  ".oxxxxxo.",
  "..oxxxo..",
  "...oxo...",
  "....o....",
];
const HEART_PALETTE = { o: "#8c1d3a", x: "#f28bb0", h: "#fff8ef" };

// Yum Yum Chang Noi pack (15x17): green pack with crimped ends, the round
// yellow-and-red "Yum Yum" logo, the white baby elephant and a lime slice.
// o = outline, G = light green, g = green, r = red, y = yellow,
// w = white, e = ear shadow, k = eye, l = lime, L = lime light
const YUMYUM_MAP = [
  ".o.o.o.o.o.o.o.",
  "oGGGGGGGGGGGGGo",
  "oggggrrrrrggggo",
  "ogggryyyyyrgggo",
  "oggryryryryrggo",
  "oggryryryryrggo",
  "ogggryyyyyrgggo",
  "oggggrrrrrggggo",
  "ogwwgggggggwwgo",
  "owwwwwwwwwwwwwo",
  "oewwwkwwwkwwweo",
  "ogewwwwwwwwwego",
  "oggwwwwrwwwwggo",
  "ogggggwwwgglLgo",
  "ogggggwwggLlLlo",
  "oGGGGGGwGGGlLGo",
  ".o.o.o.o.o.o.o.",
];
const YUMYUM_PALETTE = {
  o: "#1e501e",
  G: "#9be05a",
  g: "#5cc33a",
  r: "#e0302a",
  y: "#ffd23f",
  w: "#ffffff",
  e: "#d2d6e0",
  k: "#22202e",
  l: "#3a9a2a",
  L: "#c8f078",
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

// Pipo jelly cup (9x8): o = outline, w = foil lid, H = jelly top,
// x = jelly, h = shine, d = shadow. Colors are made from one base color.
const PIPO_MAP = [
  ".ooooooo.",
  "owwwwwwwo",
  "oHHHHHHHo",
  ".oxhxxxo.",
  ".oxhxxxo.",
  ".oxxxxdo.",
  "..oxxdo..",
  "..ooooo..",
];
const PIPO_COLORS = [
  "#e83040",
  "#ff8c28",
  "#ffd232",
  "#50c85a",
  "#4696f0",
  "#aa5adc",
];

// Mixes two '#rrggbb' colors (amount 0 = a, 1 = b)
function mixColor(a, b, amount) {
  const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const value = Math.round(
      channel(a, i) + (channel(b, i) - channel(a, i)) * amount,
    );
    out += value.toString(16).padStart(2, "0");
  }
  return out;
}

function pipoPalette(base) {
  return {
    o: mixColor(base, "#280a14", 0.6),
    w: "#fffaf0",
    H: mixColor(base, "#ffffff", 0.25),
    x: base,
    h: mixColor(base, "#ffffff", 0.6),
    d: mixColor(base, "#000000", 0.25),
  };
}

const SPRITES = {
  [ItemKind.HEART]: makeSprite(HEART_MAP, HEART_PALETTE),
  [ItemKind.YUMYUM]: makeSprite(YUMYUM_MAP, YUMYUM_PALETTE),
};
const PIPO_SPRITES = PIPO_COLORS.map((color) =>
  makeSprite(PIPO_MAP, pipoPalette(color)),
);
export const YUMYUM_SPRITE = SPRITES[ItemKind.YUMYUM];
export const PIPO_SPRITE = PIPO_SPRITES[0]; // red one, for the Game Over icon

// Points for each kind of item
const SCORES = {
  [ItemKind.HEART]: CONFIG.HEART_SCORE,
  [ItemKind.PIPO]: CONFIG.PIPO_SCORE,
  [ItemKind.YUMYUM]: CONFIG.YUMYUM_SCORE,
};
class Item {
  // x = left edge, y = top, color = which Pipo color (Pipo only)
  constructor(kind, x, y, color = 0) {
    this.kind = kind;
    this.score = SCORES[kind];
    this.sprite = kind === ItemKind.PIPO ? PIPO_SPRITES[color] : SPRITES[kind];
    this.width = this.sprite.width;
    this.height = this.sprite.height;
    this.x = x;
    this.baseY = y;
    this.y = y;
    this.age = x * 0.05; // neighbours bob a little out of step, like a wave
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.age += dt;
    this.y = this.baseY + Math.sin(this.age * BOB_SPEED) * BOB_HEIGHT;
  }

  // A little bigger than the picture so items are easy to grab
  getHitbox() {
    return {
      x: this.x - 2,
      y: this.baseY - 3,
      width: this.width + 4,
      height: this.height + 6,
    };
  }

  draw(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    ctx.drawImage(this.sprite, x, y);
    if (this.kind !== ItemKind.YUMYUM) return;

    // Yum Yum packs twinkle so they stand out from the hearts
    ctx.fillStyle = SPARKLE_COLOR;
    if (Math.sin(this.age * SPARKLE_SPEED) > 0) {
      ctx.fillRect(x - 2, y - 1, 1, 1);
      ctx.fillRect(x + this.width + 1, y + this.height - 2, 1, 1);
    } else {
      ctx.fillRect(x + this.width, y - 2, 1, 1);
      ctx.fillRect(x - 2, y + this.height - 1, 1, 1);
    }
  }
}

export class HeartManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.items = [];
    this.distanceToNext = CONFIG.OBSTACLE_SPEED * FIRST_SPAWN_DELAY;
    this.blockColumnsLeft = 0; // columns still to place in the current carpet block
    this.blockRows = 0; // rows in the current carpet block
    this.blockGapLeft = 0; // empty carpet left before the next block (pixels)
    this.blockLooks = null; // the two looks the block rows take turns with
    this.blockYumyum = false; // does this block have a Yum Yum top row?
    this.arcLooks = null; // same for the arc being placed
    this.arcYumyum = false;
    this.arcPeakYumyum = false; // only one pack, at the top of the arc
    this.inArc = false; // was the last column part of an arc?
    this.column = 0; // counts every column, for rainbows and every-second-column packs
  }

  // obstacleManager tells us where obstacles are (and what comes next) for the arcs
  update(dt, speed, obstacleManager) {
    this.distanceToNext -= speed * dt;
    while (this.distanceToNext <= 0) {
      // distanceToNext is now 0 or a little below, so the spacing stays exact
      this.spawnAt(
        view.width + SPAWN_MARGIN + this.distanceToNext,
        speed,
        obstacleManager,
      );
      this.distanceToNext += HEART_SPACING;
    }

    for (const item of this.items) item.update(dt, speed);
    this.items = this.items.filter((item) => item.x + item.width > 0);
  }

  // Decides what goes in the column at x: a thick arc, a carpet block column, or nothing
  spawnAt(x, speed, obstacleManager) {
    const centerX = x + SPRITES[ItemKind.HEART].width / 2;
    const obstacles = this.getObstacles(obstacleManager);
    this.column += 1;
    const evenColumn = this.column % 2 === 0;

    // Over an obstacle you jump: follow the arc, always
    for (const obstacle of obstacles) {
      const arc = ARCS[obstacle.dodge];
      if (!arc) continue;
      const halfWidth =
        (JUMP_AIR_TIME * speed * arc.width * ARC_WIDTH_SCALE) / 2;
      const offset = (centerX - obstacle.centerX) / halfWidth; // -1 .. 1 across the arc
      if (Math.abs(offset) > 1) continue;

      // A new arc starts: pick its looks and whether it gets Yum Yum packs
      if (!this.inArc) {
        this.inArc = true;
        this.arcLooks = pickLooks();
        this.arcYumyum = Math.random() < YUMYUM_ROW_CHANCE;
        this.arcPeakYumyum =
          !this.arcYumyum && Math.random() < YUMYUM_PEAK_CHANCE;
      }

      const y = LOW_Y - arc.height * (1 - offset * offset);
      const isTop = Math.abs(centerX - obstacle.centerX) < HEART_SPACING / 2;
      for (let row = 0; row < ARC_ROWS; row++) {
        const rowY = y - row * ROW_SPACING;
        const isTopRow = row === ARC_ROWS - 1;
        if (
          isTopRow &&
          ((this.arcYumyum && evenColumn) || (this.arcPeakYumyum && isTop))
        ) {
          this.addYumyum(centerX, rowY);
        } else if (!(isTopRow && this.arcYumyum)) {
          this.addLook(this.arcLooks[row % 2], x, rowY, row);
        }
      }
      return;
    }
    this.inArc = false;

    // On the carpet: thick blocks of hearts with empty gaps between them
    if (this.blockColumnsLeft <= 0) {
      this.blockGapLeft -= HEART_SPACING;
      if (this.blockGapLeft > 0) return;
      this.blockColumnsLeft = randomInt(BLOCK_COLUMNS_MIN, BLOCK_COLUMNS_MAX);
      this.blockRows = randomInt(BLOCK_ROWS_MIN, BLOCK_ROWS_MAX);
      this.blockGapLeft =
        BLOCK_GAP_MIN + Math.random() * (BLOCK_GAP_MAX - BLOCK_GAP_MIN);
      this.blockLooks = pickLooks();
      this.blockYumyum = Math.random() < YUMYUM_ROW_CHANCE;
    }
    this.blockColumnsLeft -= 1;

    // Under a slide obstacle only the bottom row fits
    const underSlide = obstacles.some(
      (o) =>
        o.dodge === "slide" &&
        Math.abs(centerX - o.centerX) < o.width / 2 + SLIDE_MARGIN,
    );
    const rows = underSlide ? 1 : this.blockRows;
    for (let row = 0; row < rows; row++) {
      const rowY = LOW_Y - row * ROW_SPACING;
      const isYumyumRow = this.blockYumyum && rows > 1 && row === rows - 1;
      if (isYumyumRow) {
        if (evenColumn) this.addYumyum(centerX, rowY);
      } else {
        this.addLook(this.blockLooks[row % 2], x, rowY, row);
      }
    }
  }

  // One heart or Pipo, as the look says ('rainbow' = the color moves along the row)
  addLook(look, x, y, row) {
    if (look === "heart") {
      this.items.push(new Item(ItemKind.HEART, x, y));
    } else {
      const color =
        look === "rainbow" ? (this.column + row) % PIPO_COLORS.length : look;
      this.items.push(new Item(ItemKind.PIPO, x, y, color));
    }
  }

  // A Yum Yum pack centered on the column, its bottom lined up with the row
  addYumyum(centerX, rowY) {
    const sprite = SPRITES[ItemKind.YUMYUM];
    const bottom = rowY + SPRITES[ItemKind.HEART].height;
    this.items.push(
      new Item(
        ItemKind.YUMYUM,
        centerX - sprite.width / 2,
        bottom - sprite.height,
      ),
    );
  }

  // Obstacles on screen plus the next one, as { centerX, width, dodge }
  getObstacles(obstacleManager) {
    const list = obstacleManager.obstacles.map((obstacle) => ({
      centerX: obstacle.x + obstacle.width / 2,
      width: obstacle.width,
      dodge: obstacle.dodge,
    }));
    // The next obstacle appears at the right edge once its distanceToNext reaches 0
    const next = obstacleManager.peekNext();
    list.push({
      centerX:
        view.width +
        SPAWN_MARGIN +
        obstacleManager.distanceToNext +
        next.width / 2,
      width: next.width,
      dodge: next.dodge,
    });
    return list;
  }

  // Removes and returns every item touching the box
  collect(box) {
    const collected = this.items.filter((item) =>
      intersects(box, item.getHitbox()),
    );
    if (collected.length > 0) {
      this.items = this.items.filter((item) => !collected.includes(item));
    }
    return collected;
  }

  draw(ctx) {
    for (const item of this.items) item.draw(ctx);
  }
}

// Two different looks for the rows to take turns with:
// 'heart', 'rainbow' or a Pipo color number
function pickLooks() {
  const looks = [
    "heart",
    "heart",
    "rainbow",
    randomInt(0, PIPO_COLORS.length - 1),
  ];
  const first = looks[randomInt(0, looks.length - 1)];
  let second = first;
  while (second === first) second = looks[randomInt(0, looks.length - 1)];
  return [first, second];
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
