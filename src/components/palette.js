import { contrastRatio } from "./colorMath.js";

// Warm, food-adjacent region colours, chosen and checked with a perceptual
// (CIE Lab) distance calculation rather than by eye — the first pass at
// this palette had several oranges/rusts that measured "different" by hue
// alone but read as near-identical side by side. The first 8 entries are
// the ones an 8x8 board actually uses by default, and are checked to stay
// well clear of each other AND of the #E5233D error-red so a region colour
// is never mistaken for the invalid-placement flash. Entries after 8 are
// used only for larger boards; a couple of those sit a bit closer together
// (there's limited room in a "food, not neon" hue range), so
// `regionColorAssignment.js` actively avoids placing close colours next to
// each other on the board rather than relying on palette order alone.
const REGION_COLORS = [
  { name: "Brick Red", hex: "#87221D" },
  { name: "Habanero Orange", hex: "#E47E25" },
  { name: "Jalapeño Green", hex: "#458235" },
  { name: "Golden Turmeric", hex: "#D1A61A" },
  { name: "Chipotle Brown", hex: "#5B3829" },
  { name: "Basil Green", hex: "#2E6B47" },
  { name: "Paprika", hex: "#C05630" },
  { name: "Lime Zest", hex: "#87B635" },
  { name: "Olive", hex: "#505828" },
  { name: "Mustard", hex: "#A89224" },
  { name: "Cinnamon", hex: "#B68768" },
  { name: "Cocoa", hex: "#34251D" },
];

const ICON_WHITE = "#FFFFFF";
const ICON_INK = "#1B1023"; // matches the riso-ink token used elsewhere

/** Picks whichever of white / dark-ink reads better on this background. */
function bestIconColor(hex) {
  return contrastRatio(hex, ICON_WHITE) >= contrastRatio(hex, ICON_INK) ? ICON_WHITE : ICON_INK;
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n) => Math.round(f(n) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

/** Extra hues generated on the fly if a board needs more than the curated set. */
function generateExtraColor(index) {
  const hue = (18 + index * 47) % 360; // walk the wheel, skip pure error-red band
  return { name: `Patch ${index}`, hex: hslToHex(hue, 55, 42) };
}

/**
 * Returns `count` region colours (name, hex, and a contrast-safe
 * `iconColor` for the shamrock/✕ glyph drawn on top of it).
 */
export function getRegionPalette(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const color = i < REGION_COLORS.length ? REGION_COLORS[i] : generateExtraColor(i);
    colors.push({ ...color, iconColor: bestIconColor(color.hex) });
  }
  return colors;
}
