// =====================================================
// Screens - Game Over.
// Uses the Renderer's helpers so the style matches the rest of the game.
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";
import { YUMYUM_SPRITE, PIPO_SPRITE } from "./collectible.js";

const COLORS = CONFIG.COLORS;
const H = CONFIG.CANVAS_HEIGHT;
const IS_TOUCH_DEVICE = window.matchMedia("(pointer: coarse)").matches;

// Game Over buttons, in the centered 480px area (add view.offsetX).
// With the score board on, the panel is taller and SAVE SCORE sits above RETRY / MENU.
const PLAIN_LAYOUT = Object.freeze({
  panel: { y: 58, height: 150 },
  title: 82,
  subtitle: 102,
  score: 121,
  collected: 136,
  save: null,
  retry: { x: 148, y: 158, width: 86, height: 26 },
  menu: { x: 246, y: 158, width: 86, height: 26 },
  hint: 194,
});
const SAVE_LAYOUT = Object.freeze({
  panel: { y: 42, height: 186 },
  title: 64,
  subtitle: 84,
  score: 103,
  collected: 118,
  save: { x: 148, y: 132, width: 184, height: 26 },
  retry: { x: 148, y: 166, width: 86, height: 26 },
  menu: { x: 246, y: 166, width: 86, height: 26 },
  hint: 214,
});

// hasSave = the SAVE SCORE button is shown
export function getGameOverLayout(hasSave) {
  return hasSave ? SAVE_LAYOUT : PLAIN_LAYOUT;
}

const BUTTON_STYLES = Object.freeze({
  gold: { fill: COLORS.GOLD, border: COLORS.GOLD_DARK, text: COLORS.CEILING },
  dark: {
    fill: "rgba(61, 12, 25, 0.95)",
    border: COLORS.GOLD,
    text: COLORS.TEXT,
  },
  pink: {
    fill: COLORS.PETAL,
    border: COLORS.PETAL_WHITE,
    text: COLORS.CEILING,
  },
});

export class Screens {
  constructor(renderer) {
    this.renderer = renderer;
    this.ctx = renderer.ctx;
  }

  // ---------- Shared helpers ----------

  dim(alpha) {
    this.ctx.fillStyle = `rgba(30, 7, 16, ${alpha})`;
    this.ctx.fillRect(0, 0, view.width, H);
  }

  // style = 'gold', 'dark' or 'pink' (see BUTTON_STYLES)
  drawButton(rect, label, style, enabled) {
    const r = this.renderer;
    const ctx = this.ctx;
    const colors = BUTTON_STYLES[style];
    ctx.save();
    ctx.globalAlpha = enabled ? 1 : 0.45;
    const x = rect.x + view.offsetX;
    r.pixelBox(x, rect.y, rect.width, rect.height, colors.fill, colors.border);
    r.setFont(11, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.text;
    ctx.fillText(label, x + rect.width / 2, rect.y + rect.height / 2 + 1);
    ctx.restore();
  }

  // ---------- Game Over ----------

  // save = null (no score board) or { label, enabled, pressable } for the SAVE SCORE button
  // (enabled = drawn bright, pressable = ENTER / a tap does something right now)
  drawGameOver(
    score,
    heartsCollected,
    pipoCollected,
    yumyumCollected,
    canRetry,
    save,
  ) {
    const r = this.renderer;
    const layout = getGameOverLayout(save !== null);
    this.dim(0.55);

    const ox = view.offsetX; // the panel stays in the middle on wide screens
    const { y: panelY, height: panelHeight } = layout.panel;
    r.pixelBox(
      ox + 120,
      panelY,
      240,
      panelHeight,
      "rgba(61, 12, 25, 0.94)",
      COLORS.GOLD,
    );
    r.rect(ox + 125, panelY + 5, 230, 1, COLORS.GOLD_DARK);
    r.rect(ox + 125, panelY + panelHeight - 6, 230, 1, COLORS.GOLD_DARK);

    r.text("GAME OVER", view.width / 2, layout.title, 20, COLORS.TEXT, {
      bold: true,
    });
    r.text(
      "Don't give up on love!",
      view.width / 2,
      layout.subtitle,
      8,
      COLORS.GOLD_LIGHT,
    );

    const shown = Math.floor(score).toLocaleString("en-US");
    r.text(
      `SCORE: ${shown}`,
      view.width / 2,
      layout.score,
      12,
      COLORS.GOLD_LIGHT,
      { bold: true },
    );
    this.drawCollected(
      heartsCollected,
      pipoCollected,
      yumyumCollected,
      layout.collected,
    );

    if (save)
      this.drawButton(
        layout.save,
        save.label,
        "pink",
        canRetry && save.enabled,
      );
    this.drawButton(layout.retry, "RETRY", "gold", canRetry);
    this.drawButton(layout.menu, "MENU", "dark", canRetry);

    if (!IS_TOUCH_DEVICE) {
      const keys = save?.pressable
        ? "ENTER = Save    SPACE = Retry    ESC = Menu"
        : "SPACE = Retry    ESC = Menu";
      r.text(keys, view.width / 2, layout.hint, 8, COLORS.GOLD_DARK);
    }
  }

  // "<heart> x 12   <Pipo> x 8   <Yum Yum> x 3", centered at y
  // (each icon is placed from the real text width)
  drawCollected(hearts, pipos, yumyums, y) {
    const r = this.renderer;
    const ctx = this.ctx;
    const iconGap = 3;
    const groupGap = 14;
    const groups = [
      {
        width: 7,
        text: `x ${hearts}`,
        draw: (x) => r.drawPixelHeart(x, y - 3, COLORS.PETAL),
      },
      {
        width: PIPO_SPRITE.width,
        text: `x ${pipos}`,
        draw: (x) => this.drawIcon(PIPO_SPRITE, x, y),
      },
      {
        width: YUMYUM_SPRITE.width,
        text: `x ${yumyums}`,
        draw: (x) => this.drawIcon(YUMYUM_SPRITE, x, y),
      },
    ];

    r.setFont(8);
    let total = groupGap * (groups.length - 1);
    for (const group of groups) {
      group.textWidth = Math.ceil(ctx.measureText(group.text).width);
      total += group.width + iconGap + group.textWidth;
    }

    let x = Math.round((view.width - total) / 2);
    for (const group of groups) {
      group.draw(x);
      x += group.width + iconGap;
      r.text(group.text, x, y, 8, COLORS.TEXT, { align: "left" });
      x += group.textWidth + groupGap;
    }
  }

  // A sprite centered on y
  drawIcon(sprite, x, y) {
    this.ctx.drawImage(sprite, x, y - Math.round(sprite.height / 2));
  }
}
