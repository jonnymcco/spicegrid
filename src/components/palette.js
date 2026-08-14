// Warm, food-adjacent region colours — deliberately kept far from the
// error-red (#E5233D) used for invalid placements so the two never get
// confused at a glance.
const REGION_COLORS = [
  { name: "Habanero Orange", hex: "#E8791A" },
  { name: "Jalapeño Green", hex: "#4F7942" },
  { name: "Paprika", hex: "#C1440E" },
  { name: "Mustard Gold", hex: "#D4A017" },
  { name: "Chipotle Brown", hex: "#7A4A2B" },
  { name: "Tomato Coral", hex: "#D9531E" },
  { name: "Lime Zest", hex: "#8FAF3D" },
  { name: "Cinnamon", hex: "#A5683C" },
  { name: "Mango", hex: "#F2A541" },
  { name: "Olive", hex: "#7C7A34" },
  { name: "Toasted Cumin", hex: "#B5651D" },
  { name: "Basil Green", hex: "#5B8C5A" },
];

/** Extra hues generated on the fly if a board needs more than the curated set. */
function generateExtraColor(index) {
  const hue = (18 + index * 47) % 360; // walk the wheel, skip pure error-red band
  return { name: `Spice ${index}`, hex: `hsl(${hue}, 55%, 42%)` };
}

/** Returns `count` region colours, stable by region index. */
export function getRegionPalette(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(i < REGION_COLORS.length ? REGION_COLORS[i] : generateExtraColor(i));
  }
  return colors;
}
