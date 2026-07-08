const PALETTES: Array<[string, string]> = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#22d3ee'],
  ['#22c55e', '#84cc16'],
  ['#f97316', '#f43f5e'],
  ['#ec4899', '#8b5cf6'],
  ['#14b8a6', '#0ea5e9'],
  ['#f59e0b', '#ef4444'],
  ['#a855f7', '#ec4899'],
  ['#06b6d4', '#3b82f6'],
  ['#84cc16', '#22c55e'],
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function boardPalette(id: string): [string, string] {
  return PALETTES[hash(id) % PALETTES.length];
}

export function boardGradient(id: string): string {
  const [a, b] = boardPalette(id);
  return `linear-gradient(135deg, ${a}, ${b})`;
}
