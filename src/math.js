/** Small deterministic helpers. No assets are downloaded for the landscape. */
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function randomGenerator(seed = 1704204) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function noise2(x, y) {
  const hash = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smoothstep(0, 1, x - ix), fy = smoothstep(0, 1, y - iy);
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx),
    lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
}
export const RADIUS = 27;
export const riverX = z => 2.8 * Math.sin(z * 0.095) + 1.3 * Math.sin(z * 0.24);
export const riverWidth = z => 1.7 + 0.24 * Math.sin(z * 0.35);
export const pathZ = x => 3 + 3.7 * Math.sin(x * 0.15) * (1 - Math.exp(-Math.pow(x - riverX(3), 2) / 60));
export function terrainHeight(x, z) {
  const base = 0.7 + 0.45 * Math.sin(x * 0.17) * Math.cos(z * 0.14)
    + 0.25 * Math.sin(z * 0.3 + x * 0.06);
  const bank = smoothstep(riverWidth(z) - 0.08, riverWidth(z) + 1.55, Math.abs(x - riverX(z)));
  const rim = smoothstep(RADIUS - 2, RADIUS + 0.4, Math.hypot(x, z));
  return lerp(lerp(-0.45, base, bank), -0.25, rim);
}
export function seasonalState(phase) {
  phase = ((phase % 4) + 4) % 4;
  const winter = smoothstep(2.1, 2.95, phase) * (1 - smoothstep(3.05, 3.96, phase));
  const fall = smoothstep(1.5, 2.0, phase) * (1 - smoothstep(2.65, 3.05, phase));
  // A small amount of foliage can drift in every season, while autumn is by far the strongest.
  // Values are interpolated continuously so both density and shader color transition smoothly.
  const seasonalFallDensity = [0.18, 0.10, 1.0, 0.20, 0.18];
  const section = Math.floor(phase);
  const blend = smoothstep(0, 1, phase - section);
  const leafFall = lerp(seasonalFallDensity[section], seasonalFallDensity[section + 1], blend);
  // Sakura blossoms are strongest in early/mid spring and begin appearing as winter ends.
  const spring = Math.max(1 - smoothstep(0.55, 0.98, phase), smoothstep(3.55, 3.98, phase));
  // Petal fall peaks after the blossom canopy is established, then fades before summer.
  const springPetals = smoothstep(0.14, 0.34, phase) * (1 - smoothstep(0.72, 0.96, phase));
  return { phase, winter, fall, leafFall, spring, springPetals, coverage: lerp(1, 0.065, winter) };
}
