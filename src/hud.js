// =====================================================
// HUD - lives, score counter, level banners and "+10" popups.
// Uses the Renderer's helpers so the style matches the rest of the game.
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";

const COLORS = CONFIG.COLORS;
const H = CONFIG.CANVAS_HEIGHT;

// Life heart with outline (9x8): o = outline, x = fill, h = shine
const LIFE_HEART = [
  ".oo...oo.",
  "oxxo.oxxo",
  "oxhxoxxxo",
  "oxxxxxxxo",
  ".oxxxxxo.",
  "..oxxxo..",
  "...oxo...",
  "....o....",
];

const HEART_SCALE = 2;
const HEART_SPACING = 20;
const HEART_TOP = 6;
const FULL_COLORS = {
  o: COLORS.TEXT_SHADOW,
  x: COLORS.PETAL_WHITE,
  h: COLORS.STAR,
};
const EMPTY_COLORS = {
  o: COLORS.TEXT_SHADOW,
  x: "rgba(61, 12, 25, 0.75)",
  h: "rgba(61, 12, 25, 0.75)",
};

// Power-up timers (under the lives, right side): icon + a bar that runs down
const POWERUP_TOP = 26;
const POWERUP_BAR_WIDTH = 34;
const POWERUP_BAR_HEIGHT = 4;
const POWERUP_ROW_HEIGHT = 25;

// Score panel (top center, under the desktop key hint)
const SCORE_WIDTH = 112;
const SCORE_Y = 13;
const SCORE_HEIGHT = 30;

// "+10" popups and level banners
export const POPUP_DURATION = 0.7; // seconds
const POPUP_RISE = 16; // pixels
const BANNER_DURATION = 2.2; // seconds
const BANNER_FADE = 0.3; // seconds to fade in / out

export class Hud {
  constructor(renderer) {
    this.renderer = renderer;
    this.ctx = renderer.ctx;
  }

  // ---------- Lives ----------

  // lostBlink = true while the heart that was just lost should flash
  drawLives(lives, lostBlink) {
    const total = CONFIG.STARTING_LIVES;
    const width =
      (total - 1) * HEART_SPACING + LIFE_HEART[0].length * HEART_SCALE;
    const left = view.width - width - 8;

    for (let i = 0; i < total; i++) {
      const x = left + i * HEART_SPACING;
      const isFull = i < lives;
      const isJustLost = i === lives && lostBlink;
      this.drawHeart(
        x,
        HEART_TOP,
        isFull || isJustLost ? FULL_COLORS : EMPTY_COLORS,
      );
    }
  }

  drawHeart(x, y, colors) {
    const ctx = this.ctx;
    LIFE_HEART.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const color = colors[row[dx]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(
          x + dx * HEART_SCALE,
          y + dy * HEART_SCALE,
          HEART_SCALE,
          HEART_SCALE,
        );
      }
    });
  }

  // ---------- Power-ups ----------

  // timers = [{ sprite, left }], left = 1 (just picked up) .. 0 (over, not shown)
  drawPowerUps(timers) {
    const r = this.renderer;
    const right = view.width - 8;
    let y = POWERUP_TOP;
    for (const { sprite, left } of timers) {
      if (left <= 0) continue;
      const barX = right - POWERUP_BAR_WIDTH;
      const iconX = barX - sprite.width - 4;
      this.ctx.drawImage(sprite, iconX, y);
      const barY = y + Math.round(sprite.height / 2) - 2;
      r.pixelBox(
        barX,
        barY,
        POWERUP_BAR_WIDTH,
        POWERUP_BAR_HEIGHT,
        "rgba(30, 7, 16, 0.75)",
        COLORS.GOLD_DARK,
      );
      r.rect(
        barX + 1,
        barY + 1,
        Math.ceil((POWERUP_BAR_WIDTH - 2) * left),
        POWERUP_BAR_HEIGHT - 2,
        COLORS.GOLD_LIGHT,
      );
      y += POWERUP_ROW_HEIGHT;
    }
  }

  // ---------- Score ----------

  drawScore(score) {
    const r = this.renderer;
    const x = Math.round((view.width - SCORE_WIDTH) / 2);
    const cx = view.width / 2;

    // Dark panel with a gold line, so the number is easy to read on any background
    r.pixelBox(
      x,
      SCORE_Y,
      SCORE_WIDTH,
      SCORE_HEIGHT,
      "rgba(30, 7, 16, 0.65)",
      COLORS.GOLD_DARK,
    );
    r.text("SCORE", cx, SCORE_Y + 8, 8, COLORS.GOLD, { bold: true });
    r.text(
      Math.floor(score).toLocaleString("en-US"),
      cx,
      SCORE_Y + 20,
      14,
      COLORS.TEXT,
      { bold: true },
    );
  }

  // popups = [{ x, y, age, text }]
  drawPopups(popups) {
    const ctx = this.ctx;
    for (const popup of popups) {
      const t = popup.age / POPUP_DURATION;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      this.renderer.text(
        popup.text,
        popup.x,
        popup.y - t * POPUP_RISE,
        8,
        COLORS.GOLD_LIGHT,
        { bold: true },
      );
      ctx.restore();
    }
  }

  // Banner in the middle of the screen, e.g. "LEVEL 2 - SPEED UP!"
  drawBanner(text, age) {
    if (age >= BANNER_DURATION) return;
    const ctx = this.ctx;
    const fadeIn = Math.min(1, age / BANNER_FADE);
    const fadeOut = Math.min(1, (BANNER_DURATION - age) / BANNER_FADE);

    ctx.save();
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    this.renderer.setFont(14, true);
    const width = Math.ceil(ctx.measureText(text).width) + 28;
    const x = Math.round((view.width - width) / 2);
    const y = 52 + Math.round((1 - fadeIn) * -6); // slides down a little as it appears
    this.renderer.pixelBox(
      x,
      y,
      width,
      26,
      "rgba(61, 12, 25, 0.9)",
      COLORS.GOLD,
    );
    this.renderer.drawPixelHeart(x + 6, y + 10, COLORS.PETAL);
    this.renderer.drawPixelHeart(x + width - 13, y + 10, COLORS.PETAL);
    this.renderer.text(text, view.width / 2, y + 14, 14, COLORS.TEXT, {
      bold: true,
    });
    ctx.restore();
  }

  // ---------- Hit feedback ----------

  // Short red flash over the whole screen when the groom is hit
  drawHurtFlash(strength) {
    if (strength <= 0) return;
    this.ctx.fillStyle = `rgba(217, 70, 106, ${0.3 * strength})`;
    this.ctx.fillRect(0, 0, view.width, H);
  }
}
