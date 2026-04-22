// Buckets sind log-artig im 1-2-5-Raster. Verhältnis obere/untere Grenze ≤ 5,
// d.h. aus "500+" kann ein Beobachter "zwischen 500 und 999" ableiten — zu grob,
// um aus einer bekannten Zieh-Chance einen belastbaren Pack-Bedarf zu errechnen.
// Unter 50 geöffneten Packs wird kein Zahlen-Signal zurückgegeben; der Aufrufer
// entscheidet, ob dort ein "Neu"-Badge angezeigt wird.
// Muss absteigend nach `min` sortiert bleiben — bucketPacksOpened bricht bei der
// ersten passenden Schwelle ab, umgedreht würde jeder Wert ≥ 50 als "50+" gelabelt.
const BUCKETS: Array<{ min: number; label: string }> = [
  { min: 100_000, label: "100k+" },
  { min: 50_000, label: "50k+" },
  { min: 10_000, label: "10k+" },
  { min: 5_000, label: "5k+" },
  { min: 1_000, label: "1k+" },
  { min: 500, label: "500+" },
  { min: 100, label: "100+" },
  { min: 50, label: "50+" },
];

export function bucketPacksOpened(n: number): string | null {
  if (!Number.isFinite(n) || n < 50) return null;
  for (const b of BUCKETS) if (n >= b.min) return b.label;
  return null;
}
