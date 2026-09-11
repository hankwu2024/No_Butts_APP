type RGB = [number, number, number];

// green (few) -> yellow (moderate) -> red (severe), anchored to absolute counts
const STOPS: { at: number; rgb: RGB }[] = [
  { at: 0, rgb: [12, 163, 12] },
  { at: 200, rgb: [250, 178, 25] },
  { at: 500, rgb: [208, 59, 59] },
];

const toHex = (rgb: RGB) =>
  '#' + rgb.map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');

export const getSeverityColor = (value: number): string => {
  const v = Math.max(0, value || 0);
  if (v <= STOPS[0].at) return toHex(STOPS[0].rgb);

  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i].at) {
      const prev = STOPS[i - 1];
      const cur = STOPS[i];
      const t = (v - prev.at) / (cur.at - prev.at);
      const rgb: RGB = [
        prev.rgb[0] + (cur.rgb[0] - prev.rgb[0]) * t,
        prev.rgb[1] + (cur.rgb[1] - prev.rgb[1]) * t,
        prev.rgb[2] + (cur.rgb[2] - prev.rgb[2]) * t,
      ];
      return toHex(rgb);
    }
  }
  return toHex(STOPS[STOPS.length - 1].rgb);
};

export const SEVERITY_LEGEND_STOPS = [0, 100, 200, 350, 500];
