import { hexToLab, labDistance } from "./colorMath.js";

const DIAGONAL_NEIGHBORS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/**
 * Which regions sit next to which, on screen. Includes diagonal
 * neighbours (not just the orthogonal ones the game rules care about) —
 * two regions that only touch at a corner still read as "next to each
 * other" visually, so their colours should stay distinct too.
 */
function buildAdjacency(regions, size) {
  const adjacency = Array.from({ length: size }, () => new Set());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const id = regions[r][c];
      for (const [dr, dc] of DIAGONAL_NEIGHBORS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const neighborId = regions[nr][nc];
        if (neighborId !== id) {
          adjacency[id].add(neighborId);
          adjacency[neighborId].add(id);
        }
      }
    }
  }
  return adjacency;
}

/**
 * Assigns each region one colour from `palette`, choosing which region
 * gets which colour (rather than just palette[regionId]) so that regions
 * sharing a border always end up as visually distinct as the palette
 * allows. Colour-blind-friendly this is not, but it directly targets the
 * complaint that arbitrary index-order assignment could put two similar
 * warm tones right next to each other.
 *
 * Greedy strategy: process regions with the most already-coloured
 * neighbours first (so the hardest-to-satisfy regions get first pick),
 * and for each one choose the unused palette colour that maximises the
 * *minimum* perceptual (Lab) distance to its already-coloured neighbours
 * — falling back to maximising distance against every colour assigned so
 * far, to keep the whole board varied even where neighbours don't force a
 * particular choice.
 *
 * @param {number[][]} regions - regionId per [row][col].
 * @param {number} size
 * @param {{name: string, hex: string, iconColor: string}[]} palette - one entry per region.
 * @returns {{name: string, hex: string, iconColor: string}[]} palette entries reordered by regionId.
 */
export function assignRegionColors(regions, size, palette) {
  const regionCount = palette.length;
  const adjacency = buildAdjacency(regions, size);
  const labByPaletteIndex = palette.map((c) => hexToLab(c.hex));

  const assignedPaletteIndex = new Array(regionCount).fill(-1);
  const usedPaletteIndices = new Set();

  const processingOrder = [...Array(regionCount).keys()].sort(
    (a, b) => adjacency[b].size - adjacency[a].size || a - b
  );

  for (const regionId of processingOrder) {
    const neighborLabs = [...adjacency[regionId]]
      .map((n) => assignedPaletteIndex[n])
      .filter((idx) => idx !== -1)
      .map((idx) => labByPaletteIndex[idx]);
    const assignedLabsSoFar = assignedPaletteIndex.filter((idx) => idx !== -1).map((idx) => labByPaletteIndex[idx]);

    let bestIndex = -1;
    let bestNeighborScore = -Infinity;
    let bestOverallScore = -Infinity;

    for (let i = 0; i < palette.length; i++) {
      if (usedPaletteIndices.has(i)) continue;
      const candidateLab = labByPaletteIndex[i];

      const neighborScore =
        neighborLabs.length === 0 ? Infinity : Math.min(...neighborLabs.map((lab) => labDistance(candidateLab, lab)));
      const overallScore =
        assignedLabsSoFar.length === 0
          ? Infinity
          : Math.min(...assignedLabsSoFar.map((lab) => labDistance(candidateLab, lab)));

      if (neighborScore > bestNeighborScore || (neighborScore === bestNeighborScore && overallScore > bestOverallScore)) {
        bestNeighborScore = neighborScore;
        bestOverallScore = overallScore;
        bestIndex = i;
      }
    }

    assignedPaletteIndex[regionId] = bestIndex;
    usedPaletteIndices.add(bestIndex);
  }

  return assignedPaletteIndex.map((paletteIndex) => palette[paletteIndex]);
}
