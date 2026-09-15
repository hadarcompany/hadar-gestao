export interface LabelData {
  id: string;
  name: string;
  color: string;
  position: number;
}

export const LABEL_PALETTE = [
  "#00c875", "#9cd326", "#cab641", "#ffcb00", "#fdab3d", "#ff642e", "#e2445c", "#bb3354",
  "#ff158a", "#ff5ac4", "#f7a1d5", "#e484bd", "#a25ddc", "#b8a3f4", "#784bd1", "#579bfc",
  "#66ccff", "#3fa9c9", "#8fb3c9", "#ffadad", "#c4c4c4", "#808080", "#333333", "#7f5347",
];

/** Texto branco ou escuro, o que tiver mais contraste com a cor da etiqueta. */
export function labelTextColor(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return "#ffffff";
  const n = parseInt(match[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.22 ? "#1f2937" : "#ffffff";
}
