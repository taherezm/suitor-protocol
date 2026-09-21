/**
 * Guilloche: the engraved line-work on banknotes and share certificates.
 *
 * Every function here is pure and deterministic. There is no Math.random and no
 * dependence on time or environment, and every coordinate is rounded to two
 * decimals, so the server and the client emit byte-identical path data and
 * React never reports a hydration mismatch.
 *
 * The whole file is one idea repeated three ways. A *family* is a set of curves
 * that differ only by a phase, and the phases step evenly through a full turn.
 * Overlay a family and its members weave into a rope: the lines bunch where the
 * wave is stationary and cross where it is steep, and the crossings beat against
 * one another into the moire that reads, instantly, as money. A real engine
 * lathe works the same way, cutting one curve many times and advancing the
 * workpiece by a fraction of a lobe between cuts.
 *
 * - `band` runs a family along a straight line under a swelling envelope.
 * - `rosette` wraps families around a centre as concentric rings.
 * - `border` sweeps the band family around a rounded rectangle.
 *
 * Output is grouped: one `<path>` per opacity tier, each holding many subpaths,
 * so a drawing of forty curves is still a handful of DOM nodes.
 */

/** Two decimals is under a tenth of a pixel at every viewBox we use. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampInt(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, Math.round(value)));
}

export type Point = readonly [number, number];

/** `M x,y x,y x,y`, after a moveto, bare coordinate pairs are implicit linetos. */
export function toPath(points: readonly Point[], close = false): string {
  if (points.length === 0) return "";
  let d = `M${round(points[0][0])},${round(points[0][1])}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` ${round(points[i][0])},${round(points[i][1])}`;
  }
  return close ? `${d}Z` : d;
}

export interface GuillochePath {
  /** SVG path data, usually many subpaths concatenated into one `d`. */
  readonly d: string;
  /** Per-tier stroke-opacity, layered so crossings read as depth. */
  readonly opacity: number;
}

/** Collect subpaths into one `<path>` per opacity tier, dropping empty tiers. */
function group(
  tiers: readonly (readonly string[])[],
  opacities: readonly number[],
): GuillochePath[] {
  const paths: GuillochePath[] = [];
  for (let tier = 0; tier < tiers.length; tier += 1) {
    const d = tiers[tier].join("");
    if (d) paths.push({ d, opacity: opacities[tier] });
  }
  return paths;
}

/* ------------------------------------------------------------------- band */

const BAND_WIDTH = 1200;
const BAND_HEIGHT = 90;
const BAND_MID = BAND_HEIGHT / 2;
const BAND_SAMPLES = 240;

/** Whole cycles of the carrier across the width, so the band closes at both ends. */
const BAND_FREQUENCY = 7;
/** Times the rope swells and pinches across the width. Coprime with the carrier,
 *  so the crossings drift instead of stacking into one repeating tile. */
const BAND_LOBES = 8;
/** One harmonic, shared by the whole family, so the rope twists as it runs. */
const BAND_HARMONIC = 3;
const BAND_HARMONIC_AMP = 0.3;
/** Half the tube at full swell: 31 * 1.3 = 40.3 of the 45 half-height. */
const BAND_AMPLITUDE = 31;
/** The pinch never closes completely, or the nodes would read as breaks. */
const BAND_ENV_FLOOR = 0.14;

const BAND_OPACITY = [1, 0.92, 0.82, 0.72];

/** `density` 4..12 maps onto 28..40 curves. */
function bandCurveCount(density: number): number {
  return 28 + Math.round((clampInt(density, 4, 12) - 4) * 1.5);
}

/** A smooth swell: 1 at the crest, `BAND_ENV_FLOOR` at each node. */
function envelope(u: number, lobes: number, floor: number): number {
  return floor + (1 - floor) * Math.sin(Math.PI * lobes * u) ** 2;
}

/**
 * One member of the band family:
 * `y = mid + A * env(x) * sin(2pi f x/W + phase)`, plus a third harmonic that
 * every member shares, which swings the whole tube rather than its weave.
 */
function bandCurve(phase: number): string {
  const points: Point[] = [];
  for (let i = 0; i <= BAND_SAMPLES; i += 1) {
    const u = i / BAND_SAMPLES;
    const carrier = Math.sin(2 * Math.PI * BAND_FREQUENCY * u + phase);
    const twist =
      BAND_HARMONIC_AMP *
      Math.sin(2 * Math.PI * BAND_FREQUENCY * BAND_HARMONIC * u);
    const swing =
      BAND_AMPLITUDE *
      envelope(u, BAND_LOBES, BAND_ENV_FLOOR) *
      (carrier + twist);
    points.push([u * BAND_WIDTH, BAND_MID + swing]);
  }
  return toPath(points);
}

/**
 * A woven band for viewBox `0 0 1200 90`: 28 to 40 curves of one frequency whose
 * phases step evenly through a full turn, so together they fill a tube that the
 * envelope swells and pinches eight times across the width.
 * `density` is clamped to 4..12 (default 8); higher is denser.
 */
export function bandPaths(density = 8): GuillochePath[] {
  const curves = bandCurveCount(density);
  const tiers: string[][] = BAND_OPACITY.map(() => []);
  for (let i = 0; i < curves; i += 1) {
    tiers[i % BAND_OPACITY.length].push(bandCurve((2 * Math.PI * i) / curves));
  }
  return group(tiers, BAND_OPACITY);
}

/* ---------------------------------------------------------------- rosette */

const ROSETTE_CENTRE = 500;

interface Ring {
  /** Mean radius of the ring. */
  readonly radius: number;
  /** Primary modulation: amplitude, then lobe count. */
  readonly wave: number;
  readonly lobes: number;
  /** Secondary modulation, carried at twice the phase. This makes the lace. */
  readonly ripple: number;
  readonly ripples: number;
  /** Members of this ring, their phases stepped through a full turn. */
  readonly copies: number;
  /** Samples per member: about six per cycle of the curve's fast term. */
  readonly samples: number;
  readonly opacity: number;
}

/**
 * Hand-picked, never generated. Lobe counts are odd and mutually prime where
 * they can be, so neighbouring rings never fall into step with each other. The
 * innermost ring stops at r=118, leaving the middle open the way the portrait
 * window on a certificate is left open.
 */
const ROSETTE_RINGS: readonly Ring[] = [
  {
    radius: 430,
    wave: 34,
    lobes: 13,
    ripple: 11,
    ripples: 22,
    copies: 34,
    samples: 140,
    opacity: 1,
  },
  {
    radius: 352,
    wave: 27,
    lobes: 17,
    ripple: 9,
    ripples: 20,
    copies: 30,
    samples: 134,
    opacity: 0.88,
  },
  {
    radius: 278,
    wave: 22,
    lobes: 11,
    ripple: 8,
    ripples: 18,
    copies: 28,
    samples: 126,
    opacity: 0.78,
  },
  {
    radius: 206,
    wave: 17,
    lobes: 19,
    ripple: 6,
    ripples: 19,
    copies: 26,
    samples: 118,
    opacity: 0.68,
  },
  {
    radius: 136,
    wave: 13,
    lobes: 7,
    ripple: 5,
    ripples: 14,
    copies: 24,
    samples: 110,
    opacity: 0.58,
  },
];

/** Concentric hairline rules, the way a certificate is ruled before engraving. */
const ROSETTE_RULES: readonly number[] = [486, 320, 118];

/** A circle as two half-arcs, which is shorter than sampling one. */
function rulePath(radius: number): string {
  const r = round(radius);
  const span = round(radius * 2);
  return `M${round(ROSETTE_CENTRE - radius)},${ROSETTE_CENTRE}a${r},${r} 0 1,0 ${span},0a${r},${r} 0 1,0 ${-span},0`;
}

/** `r = R + a*sin(k*theta + phase) + b*sin(m*theta + 2*phase)`, closed. */
function ringCurve(ring: Ring, phase: number): string {
  const points: Point[] = [];
  for (let i = 0; i < ring.samples; i += 1) {
    const theta = (2 * Math.PI * i) / ring.samples;
    const radius =
      ring.radius +
      ring.wave * Math.sin(ring.lobes * theta + phase) +
      ring.ripple * Math.sin(ring.ripples * theta + 2 * phase);
    points.push([
      ROSETTE_CENTRE + radius * Math.cos(theta),
      ROSETTE_CENTRE + radius * Math.sin(theta),
    ]);
  }
  return toPath(points, true);
}

/**
 * A medallion for viewBox `0 0 1000 1000`, centred on 500,500: three hairline
 * rules plus concentric rings, each ring a family of 24 to 34 phase-shifted rose
 * curves. Dense enough to read as the seal on a share certificate, and open in
 * the middle.
 * `density` is the number of rings (clamped to 3..5 of the five defined).
 */
export function rosettePaths(density = 6): GuillochePath[] {
  const rings = clampInt(density - 2, 3, ROSETTE_RINGS.length);
  const tiers: string[][] = [ROSETTE_RULES.map(rulePath)];
  const opacities: number[] = [0.5];
  for (let r = 0; r < rings; r += 1) {
    const ring = ROSETTE_RINGS[r];
    const family: string[] = [];
    for (let copy = 0; copy < ring.copies; copy += 1) {
      family.push(ringCurve(ring, (2 * Math.PI * copy) / ring.copies));
    }
    tiers.push(family);
    opacities.push(ring.opacity);
  }
  return group(tiers, opacities);
}

/* ----------------------------------------------------------------- border */

const BORDER_WIDTH = 1200;
const BORDER_HEIGHT = 600;
const BORDER_RADIUS = 56;
const BORDER_SAMPLES = 420;

/** Whole cycles around the perimeter, so the engraving closes on itself. The
 *  band's shared harmonic is left off here: the perimeter is 3,500 units long,
 *  and three times this rate would fall below four samples a cycle and alias. */
const BORDER_CYCLES = 40;
const BORDER_LOBES = 24;
/** Centre line of the rope, measured inward from the frame edge. */
const BORDER_INSET = 20;
const BORDER_AMPLITUDE = 12;
const BORDER_ENV_FLOOR = 0.16;
/** The two plain rules the rope runs between. */
const BORDER_RULES: readonly number[] = [3, 39];

const BORDER_OPACITY = [1, 0.9, 0.8, 0.7];

interface Walked {
  readonly x: number;
  readonly y: number;
  /** Outward unit normal at this point on the frame. */
  readonly nx: number;
  readonly ny: number;
}

interface Segment {
  readonly length: number;
  readonly at: (u: number) => Walked;
}

function straight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  nx: number,
  ny: number,
): Segment {
  return {
    length: Math.hypot(x1 - x0, y1 - y0),
    at: (u) => ({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, nx, ny }),
  };
}

function corner(
  cx: number,
  cy: number,
  radius: number,
  from: number,
  to: number,
): Segment {
  return {
    length: Math.abs(to - from) * radius,
    at: (u) => {
      const angle = from + (to - from) * u;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      return { x: cx + nx * radius, y: cy + ny * radius, nx, ny };
    },
  };
}

/** Clockwise from the top-left corner, with an outward normal at every point. */
function frameSegments(w: number, h: number, k: number): Segment[] {
  const half = Math.PI / 2;
  return [
    straight(k, 0, w - k, 0, 0, -1),
    corner(w - k, k, k, -half, 0),
    straight(w, k, w, h - k, 1, 0),
    corner(w - k, h - k, k, 0, half),
    straight(w - k, h, k, h, 0, 1),
    corner(k, h - k, k, half, Math.PI),
    straight(0, h - k, 0, k, -1, 0),
    corner(k, k, k, Math.PI, Math.PI * 1.5),
  ];
}

/** Turns an arc-length fraction of the perimeter into a point and a normal. */
function frameWalker(segments: readonly Segment[]): (u: number) => Walked {
  const starts: number[] = [];
  let perimeter = 0;
  for (const part of segments) {
    starts.push(perimeter);
    perimeter += part.length;
  }
  return (u) => {
    const target = u * perimeter;
    let index = segments.length - 1;
    while (index > 0 && target < starts[index]) index -= 1;
    const part = segments[index];
    const local = (target - starts[index]) / part.length;
    return part.at(Math.min(1, Math.max(0, local)));
  };
}

/** `density` 2..6 maps onto 24..40 swept curves. */
function borderCurveCount(density: number): number {
  return 24 + (clampInt(density, 2, 6) - 2) * 4;
}

/**
 * A certificate frame for viewBox `0 0 1200 600`: the band family swept along a
 * rounded rectangle, so the rope runs unbroken through the corners, ruled top
 * and bottom by two plain lines. Every curve rides inward of the frame edge, so
 * nothing is clipped by the viewBox.
 * `density` is clamped to 2..6 (default 4); higher is denser.
 */
export function borderPaths(density = 4): GuillochePath[] {
  const curves = borderCurveCount(density);
  const walk = frameWalker(
    frameSegments(BORDER_WIDTH, BORDER_HEIGHT, BORDER_RADIUS),
  );

  /** Ride the frame at a fixed or modulated distance inward from its edge. */
  function sweep(phase: number, amplitude: number): string {
    const points: Point[] = [];
    for (let i = 0; i < BORDER_SAMPLES; i += 1) {
      const u = i / BORDER_SAMPLES;
      const spot = walk(u);
      const swing =
        BORDER_INSET +
        amplitude *
          envelope(u, BORDER_LOBES, BORDER_ENV_FLOOR) *
          Math.sin(2 * Math.PI * BORDER_CYCLES * u + phase);
      points.push([spot.x - spot.nx * swing, spot.y - spot.ny * swing]);
    }
    return toPath(points, true);
  }

  const tiers: string[][] = BORDER_OPACITY.map(() => []);
  for (let c = 0; c < curves; c += 1) {
    tiers[c % BORDER_OPACITY.length].push(
      sweep((2 * Math.PI * c) / curves, BORDER_AMPLITUDE),
    );
  }
  const paths = group(tiers, BORDER_OPACITY);
  // Two plain rules, the way a certificate is ruled before it is engraved.
  const rules = BORDER_RULES.map((inset) =>
    toPath(
      Array.from({ length: BORDER_SAMPLES }, (_, i) => {
        const spot = walk(i / BORDER_SAMPLES);
        return [spot.x - spot.nx * inset, spot.y - spot.ny * inset] as Point;
      }),
      true,
    ),
  );
  paths.push({ d: rules.join(""), opacity: 0.55 });
  return paths;
}
