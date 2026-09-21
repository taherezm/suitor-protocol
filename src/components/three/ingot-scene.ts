/**
 * The ingot renderer. Framework free on purpose: React owns the element and the
 * lifecycle, this module owns everything inside the canvas.
 *
 * The object on the page is the data. Each bar is one allocation, cast as a
 * platinum ingot and struck with its case id and its committed amount, so the
 * hero is a picture of the pool rather than a picture of an idea.
 *
 * Three rules hold the whole file together:
 *  - Nothing allocates inside the frame loop. Every vector, colour, matrix and
 *    target is built once at construction and mutated afterwards.
 *  - Timeline staging is a pure function of `progress`. Scrubbing backwards
 *    retraces the same states, because nothing is accumulated.
 *  - Everything expensive is procedural, built once, and reference counted at
 *    module scope. The page mounts two of these canvases and they share every
 *    texture between them; the last one to let go is the one that frees it.
 *
 * What makes the metal read as metal is the environment, not the lights. A
 * metal has no diffuse term at all: every pixel of it is a reflection of
 * something, so if there is nothing around it to reflect it is grey paint. The
 * studio below is therefore the real light rig, and the two punctual lights are
 * only there to put a hot point on a corner and to give the timeline something
 * to dim.
 */

import { dollars } from "@/lib/format";
import type * as T from "three";

type ThreeModule = typeof import("three");

export type IngotSceneMode = "hero" | "timeline";

export interface IngotSceneBar {
  id: string;
  label: string;
  amountCents: number;
}

export interface IngotSceneOptions {
  mode: IngotSceneMode;
  bars: IngotSceneBar[];
  reducedMotion: boolean;
  onActiveChange?: (id: string | null) => void;
}

export interface IngotSceneHandle {
  /** 0..1 scrub position. Timeline staging, and a small hero camera dolly. */
  setProgress(p: number): void;
  /** Pointer in normalised device coordinates, -1..1 on both axes. */
  setPointer(x: number, y: number, inside: boolean): void;
  setActive(id: string | null): void;
  /**
   * Starts the hero stack's descent. One shot: the stage sits below the fold,
   * so the entrance waits until it has been scrolled to rather than being
   * spent on a screen nobody is looking at. Calling it again does nothing, and
   * under reduced motion the bars are already settled.
   */
  playEntrance(): void;
  resize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

/* ---------- Proportions ----------
   A real cast bar: wide at the base, narrower across the top, with a broken
   edge. The trapezoid is what makes it read as bullion rather than as a box. */

const BAR_BOTTOM = 1;
const BAR_TOP = 0.78;
const BAR_HEIGHT = 0.34;
/**
 * The machined chamfer. It is rolled onto the four long edges by filleting the
 * profile itself, and onto the two end rims by the extruder, so one number
 * describes the whole edge treatment and every edge of the bar catches the same
 * highlight line.
 */
const CHAMFER = 0.035;
const CHAMFER_SEGMENTS = 6;
/** How far the fillet cuts back along each side of a profile corner. */
const FILLET = CHAMFER * 1.3;
const LEN_MAX = 2.4;
const LEN_MIN = 1.5;
/** How far a hovered bar slides out of the stack, along its own length. */
const PULL = 0.28;
/** The resting three-quarter view the hero stack sways around. */
const HERO_YAW = -0.46;
const TAU = Math.PI * 2;

/** How far the studio swings either side of rest, and how long a round trip
    takes. Slow enough to be a condition rather than an animation. */
const ENV_SWING = 0.35;
const ENV_PERIOD = 14;

/** Roughness written into the maps, before the material's own factor. */
const ROUGH_BASE = 0.78;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Frame-rate independent approach, so motion is identical at 60 and 120Hz. */
const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** A tiny deterministic generator: every procedural surface is the same on
    every load, and the two canvases agree on what a bar looks like. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hash(text: string) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/* ---------- Shared textures ----------
   The hero and the timeline are two renderers with two contexts, but they are
   drawing the same alloy and, usually, the same first bar. Generating a
   brushed field twice is wasted milliseconds and wasted memory, so every
   texture is taken from here by key and handed back on dispose. The last
   release frees it, which is what keeps a remount from leaking. */

interface CacheEntry {
  texture: T.Texture;
  refs: number;
}

const textureCache = new Map<string, CacheEntry>();

function acquireTexture(key: string, make: () => T.Texture): T.Texture {
  const hit = textureCache.get(key);
  if (hit) {
    hit.refs += 1;
    return hit.texture;
  }
  const texture = make();
  textureCache.set(key, { texture, refs: 1 });
  return texture;
}

function releaseTexture(key: string) {
  const hit = textureCache.get(key);
  if (!hit) return;
  hit.refs -= 1;
  if (hit.refs > 0) return;
  hit.texture.dispose();
  textureCache.delete(key);
}

/* ---------- Canvas helpers ---------- */

interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function surface(width: number, height: number, readBack = false): Surface {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext(
    "2d",
    readBack ? { willReadFrequently: true } : undefined,
  );
  if (!ctx) throw new Error("2d context unavailable");
  return { canvas, ctx };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function radialCanvas(stops: [number, string][], size = 256) {
  const { canvas, ctx } = surface(size, size);
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/* ---------- Height fields ----------
   Every surface detail on the bar is authored as one greyscale height field and
   then differentiated into a normal map and a roughness map. Keeping them from
   the same source is what stops the two disagreeing: a groove is never smooth
   in one map and rough in the other. */

/** Mid grey. Nothing above it is raised, nothing below it is cut. */
const LEVEL = 128;

/**
 * Brush marks, running along the canvas x axis, which the UVs put along the
 * length of the bar. Every stroke is drawn a second time a tile away so the
 * field is seamless across the repeat.
 */
function drawBrush(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  count: number,
  contrast: number,
) {
  const random = rng(seed);
  ctx.lineCap = "butt";
  for (let i = 0; i < count; i += 1) {
    const y = random() * height;
    const x = random() * width;
    const run = width * (0.08 + random() * 0.85);
    const swing = (random() - 0.5) * 2;
    const value = Math.round(LEVEL + swing * contrast);
    ctx.strokeStyle = `rgba(${value},${value},${value},${(0.1 + random() * 0.55).toFixed(3)})`;
    ctx.lineWidth = 0.5 + random() * 2.1;
    for (let tile = -1; tile <= 1; tile += 1) {
      const start = x + tile * width;
      if (start > width || start + run < 0) continue;
      ctx.beginPath();
      ctx.moveTo(start, y);
      ctx.lineTo(start + run, y);
      ctx.stroke();
    }
  }
}

/**
 * The poured look. A cast bar cools unevenly and its top is never flat: it is
 * a slow, shallow, slightly lopsided ripple that catches the softbox as a wide
 * smear rather than a clean band.
 */
function drawPour(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
) {
  const random = rng(seed);
  for (let i = 0; i < 46; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = height * (0.24 + random() * 0.72);
    const up = random() > 0.5;
    const amount = 0.05 + random() * 0.09;
    const value = up ? 255 : 0;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(
      0,
      `rgba(${value},${value},${value},${amount.toFixed(3)})`,
    );
    blob.addColorStop(1, `rgba(${value},${value},${value},0)`);
    ctx.fillStyle = blob;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

interface DerivedMaps {
  normal: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
}

/**
 * Sobel, once, into both maps.
 *
 * The roughness runs the other way from the height on purpose: a raised burr is
 * burnished and reflects cleanly, the floor of a struck letter is torn and
 * scatters, which is the difference between text that was pressed into metal
 * and text that was printed on it.
 */
function deriveMaps(
  height: HTMLCanvasElement,
  options: { strength: number; spread: number; wrap: boolean },
): DerivedMaps {
  const w = height.width;
  const h = height.height;
  const read = height.getContext("2d", { willReadFrequently: true });
  if (!read) throw new Error("2d context unavailable");
  const source = read.getImageData(0, 0, w, h).data;

  // Lift the one channel that matters out of the RGBA first: the inner loop
  // runs a million times on the brushed field and every indirection in it costs
  // the whole scene's start-up budget.
  const grey = new Uint8Array(w * h);
  for (let i = 0; i < grey.length; i += 1) grey[i] = source[i * 4];

  const normal = surface(w, h);
  const rough = surface(w, h);
  const normalData = normal.ctx.createImageData(w, h);
  const roughData = rough.ctx.createImageData(w, h);
  const nOut = normalData.data;
  const rOut = roughData.data;

  const step = (v: number, max: number) =>
    options.wrap ? ((v % max) + max) % max : v < 0 ? 0 : v >= max ? max - 1 : v;

  const base = Math.round(ROUGH_BASE * 255);
  for (let y = 0; y < h; y += 1) {
    const r0 = step(y - 1, h) * w;
    const r1 = y * w;
    const r2 = step(y + 1, h) * w;
    for (let x = 0; x < w; x += 1) {
      const x0 = step(x - 1, w);
      const x2 = step(x + 1, w);
      const tl = grey[r0 + x0];
      const tc = grey[r0 + x];
      const tr = grey[r0 + x2];
      const ml = grey[r1 + x0];
      const mc = grey[r1 + x];
      const mr = grey[r1 + x2];
      const bl = grey[r2 + x0];
      const bc = grey[r2 + x];
      const br = grey[r2 + x2];

      const gx = (tr + 2 * mr + br - (tl + 2 * ml + bl)) / 1020;
      const gy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) / 1020;

      // The canvas runs its rows downward and the texture runs v upward, so the
      // vertical gradient is used as it comes out rather than negated.
      let nx = -gx * options.strength;
      let ny = gy * options.strength;
      const nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;

      const i = (r1 + x) * 4;
      nOut[i] = Math.round((nx * 0.5 + 0.5) * 255);
      nOut[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nOut[i + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      nOut[i + 3] = 255;

      const value = base - (mc - LEVEL) * options.spread;
      const clamped = value < 24 ? 24 : value > 255 ? 255 : value;
      rOut[i] = clamped;
      rOut[i + 1] = clamped;
      rOut[i + 2] = clamped;
      rOut[i + 3] = 255;
    }
  }

  normal.ctx.putImageData(normalData, 0, 0);
  rough.ctx.putImageData(roughData, 0, 0);
  return { normal: normal.canvas, roughness: rough.canvas };
}

/* ---------- The strike ----------
   Struck, not printed. The stamp is cut into the same height field the brush
   marks live in: a blurred bright halo first, which is the burr the die pushes
   up around the incision, then the sharp dark cut inside it. Everything after
   that is the differentiation above, so the letters are lit by the room like
   the rest of the bar rather than pasted over it. */

function engineTurn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.lineWidth = Math.max(1.2, r * 0.045);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.44, 0, TAU);
  ctx.stroke();
  // Three cuts of one nine-lobed curve, rotated between passes: the same trick
  // the engine-turning lathe plays, and the same interference.
  ctx.lineWidth = Math.max(1, r * 0.032);
  for (let pass = 0; pass < 3; pass += 1) {
    const phase = (pass * TAU) / 27;
    ctx.beginPath();
    for (let i = 0; i <= 180; i += 1) {
      const t = (i / 180) * TAU + phase;
      const rr = r * (0.72 + 0.16 * Math.cos(9 * t));
      const px = x + Math.cos(t) * rr;
      const py = y + Math.sin(t) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

/** The three real labels and the ring mark, and nothing that claims an assay. */
function drawStrike(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bar: IngotSceneBar,
  mono: string,
) {
  // The type is sized against the short side, capped so that a short bar's
  // nearly square stamp does not grow lettering that runs off the end.
  const s = Math.min(height, width * 0.34);
  const inset = Math.max(5, s * 0.1);
  const cy = height / 2;
  const amount = dollars(bar.amountCents);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineJoin = "round";

  // The hallmark frame.
  ctx.lineWidth = Math.max(1.6, s * 0.013);
  roundRectPath(
    ctx,
    inset,
    inset,
    width - inset * 2,
    height - inset * 2,
    s * 0.11,
  );
  ctx.stroke();

  const ringR = s * 0.17;
  const ringX = inset + s * 0.06 + ringR;
  engineTurn(ctx, ringX, cy, ringR);

  const textX = ringX + ringR + s * 0.17;
  const rightX = width - inset - s * 0.16;
  const tracking = ctx as CanvasRenderingContext2D & { letterSpacing?: string };

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `500 ${(s * 0.105).toFixed(2)}px ${mono}`;
  if (typeof tracking.letterSpacing === "string") {
    tracking.letterSpacing = `${(s * 0.014).toFixed(2)}px`;
  }
  ctx.fillText("SUITOR POOL 01", textX, cy - s * 0.17, s * 1.3);
  if (typeof tracking.letterSpacing === "string")
    tracking.letterSpacing = "0px";

  ctx.font = `600 ${(s * 0.235).toFixed(2)}px ${mono}`;
  const idWidth = Math.min(ctx.measureText(bar.id).width, s * 1.35);
  ctx.fillText(bar.id, textX, cy + s * 0.115, s * 1.35);

  // The amount takes what the case id has left. A short bar's stamp is nearly
  // square, so the two can otherwise meet in the middle.
  ctx.textAlign = "right";
  ctx.font = `600 ${(s * 0.185).toFixed(2)}px ${mono}`;
  ctx.fillText(
    amount,
    rightX,
    cy + s * 0.055,
    Math.max(s * 0.5, rightX - (textX + idWidth + s * 0.16)),
  );
}

/**
 * One stamped patch of metal: brush marks, the poured ripple on the top face,
 * and the strike, all in one height field the size of the surface it covers so
 * the lettering is never stretched by a bar being shorter than another.
 */
function stampMaps(
  bar: IngotSceneBar,
  kind: "top" | "face",
  mono: string,
  aspect: number,
): DerivedMaps {
  // The sheet is cut to the shape of the surface it covers, so the lettering is
  // never stretched by one bar being shorter than another. Both patches are
  // proportioned to keep this under about six to one, which is what keeps a
  // thin strip from being resolved into a handful of rows.
  const width = 1024;
  const height = Math.max(
    128,
    Math.min(768, Math.round(width / Math.max(aspect, 1.4))),
  );
  const { canvas, ctx } = surface(width, height, true);
  const seed = hash(`${bar.id}:${kind}`);

  ctx.fillStyle = `rgb(${LEVEL},${LEVEL},${LEVEL})`;
  ctx.fillRect(0, 0, width, height);

  if (kind === "top") drawPour(ctx, width, height, seed ^ 0x9e37);
  drawBrush(
    ctx,
    width,
    height,
    seed,
    kind === "top" ? 900 : 1100,
    kind === "top" ? 26 : 40,
  );

  // The strike is drawn white on transparent first, so it can be used twice:
  // blurred and added as the burr, then filled dark as the incision.
  const mask = surface(width, height);
  drawStrike(mask.ctx, width, height, bar, mono);

  const cut = surface(width, height);
  cut.ctx.drawImage(mask.canvas, 0, 0);
  cut.ctx.globalCompositeOperation = "source-in";
  cut.ctx.fillStyle = "#000000";
  cut.ctx.fillRect(0, 0, width, height);

  const halo = Math.max(2, width * 0.0035);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.5;
  ctx.filter = `blur(${halo.toFixed(2)}px)`;
  ctx.drawImage(mask.canvas, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.filter = `blur(${(width * 0.0009).toFixed(2)}px)`;
  ctx.drawImage(cut.canvas, 0, 0);
  ctx.restore();

  return deriveMaps(canvas, {
    strength: kind === "top" ? 3.4 : 3.8,
    spread: 0.85,
    wrap: false,
  });
}

/**
 * A feather, so a patch of stamped metal dissolves into the bar around it
 * instead of ending on a visible rectangle.
 *
 * Opaque black behind the shape, not transparency: an alpha map is read from
 * the green channel, and a canvas that fades its alpha out comes back off the
 * upload with its colour un-premultiplied to full white everywhere, which is a
 * mask that masks nothing.
 */
function featherCanvas(edge: number) {
  const size = 256;
  const { canvas, ctx } = surface(size, size);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);
  const pad = size * edge;
  ctx.filter = `blur(${(pad * 0.62).toFixed(2)}px)`;
  ctx.fillStyle = "#ffffff";
  roundRectPath(ctx, pad, pad, size - pad * 2, size - pad * 2, pad * 1.4);
  ctx.fill();
  ctx.filter = "none";
  return canvas;
}

/** The blurred footprint under a bar, and between two bars. */
function contactCanvas() {
  const size = 256;
  const { canvas, ctx } = surface(size, size);
  ctx.filter = "blur(30px)";
  ctx.fillStyle = "#000000";
  roundRectPath(ctx, 58, 58, size - 116, size - 116, 38);
  ctx.fill();
  ctx.filter = "none";
  return canvas;
}

/* ---------- The studio ----------
   A black room with five panels in it, baked to a cube map. Each panel carries
   a soft falloff rather than a flat value, because a softbox that is uniformly
   bright reflects as a flat patch, and a flat patch is exactly the grey plastic
   this is replacing. The two sides are deliberately unequal: a face that is the
   same brightness on both edges reads as painted. */

function buildStudio(THREE: ThreeModule, renderer: T.WebGLRenderer) {
  const { canvas, ctx } = surface(256, 256);
  const falloff = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  falloff.addColorStop(0, "#ffffff");
  falloff.addColorStop(0.42, "#d2d2d2");
  falloff.addColorStop(0.78, "#3c3c3c");
  falloff.addColorStop(1, "#000000");
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, 256, 256);
  const gradient = new THREE.CanvasTexture(canvas);
  gradient.colorSpace = THREE.SRGBColorSpace;

  const room = new THREE.Scene();
  const origin = new THREE.Vector3(0, 0, 0);
  const materials: T.MeshBasicMaterial[] = [];

  /* The walls of the room, as a graded dome rather than as black.
     A metal is nothing but a reflection of its surroundings, so a face that
     happens to point at a gap between panels goes to zero and reads as a hole
     punched in the object. A dim gradient everywhere means every face lands on
     a value, and the panels are then free to be the highlights rather than the
     only light in the room. */
  const wall = surface(4, 256);
  const sky = wall.ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#8d939c");
  sky.addColorStop(0.34, "#626973");
  // A brighter band a little above the horizon. A face slanted out from the
  // vertical reflects almost horizontally, so this narrow ring is what the
  // long sides of the bars are actually made of.
  sky.addColorStop(0.47, "#6e747d");
  sky.addColorStop(0.56, "#42464d");
  sky.addColorStop(0.74, "#282a2e");
  sky.addColorStop(1, "#1d1e20");
  wall.ctx.fillStyle = sky;
  wall.ctx.fillRect(0, 0, 4, 256);
  const walls = new THREE.CanvasTexture(wall.canvas);
  walls.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.SphereGeometry(24, 24, 16);
  const domeMaterial = new THREE.MeshBasicMaterial({
    map: walls,
    side: THREE.BackSide,
  });
  room.add(new THREE.Mesh(dome, domeMaterial));
  materials.push(domeMaterial);

  const panel = new THREE.PlaneGeometry(1, 1);

  function light(
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    intensity: number,
    colour: number,
  ) {
    const material = new THREE.MeshBasicMaterial({ map: gradient });
    material.color.setHex(colour).multiplyScalar(intensity);
    const mesh = new THREE.Mesh(panel, material);
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.lookAt(origin);
    room.add(mesh);
    materials.push(material);
  }

  // The overhead softbox, pulled forward: it is what lays the long gradient
  // down the top faces and then falls away over the front slope.
  light(11, 7.5, 0.9, 7.4, 2.6, 3.3, 0xffffff);
  // The left strip, the bright vertical edge that runs down the far faces.
  light(1.7, 9, -6.8, 2.1, 2.2, 2.6, 0xe9f0ff);
  // A narrow cool strip behind: the rim that cuts the bars out of the black.
  light(0.5, 6.5, -1.3, 2.9, -7.4, 5.6, 0xa8c9ff);
  // Right and rear, broad and low. A face slanted towards the camera reflects
  // up and away to this quarter, not back to the camera, so this is the panel
  // the near sides of the bars are actually made of. It is wide because the
  // stack sways, and a narrow source would slide off them and leave them black.
  // Barely warm, and only just: its asymmetry with the left strip is carried by
  // intensity, because any real colour in it and the alloy stops being platinum.
  light(10, 7, 8, 0.5, -1.7, 2.1, 0xfbf7f1);
  // The bounce card on the floor, and the fill standing where the camera is:
  // the end faces reflect straight back down the lens, and with nothing there
  // they are not dramatic, they are a hole.
  light(16, 16, 0, -4.6, 0.02, 0.34, 0xa6b2c6);
  light(17, 11, -1.6, 2.2, 9.4, 1.05, 0x8fa2c0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, 0.02, 0.1, 40);

  for (const material of materials) material.dispose();
  panel.dispose();
  dome.dispose();
  gradient.dispose();
  walls.dispose();
  room.clear();
  pmrem.dispose();

  return target;
}

/* ---------- Profile ----------
   The trapezoid, with every corner filleted. The extruder only rounds the two
   end rims; the four long edges are the profile's own corners, so they have to
   be rounded here or the bar keeps the razor edges that make it look pressed
   out of sheet. */

function barProfile(THREE: ThreeModule) {
  const hb = BAR_BOTTOM / 2;
  const ht = BAR_TOP / 2;
  const hh = BAR_HEIGHT / 2;
  const corners: [number, number][] = [
    [-hb, -hh],
    [hb, -hh],
    [ht, hh],
    [-ht, hh],
  ];

  const shape = new THREE.Shape();
  for (let i = 0; i < corners.length; i += 1) {
    const prev = corners[(i + corners.length - 1) % corners.length];
    const here = corners[i];
    const next = corners[(i + 1) % corners.length];

    const inX = prev[0] - here[0];
    const inY = prev[1] - here[1];
    const inLen = Math.hypot(inX, inY) || 1;
    const outX = next[0] - here[0];
    const outY = next[1] - here[1];
    const outLen = Math.hypot(outX, outY) || 1;

    const cut = Math.min(FILLET, inLen * 0.4, outLen * 0.4);
    const ax = here[0] + (inX / inLen) * cut;
    const ay = here[1] + (inY / inLen) * cut;
    const bx = here[0] + (outX / outLen) * cut;
    const by = here[1] + (outY / outLen) * cut;

    if (i === 0) shape.moveTo(ax, ay);
    else shape.lineTo(ax, ay);
    shape.quadraticCurveTo(here[0], here[1], bx, by);
  }
  shape.closePath();
  return shape;
}

/**
 * UVs in world units with u along the bar. Three's own generator puts the
 * length on v, which would lay the brush marks across the bar and point the
 * anisotropy the wrong way; everything downstream assumes u is the grain.
 */
function lengthwiseUVs(THREE: ThreeModule) {
  return {
    generateTopUV(
      _geometry: T.ExtrudeGeometry,
      vertices: number[],
      indexA: number,
      indexB: number,
      indexC: number,
    ) {
      return [indexA, indexB, indexC].map(
        (i) => new THREE.Vector2(vertices[i * 3], vertices[i * 3 + 1]),
      );
    },
    generateSideWallUV(
      _geometry: T.ExtrudeGeometry,
      vertices: number[],
      indexA: number,
      indexB: number,
      indexC: number,
      indexD: number,
    ) {
      const ax = vertices[indexA * 3];
      const ay = vertices[indexA * 3 + 1];
      const bx = vertices[indexB * 3];
      const by = vertices[indexB * 3 + 1];
      const across = Math.abs(ay - by) < Math.abs(ax - bx) ? 0 : 1;
      return [indexA, indexB, indexC, indexD].map(
        (i) => new THREE.Vector2(vertices[i * 3 + 2], vertices[i * 3 + across]),
      );
    },
  };
}

/**
 * Flat where it should be flat, rolled where it should be rolled.
 *
 * The extruder hands back a non-indexed mesh, so three's own normals are per
 * triangle and the chamfer arrives as six visible facets. Averaging everything
 * instead is worse: a flat face is two enormous triangles, so bending the
 * normals at its border smears a gradient across the entire face. So the six
 * real planes keep their own normal and everything else takes the mean of every
 * face meeting at that point. What is left is a crisp line where the face stops
 * and one continuous highlight running around the chamfer.
 */
function shadeBar(THREE: ThreeModule, geometry: T.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const array = position.array as Float32Array;
  const count = position.count;
  const faces = count / 3;

  const half = (BAR_BOTTOM - BAR_TOP) / 2;
  const slant = Math.hypot(BAR_HEIGHT, half);
  const planes = [
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [BAR_HEIGHT / slant, half / slant, 0],
    [-BAR_HEIGHT / slant, half / slant, 0],
  ];

  const faceNormals = new Float32Array(faces * 3);
  const flat = new Uint8Array(faces);

  for (let f = 0; f < faces; f += 1) {
    const i = f * 9;
    const ux = array[i + 3] - array[i];
    const uy = array[i + 4] - array[i + 1];
    const uz = array[i + 5] - array[i + 2];
    const vx = array[i + 6] - array[i];
    const vy = array[i + 7] - array[i + 1];
    const vz = array[i + 8] - array[i + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    faceNormals[f * 3] = nx;
    faceNormals[f * 3 + 1] = ny;
    faceNormals[f * 3 + 2] = nz;
    for (const plane of planes) {
      if (nx * plane[0] + ny * plane[1] + nz * plane[2] > 0.999) {
        flat[f] = 1;
        break;
      }
    }
  }

  // Coincident vertices come out of the extruder from the same arithmetic, so
  // they are bit identical and a quantised key finds all of them.
  const buckets = new Map<string, number[]>();
  for (let v = 0; v < count; v += 1) {
    const i = v * 3;
    const key = `${Math.round(array[i] * 1e4)},${Math.round(array[i + 1] * 1e4)},${Math.round(array[i + 2] * 1e4)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(v);
    else buckets.set(key, [v]);
  }

  const normals = new Float32Array(count * 3);
  for (const bucket of buckets.values()) {
    for (const v of bucket) {
      const f = (v / 3) | 0;
      const i = v * 3;
      if (flat[f]) {
        normals[i] = faceNormals[f * 3];
        normals[i + 1] = faceNormals[f * 3 + 1];
        normals[i + 2] = faceNormals[f * 3 + 2];
        continue;
      }
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (const other of bucket) {
        const g = (other / 3) | 0;
        nx += faceNormals[g * 3];
        ny += faceNormals[g * 3 + 1];
        nz += faceNormals[g * 3 + 2];
      }
      const len = Math.hypot(nx, ny, nz) || 1;
      normals[i] = nx / len;
      normals[i + 1] = ny / len;
      normals[i + 2] = nz / len;
    }
  }

  geometry.deleteAttribute("normal");
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
}

/** The twelve edges of the bar as a prism, ignoring the chamfer. Used only for
    the hollow loss outline, where a wireframe of the chamfer would be noise. */
function prismEdges(THREE: ThreeModule, length: number) {
  const hb = BAR_BOTTOM / 2;
  const ht = BAR_TOP / 2;
  const hh = BAR_HEIGHT / 2;
  const hl = length / 2;
  const ring: [number, number][] = [
    [-hb, -hh],
    [hb, -hh],
    [ht, hh],
    [-ht, hh],
  ];
  const points: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % 4];
    for (const z of [-hl, hl]) {
      points.push(a[0], a[1], z, b[0], b[1], z);
    }
    points.push(a[0], a[1], -hl, a[0], a[1], hl);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );
  return geometry;
}

/* ---------- Fonts ----------
   The stamp is drawn into a bitmap once, so it has to be drawn with the face
   the rest of the page uses rather than whatever the canvas falls back to
   before the webfont lands. */

const MONO_FALLBACK =
  'ui-monospace, SFMono-Regular, Menlo, "Liberation Mono", monospace';

async function monoStack(): Promise<string> {
  let declared = "";
  try {
    declared = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-mono")
      .trim();
  } catch {
    declared = "";
  }
  try {
    if (document.fonts) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 700)),
      ]);
    }
  } catch {
    // The stamp is drawn with whatever has loaded by now.
  }
  if (!declared) return MONO_FALLBACK;
  // A family list the canvas cannot parse is dropped silently and leaves the
  // default face behind, which would be a sans serif in a mono layout.
  try {
    const probe = surface(1, 1).ctx;
    probe.font = `600 40px ${declared}`;
    if (probe.font.indexOf("40px") === -1) return MONO_FALLBACK;
  } catch {
    return MONO_FALLBACK;
  }
  return `${declared}, ${MONO_FALLBACK}`;
}

/* ---------- Units ---------- */

interface BarUnit {
  id: string;
  /** Carries the base pose; the pull slides this along its own length. */
  group: T.Group;
  mesh: T.Mesh;
  material: T.MeshPhysicalMaterial;
  edges: T.LineSegments;
  edgeMaterial: T.LineBasicMaterial;
  decals: T.Mesh[];
  decalMaterials: T.MeshPhysicalMaterial[];
  /** The blurred footprint: on the floor, or on the bar underneath. */
  shadow: T.Mesh;
  shadowMaterial: T.MeshBasicMaterial;
  shadowY: number;
  shadowOpacity: number;
  /** The ghost under the floor. */
  mirror: T.Mesh;
  length: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  yaw: number;
  /** Damped state, all of it reversible. */
  offset: number;
  drop: number;
  brightness: number;
}

/* ---------- Hardware only ----------
   A context is not the same thing as a GPU. Headless Chromium, a VM and a
   browser that has blocklisted the driver all hand back a perfectly valid
   context backed by a software rasteriser, and a lit, antialiased, real-time
   scene on one of those is worse than not having it: every frame is rendered on
   the CPU, the main thread stalls, and a page that should feel instant does
   not. The SVG stand-in is the better object on those machines, and it is
   already drawn.

   The name is only readable where the debug extension is exposed. Where it is
   not, hardware is assumed: a browser hiding it is not the kind that lacks a
   GPU. */

const SOFTWARE =
  /swiftshader|llvmpipe|softpipe|software|basic render|generic renderer/i;

function isSoftwareRenderer(context: WebGLRenderingContext): boolean {
  try {
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    if (!debug) return false;
    const name = context.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    return typeof name === "string" && SOFTWARE.test(name);
  } catch {
    return false;
  }
}

export async function createIngotScene(
  canvas: HTMLCanvasElement,
  opts: IngotSceneOptions,
): Promise<IngotSceneHandle> {
  const THREE = await import("three");

  const { mode, reducedMotion, onActiveChange } = opts;
  const bars = opts.bars.length
    ? opts.bars
    : [{ id: "SP-000", label: "Allocation", amountCents: 25_000_000 }];

  let renderer: T.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    // Headless Chromium regularly has no GPU at all. The wrapper falls back.
    throw new Error("WebGL context unavailable", { cause: error });
  }
  const context = renderer.getContext();
  if (!context) {
    renderer.dispose();
    throw new Error("WebGL context unavailable");
  }
  if (isSoftwareRenderer(context)) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw new Error("WebGL is software rendered");
  }

  const disposables: { dispose: () => void }[] = [];
  /** Keys taken from the shared cache, handed back one for one on dispose. */
  const held: string[] = [];
  let disposed = false;

  try {
    const mono = await monoStack();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    function take(
      key: string,
      make: () => HTMLCanvasElement,
      setup?: (texture: T.CanvasTexture) => void,
    ) {
      const texture = acquireTexture(key, () => {
        const made = new THREE.CanvasTexture(make());
        made.anisotropy = maxAnisotropy;
        setup?.(made);
        return made;
      }) as T.CanvasTexture;
      held.push(key);
      return texture;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearAlpha(0);

    const scene = new THREE.Scene();
    // Fog is what lets the dust field leave rather than stop. The distances go
    // with the camera: it stands further back than it used to, for the longer
    // lens, and a fog tuned for the old one would grey the bars out.
    scene.fog = new THREE.Fog(0x050506, mode === "hero" ? 5.6 : 6.6, 17);

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
    // A longer lens and a longer throw. The same framing, but the far end of a
    // bar is no longer visibly smaller than the near end, which is the whole
    // difference between a product photograph and a video game.
    const cameraHome =
      mode === "hero"
        ? new THREE.Vector3(0, 2.46, 7.06)
        : new THREE.Vector3(0, 1.78, 6.32);
    /* Where the lens is aimed, which is what sets the vertical framing.
       In hero mode it is a little below the floor rather than at the bars: a
       stack aimed at dead centre hangs in the top half of the stage with its
       reflection trailing off the bottom, and aiming under the base lifts the
       whole object so that the bars and the reflection straddle the middle of
       the frame together. */
    const cameraTarget = new THREE.Vector3(
      0,
      mode === "hero" ? -0.21 : -0.1,
      0,
    );
    camera.position.copy(cameraHome);
    camera.lookAt(cameraTarget);

    /* Environment: the studio, baked once. */
    const envTarget = buildStudio(THREE, renderer);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 1;
    const envHome = scene.environmentIntensity;
    disposables.push(envTarget);

    const key = new THREE.SpotLight(0xffffff, 2.2, 0, 0.62, 0.9, 0);
    key.position.set(0.7, 4.2, 2.6);
    key.target.position.set(0, 0, 0);
    scene.add(key, key.target);

    const rim = new THREE.DirectionalLight(0xbcd0ff, 1.1);
    rim.position.set(-3.2, 1.4, -2.8);
    scene.add(rim);

    scene.add(new THREE.AmbientLight(0xffffff, 0.05));

    /* ---------- Floor ----------
       There is no grid, in either mode. A ruled floor turns the stage into a
       diagram, so the bars are grounded with light alone: a broad pool spread
       across the stage, a tighter pool right under the stack, and the blurred
       footprints sitting inside both. Nothing here draws a line.

       Order matters, and it is held by renderOrder rather than by position:
       the ghost under the floor first, then the pools, then the footprints,
       then the stamped patches, then the dust. */

    const floorY = -BAR_HEIGHT / 2 - 0.012;

    function floorPool(
      stops: [number, string][],
      scaleX: number,
      scaleZ: number,
      lift: number,
      additive: boolean,
      opacity: number,
    ) {
      const texture = new THREE.CanvasTexture(radialCanvas(stops));
      texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        fog: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(scaleX, 1, scaleZ);
      mesh.position.y = floorY + lift;
      mesh.renderOrder = -1;
      scene.add(mesh);
      disposables.push(texture, geometry, material);
      return mesh;
    }

    // The room the object is standing in.
    const spread = mode === "hero" ? 8 : 10;
    floorPool(
      [
        [0, "rgba(205,218,255,0.30)"],
        [0.45, "rgba(205,218,255,0.09)"],
        [1, "rgba(205,218,255,0)"],
      ],
      spread,
      spread * 0.84,
      -0.005,
      true,
      1,
    );

    // The pool the bars actually stand in. With the grid gone this is what
    // says there is a floor at all, so it is brighter and much tighter.
    floorPool(
      [
        [0, "rgba(214,226,255,0.44)"],
        [0.36, "rgba(205,218,255,0.13)"],
        [1, "rgba(205,218,255,0)"],
      ],
      mode === "hero" ? 4.8 : 5.4,
      mode === "hero" ? 3 : 3.2,
      -0.004,
      true,
      1,
    );

    /* ---------- Shared surfaces ---------- */

    /* The alloy's surface, shared by every bar on the page and by the other
       canvas. It tiles, so it is authored small and repeated: differentiating a
       megapixel of noise costs more main thread than the grain is worth, and at
       this density the repeat is not legible. */
    const BRUSH = 640;
    const brushHeight = surface(BRUSH, BRUSH, true);
    brushHeight.ctx.fillStyle = `rgb(${LEVEL},${LEVEL},${LEVEL})`;
    brushHeight.ctx.fillRect(0, 0, BRUSH, BRUSH);
    drawBrush(brushHeight.ctx, BRUSH, BRUSH, 0x51a7, 1700, 44);
    const brushed = deriveMaps(brushHeight.canvas, {
      strength: 2.6,
      spread: 0.9,
      wrap: true,
    });

    const repeatWrap = (texture: T.CanvasTexture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      // World-unit UVs, so one number sets the grain size on every bar.
      texture.repeat.set(3, 3);
    };

    const brushRoughness = take(
      "brush:rough",
      () => brushed.roughness,
      repeatWrap,
    );
    const brushNormal = take("brush:normal", () => brushed.normal, repeatWrap);
    const contactMap = take("contact", contactCanvas);
    const featherTop = take("feather:top", () => featherCanvas(0.022));
    const featherFace = take("feather:face", () => featherCanvas(0.075));

    /* ---------- Dust ----------
       Sparse, slow, and additive, so it reads as motes crossing the key light
       rather than as snow. */

    const dustCount = 160;
    const dustPositions = new Float32Array(dustCount * 3);
    const random = rng(0x5117);
    for (let i = 0; i < dustCount; i += 1) {
      dustPositions[i * 3] = (random() - 0.5) * 7;
      dustPositions[i * 3 + 1] = random() * 3.4 + floorY;
      dustPositions[i * 3 + 2] = (random() - 0.5) * 5;
    }
    const dustGeometry = new THREE.BufferGeometry();
    const dustAttribute = new THREE.BufferAttribute(dustPositions, 3);
    dustGeometry.setAttribute("position", dustAttribute);
    const dustMaterial = new THREE.PointsMaterial({
      color: 0xcbd8f2,
      size: 0.012,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.renderOrder = 3;
    scene.add(dust);
    disposables.push(dustGeometry, dustMaterial);

    /* ---------- The bars ---------- */

    const profile = barProfile(THREE);
    const uvGenerator = lengthwiseUVs(THREE);
    const geometryCache = new Map<string, T.ExtrudeGeometry>();
    const edgeCache = new Map<string, T.BufferGeometry>();

    const maxAmount = Math.max(...bars.map((bar) => bar.amountCents), 1);
    /** The slant of the long side, so a patch can lie flat against it. */
    const faceTilt = Math.atan2((BAR_BOTTOM - BAR_TOP) / 2, BAR_HEIGHT);
    const faceHeight = Math.hypot((BAR_BOTTOM - BAR_TOP) / 2, BAR_HEIGHT);
    /**
     * The extruder does not cut its rim into the profile, it grows the body out
     * by the bevel size and tapers the two ends back to the profile. So the
     * finished surface stands `CHAMFER` proud of the nominal trapezoid, and a
     * patch placed on the numbers rather than on the solid ends up buried
     * inside the bar.
     */
    const proud = CHAMFER;
    const topY = BAR_HEIGHT / 2 + proud;

    /* The ghost under the floor. One material for every copy: at a tenth of an
       opacity nobody is reading its brush marks, and the fade below the floor
       is what sells it as a polished surface rather than a second stack. */
    const mirrorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdfe3ea,
      metalness: 1,
      roughness: 0.42,
      envMapIntensity: 1,
      transparent: true,
      opacity: 0.095,
      depthWrite: false,
    });
    mirrorMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vDrop;")
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>\nvDrop = ${floorY.toFixed(4)} - ( modelMatrix * vec4( transformed, 1.0 ) ).y;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vDrop;")
        .replace(
          "#include <dithering_fragment>",
          "#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep( 0.02, 0.8, vDrop );",
        );
    };
    disposables.push(mirrorMaterial);

    function barGeometry(length: number) {
      const cacheKey = length.toFixed(4);
      const hit = geometryCache.get(cacheKey);
      if (hit) return hit;
      const geometry = new THREE.ExtrudeGeometry(profile, {
        depth: Math.max(0.2, length - CHAMFER * 2),
        bevelEnabled: true,
        bevelSize: CHAMFER,
        bevelThickness: CHAMFER,
        bevelSegments: CHAMFER_SEGMENTS,
        curveSegments: CHAMFER_SEGMENTS,
        steps: 1,
        UVGenerator: uvGenerator,
      });
      geometry.center();
      shadeBar(THREE, geometry);
      geometryCache.set(cacheKey, geometry);
      disposables.push(geometry);
      return geometry;
    }

    function barEdges(length: number) {
      const cacheKey = length.toFixed(4);
      const hit = edgeCache.get(cacheKey);
      if (hit) return hit;
      const geometry = prismEdges(THREE, length);
      edgeCache.set(cacheKey, geometry);
      disposables.push(geometry);
      return geometry;
    }

    function buildBar(
      bar: IngotSceneBar,
      length: number,
      id = bar.id,
    ): BarUnit {
      const geometry = barGeometry(length);

      /* Machined platinum. Metalness is one and stays one; the roughness map
         does the rest, and the material's own factor is the mean the map is
         written around, so the effective roughness is about 0.26. */
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xdfe3ea,
        metalness: 1,
        roughness: 0.34,
        roughnessMap: brushRoughness,
        normalMap: brushNormal,
        clearcoat: 0.35,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.15,
      });
      material.normalScale.set(0.34, 0.34);
      /* The grain runs along u, which the UV generator put along the bar, so
         the highlight stretches down the length the way brushed metal does.

         It is deliberately gentle. Three's anisotropy does not only stretch the
         lobe, it bends the direction the environment is sampled from, and past
         about a quarter that bend drags the whole long face off the bright band
         of the room and flattens it to one dead value. The brush marks are
         carried by the roughness and normal maps, which cost nothing; this is
         only the directional lobe on top of them. */
      material.anisotropy = 0.22;
      material.anisotropyRotation = 0;
      disposables.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      const group = new THREE.Group();
      group.add(mesh);

      const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
      });
      const edges = new THREE.LineSegments(barEdges(length), edgeMaterial);
      edges.visible = false;
      group.add(edges);
      disposables.push(edgeMaterial);

      const mirror = new THREE.Mesh(geometry, mirrorMaterial);
      mirror.renderOrder = -2;

      const shadowGeometry = new THREE.PlaneGeometry(1, 1);
      shadowGeometry.rotateX(-Math.PI / 2);
      const shadowMaterial = new THREE.MeshBasicMaterial({
        map: contactMap,
        color: 0x000000,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        fog: false,
      });
      const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
      shadow.renderOrder = 1;
      shadow.scale.set(length * 1.22, 1, BAR_BOTTOM * 1.75);
      disposables.push(shadowGeometry, shadowMaterial);

      const decals: T.Mesh[] = [];
      const decalMaterials: T.MeshPhysicalMaterial[] = [];

      /**
       * A stamped patch of the same alloy, laid on the face it belongs to and
       * feathered into it. It is not a decal in the old sense: it carries a
       * normal map and a roughness map and no colour at all, so the lettering
       * is lit by the studio exactly as the metal around it is, and turning the
       * bar moves the light inside the letters.
       */
      function patch(
        kind: "top" | "face",
        worldWidth: number,
        worldHeight: number,
        feather: T.Texture,
        place: (plane: T.PlaneGeometry) => void,
      ) {
        const aspect = worldWidth / worldHeight;
        const cacheKey = `stamp:${bar.id}:${bar.amountCents}:${kind}:${aspect.toFixed(3)}`;
        let maps: DerivedMaps | null = null;
        const build = () => {
          if (!maps) maps = stampMaps(bar, kind, mono, aspect);
          return maps;
        };
        const normalMap = take(`${cacheKey}:n`, () => build().normal);
        const roughnessMap = take(`${cacheKey}:r`, () => build().roughness);

        const decalMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xdfe3ea,
          metalness: 1,
          // The top of a cast bar is poured, not milled: softer, a shade
          // rougher, and much less directional than the machined sides.
          roughness: kind === "top" ? 0.44 : 0.34,
          roughnessMap,
          normalMap,
          alphaMap: feather,
          clearcoat: kind === "top" ? 0.22 : 0.35,
          clearcoatRoughness: kind === "top" ? 0.16 : 0.08,
          envMapIntensity: 1.15,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        });
        decalMaterial.normalScale.set(1.5, 1.5);
        decalMaterial.anisotropy = kind === "top" ? 0.1 : 0.22;
        decalMaterial.anisotropyRotation = 0;

        const plane = new THREE.PlaneGeometry(worldWidth, worldHeight);
        place(plane);
        const plate = new THREE.Mesh(plane, decalMaterial);
        plate.renderOrder = 2;
        group.add(plate);
        decals.push(plate);
        decalMaterials.push(decalMaterial);
        disposables.push(plane, decalMaterial);
      }

      // The whole flat top, so the poured ripple runs right out to the
      // chamfer. The plane is laid into the XZ plane and turned so that the
      // reading direction runs along the bar, not across it.
      patch(
        "top",
        Math.max(0.4, length - CHAMFER * 2 - 0.016),
        BAR_TOP - FILLET * 2 - 0.01,
        featherTop,
        (plane) => {
          plane.rotateX(-Math.PI / 2);
          plane.rotateY(Math.PI / 2);
          plane.translate(0, topY + 0.0018, 0);
        },
      );

      // Long front face, tilted to sit flat on the slant and lifted clear of
      // it along the face normal. A cartouche rather than a band running the
      // whole length: the slant is a narrow strip, and a stamp stretched end to
      // end across it has to be drawn at a resolution that cannot hold a letter.
      patch(
        "face",
        Math.max(0.4, length * 0.56),
        faceHeight - FILLET * 2 - 0.012,
        featherFace,
        (plane) => {
          plane.rotateY(Math.PI / 2);
          plane.rotateZ(faceTilt);
          // The midpoint of the slant, then out past the proud surface.
          const push = proud + 0.0018;
          plane.translate(
            (BAR_BOTTOM + BAR_TOP) / 4 + push * Math.cos(faceTilt),
            push * Math.sin(faceTilt),
            0,
          );
        },
      );

      return {
        id,
        group,
        mesh,
        material,
        edges,
        edgeMaterial,
        decals,
        decalMaterials,
        shadow,
        shadowMaterial,
        shadowY: floorY + 0.004,
        shadowOpacity: 0.72,
        mirror,
        length,
        baseX: 0,
        baseY: 0,
        baseZ: 0,
        yaw: 0,
        offset: 0,
        drop: 1,
        brightness: 1,
      };
    }

    const stack = new THREE.Group();
    scene.add(stack);

    /* The ghost is the stack reflected in the floor plane, so its transform is
       the stack's own run through one mirror matrix. Doing it as a matrix
       rather than as negated Euler angles is the only way it stays correct once
       the stack is both swaying and tilting. */
    const mirrorPlane = new THREE.Matrix4();
    mirrorPlane.set(1, 0, 0, 0, 0, -1, 0, 2 * floorY, 0, 0, 1, 0, 0, 0, 0, 1);
    const mirrorRoot = new THREE.Group();
    mirrorRoot.matrixAutoUpdate = false;
    scene.add(mirrorRoot);

    const units: BarUnit[] = [];
    const meshes: T.Mesh[] = [];

    function place(unit: BarUnit) {
      stack.add(unit.group);
      stack.add(unit.shadow);
      mirrorRoot.add(unit.mirror);
      units.push(unit);
      meshes.push(unit.mesh);
    }

    if (mode === "hero") {
      // Two below, one across the top: a bullion stack as it would be
      // photographed, not a diagram of one.
      const layout = [
        { x: -0.53, y: 0, z: 0.06, yaw: -0.04 },
        { x: 0.53, y: 0, z: -0.04, yaw: 0.05 },
        { x: 0.02, y: BAR_HEIGHT + 0.008, z: 0.02, yaw: 0.42 },
      ];
      bars.slice(0, 3).forEach((bar, index) => {
        const length = Math.max(
          LEN_MIN,
          LEN_MAX * (bar.amountCents / maxAmount),
        );
        const unit = buildBar(bar, length);
        const spot = layout[index] ?? layout[0];
        unit.baseX = spot.x;
        unit.baseY = spot.y;
        unit.baseZ = spot.z;
        unit.yaw = spot.yaw;
        unit.group.rotation.y = spot.yaw;
        unit.group.position.set(spot.x, spot.y, spot.z);
        unit.mirror.rotation.y = spot.yaw;
        // A bar resting on two others casts its footprint onto them, not onto
        // the floor, which is what stops the top bar looking pasted on.
        if (spot.y > 0) {
          unit.shadowY = spot.y - BAR_HEIGHT / 2 + 0.004;
          unit.shadowOpacity = 0.6;
        }
        place(unit);
      });
      stack.rotation.y = HERO_YAW;
    } else {
      // One allocation, and then the four endings it can have.
      const base = bars[0];
      const scenarios = [
        { key: "settlement", x: -2.4 },
        { key: "judgment", x: -0.8 },
        { key: "delayed", x: 0.8 },
        { key: "loss", x: 2.4 },
      ];
      scenarios.forEach((scenario) => {
        // The struck id stays the real case id: the suffix is this scene's
        // handle on the copy, not something that was ever stamped into metal.
        const unit = buildBar(base, LEN_MAX, `${base.id}-${scenario.key}`);
        unit.baseX = scenario.x;
        unit.baseY = 0;
        unit.baseZ = 0;
        place(unit);
      });
      // Only the first bar exists until the fork opens.
      for (let i = 1; i < units.length; i += 1) {
        units[i].group.visible = false;
        units[i].shadow.visible = false;
        units[i].mirror.visible = false;
      }

      const plinth = new THREE.BufferGeometry();
      plinth.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([-3.4, 0, 0, 3.4, 0, 0], 3),
      );
      const plinthMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.28,
      });
      const plinthLine = new THREE.LineSegments(plinth, plinthMaterial);
      plinthLine.position.y = -BAR_HEIGHT / 2 - 0.03;
      scene.add(plinthLine);
      disposables.push(plinth, plinthMaterial);
      stack.rotation.y = -0.22;
    }

    const scenarioScale = [1.2, 2, 1.1, 1];
    const scenarioDim = [1, 1, 0.55, 0.4];

    /* ---------- State ---------- */

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    /** Reused, because `intersectObjects` would otherwise allocate per frame. */
    const hits: T.Intersection<T.Object3D>[] = [];
    let pointerInside = false;
    let active: string | null = null;
    let progress = 0;
    let elapsed = 0;
    /** The entrance clock. It only runs once `playEntrance` has armed it. */
    let entrance = 0;
    let entranceArmed = false;
    let tiltX = 0;
    let tiltY = 0;
    let keyIntensity = key.intensity;
    const keyHome = key.intensity;
    let running = false;
    let frameId = 0;
    let lastTime = 0;

    function setActiveInternal(id: string | null, notify: boolean) {
      if (active === id) return;
      active = id;
      if (notify) onActiveChange?.(id);
    }

    /** The stack, reflected. Allocation free: two matrices, reused. */
    function syncMirror() {
      stack.updateMatrix();
      mirrorRoot.matrix.multiplyMatrices(mirrorPlane, stack.matrix);
      mirrorRoot.matrixWorldNeedsUpdate = true;
      for (let i = 0; i < units.length; i += 1) {
        const unit = units[i];
        unit.mirror.position.copy(unit.group.position);
        unit.mirror.rotation.y = unit.group.rotation.y;
        unit.mirror.scale.copy(unit.mesh.scale);
        unit.mirror.visible = unit.group.visible && unit.mesh.visible;
      }
    }

    /** The blurred footprint, kept under the bar wherever the bar has gone. */
    function syncShadow(unit: BarUnit, opacity: number) {
      unit.shadow.position.set(
        unit.group.position.x,
        unit.shadowY,
        unit.group.position.z,
      );
      unit.shadow.rotation.y = unit.group.rotation.y;
      unit.shadowMaterial.opacity = opacity;
      unit.shadow.visible = opacity > 0.004;
    }

    function updateHero(dt: number) {
      if (!reducedMotion) {
        elapsed += dt;
        // The stage lives below the fold, so the descent is held back until
        // the reader has actually arrived at it.
        if (entranceArmed) entrance += dt;
        // A slow sway rather than a full turn: it is unmistakably moving and
        // in three dimensions, and the struck faces never rotate out of sight.
        stack.rotation.y = HERO_YAW + Math.sin(elapsed * 0.13) * 0.26 + tiltY;
        stack.rotation.x = tiltX;
        stack.position.y = Math.sin(elapsed * 0.55) * 0.022;
        // The studio turns too, far more slowly than the stack. It is what
        // keeps the faces alive when nothing else is moving: the gradients
        // glide instead of sitting still.
        scene.environmentRotation.y =
          Math.sin((elapsed * TAU) / ENV_PERIOD) * ENV_SWING;
      } else {
        stack.rotation.y = HERO_YAW;
        stack.rotation.x = 0;
        scene.environmentRotation.y = 0.12;
      }

      if (pointerInside && !reducedMotion) {
        // The bars moved this frame and the renderer has not run yet, so the
        // ray would otherwise be cast against the previous frame's poses.
        camera.updateMatrixWorld();
        stack.updateMatrixWorld(true);
        hits.length = 0;
        raycaster.setFromCamera(pointer, camera);
        raycaster.intersectObjects(meshes, false, hits);
        const hit = hits.length ? hits[0].object : null;
        let found: string | null = null;
        for (let i = 0; i < units.length; i += 1) {
          if (units[i].mesh === hit) {
            found = units[i].id;
            break;
          }
        }
        setActiveInternal(found, true);
      }

      for (let i = 0; i < units.length; i += 1) {
        const unit = units[i];
        const isActive = unit.id === active;
        const settle = reducedMotion
          ? 1
          : easeOut(clamp01((entrance - i * 0.16) / 1.4));
        unit.drop = 1 - settle;
        const targetOffset = isActive ? PULL : 0;
        const targetBrightness = active === null ? 1 : isActive ? 1.65 : 0.62;
        // Under reduced motion a single frame is rendered per state change, so
        // a damped approach would stall a third of the way there.
        unit.offset = reducedMotion
          ? targetOffset
          : damp(unit.offset, targetOffset, 9, dt);
        unit.brightness = reducedMotion
          ? targetBrightness
          : damp(unit.brightness, targetBrightness, 8, dt);

        unit.material.envMapIntensity = 1.15 * unit.brightness;
        unit.material.roughness = lerp(
          0.37,
          0.28,
          clamp01(unit.brightness - 0.6),
        );
        const fade = Math.min(1, unit.brightness);
        for (const decalMaterial of unit.decalMaterials) {
          decalMaterial.opacity = fade;
          decalMaterial.envMapIntensity = 1.15 * unit.brightness;
        }

        unit.group.position.set(
          unit.baseX + Math.sin(unit.yaw) * unit.offset,
          unit.baseY + unit.drop * 1.9,
          unit.baseZ + Math.cos(unit.yaw) * unit.offset,
        );

        // A bar that has been pulled out of the stack has moved off what it was
        // resting on, and a bar still falling has not landed yet.
        const lift = clamp01(1 - unit.drop * 5);
        syncShadow(
          unit,
          unit.shadowOpacity * lift * (1 - (unit.offset / PULL) * 0.45),
        );
      }

      syncMirror();

      // The hero hands the stage over as it leaves: the camera steps back and
      // lifts, so the object recedes rather than scrolling away flat.
      camera.position.set(
        cameraHome.x,
        cameraHome.y + progress * 0.8,
        cameraHome.z + progress * 1.4,
      );
      camera.lookAt(cameraTarget);
    }

    function updateTimeline(dt: number) {
      elapsed += dt;
      const p = progress;

      // 0 to 0.15: the capital goes in. 0.15 to 0.55: nothing happens, and the
      // light leaves. 0.55 to 0.7: it comes back. 0.7 to 1: four endings.
      const arrive = easeOut(clamp01(p / 0.15));
      const wait = clamp01((p - 0.15) / 0.4);
      const ret = clamp01((p - 0.55) / 0.15);
      const fork = clamp01((p - 0.7) / 0.3);
      const forkEase = easeOut(fork);

      // The light goes down while the years pass, and it goes down a long way,
      // but it never goes out: a metal at a quarter of its room is not a dim
      // bar, it is a black hole in the canvas, and the reader stops being able
      // to see the object the section is about.
      const dim = lerp(1, 0.55, wait);
      const level = lerp(dim, 1, ret);
      keyIntensity = keyHome * level;
      key.intensity = keyIntensity;
      // A soft sweep crossing the bar while the years pass. It eases out of the
      // resting key position rather than jumping there at the phase boundary.
      key.position.set(
        lerp(0.7, lerp(-3.2, 3.2, wait), Math.min(1, wait * 6)),
        4.2,
        2.6,
      );
      // The same sweep, carried by the room. On a metal this is the part that
      // is actually visible: the reflections slide off the faces and the whole
      // bar goes cold, then they come back.
      scene.environmentRotation.y = reducedMotion
        ? 0.12
        : lerp(-0.42, 0.9, wait) * (1 - ret) + 0.12 * ret;
      scene.environmentIntensity = envHome * lerp(0.7, 1, level);

      const spin = reducedMotion ? 0 : lerp(0.05, 0.004, wait) * (1 - fork);
      stack.rotation.y = -0.22 + (reducedMotion ? 0 : elapsed * spin);

      for (let i = 0; i < units.length; i += 1) {
        const unit = units[i];
        const scale = lerp(1, scenarioScale[i] ?? 1, forkEase);
        unit.mesh.scale.z = scale;
        unit.edges.scale.z = scale;

        const visible = i === 0 ? true : fork > 0.001;
        unit.group.visible = visible;
        unit.group.position.set(
          0 + unit.baseX * forkEase,
          (1 - arrive) * 2.2,
          0,
        );

        const hollow = i === 3 && fork > 0;
        const dimTarget = lerp(1, scenarioDim[i] ?? 1, forkEase);
        unit.material.envMapIntensity = 1.15 * dimTarget * level;
        unit.material.transparent = hollow;
        unit.material.opacity = hollow ? 1 - forkEase : 1;
        unit.mesh.visible = !hollow || forkEase < 0.98;
        unit.edges.visible = hollow;
        unit.edgeMaterial.opacity = hollow ? 0.5 * forkEase : 0;

        // Text on a bar that is being stretched would lie, so it leaves.
        const decalOpacity = (1 - clamp01(fork * 4)) * (i === 0 ? 1 : 0);
        for (const decalMaterial of unit.decalMaterials) {
          decalMaterial.opacity = decalOpacity;
          decalMaterial.envMapIntensity = 1.15 * dimTarget * level;
          decalMaterial.visible = decalOpacity > 0.01;
        }

        unit.shadow.scale.z = BAR_BOTTOM * 1.75 * lerp(1, 1.1, forkEase);
        syncShadow(
          unit,
          visible && !hollow
            ? 0.66 * arrive * dimTarget * lerp(0.5, 1, level)
            : 0,
        );
      }

      syncMirror();

      camera.position.set(
        0,
        lerp(cameraHome.y, 3.85, forkEase),
        lerp(cameraHome.z, 8.6, forkEase),
      );
      // Aimed under the bar before the fork, for the same reason as the hero:
      // a single bar aimed at dead centre hangs low in a canvas this short.
      // The fork straightens up as the camera lifts away from it.
      cameraTarget.set(0, lerp(-0.1, 0, forkEase), lerp(0, 0.4, forkEase));
      camera.lookAt(cameraTarget);
      void dt;
    }

    function updateDust(dt: number) {
      if (reducedMotion) return;
      const array = dustAttribute.array as Float32Array;
      for (let i = 1; i < array.length; i += 3) {
        array[i] += dt * 0.042;
        if (array[i] > 2.9) array[i] = floorY;
      }
      dustAttribute.needsUpdate = true;
    }

    function renderFrame(dt: number) {
      if (mode === "hero") {
        if (!reducedMotion) {
          tiltX = damp(tiltX, pointerInside ? -pointer.y * 0.12 : 0, 5, dt);
          tiltY = damp(tiltY, pointerInside ? pointer.x * 0.12 : 0, 5, dt);
        }
        updateHero(dt);
      } else {
        updateTimeline(dt);
      }
      updateDust(dt);
      renderer.render(scene, camera);
    }

    function loop(now: number) {
      if (disposed) return;
      frameId = requestAnimationFrame(loop);
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
      lastTime = now;
      renderFrame(dt);
    }

    function renderOnce() {
      if (disposed) return;
      renderFrame(0.016);
    }

    function resize() {
      if (disposed) return;
      const width =
        canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
      const height =
        canvas.clientHeight || canvas.parentElement?.clientHeight || 0;
      if (width < 2 || height < 2) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      const aspect = width / height;
      camera.aspect = aspect;
      // A narrow stage needs a wider lens and a smaller object, or the stack
      // grows until it is touching both edges. The whole ladder is much tighter
      // than it used to be: the camera stands well back and the lens is long,
      // which both fills the stage and takes the divergence out of the bars.
      // The narrow rung is held back: there the stage is the width of a phone
      // and the binding edge is the side of the frame, not the top, so a bar
      // pulled out of the stack would run off it.
      camera.fov = aspect >= 1.9 ? 21 : aspect >= 1.2 ? 24 : 32;
      // The ghost picks the scale up through the mirror matrix, which is built
      // from the stack's own, so it is not set twice.
      stack.scale.setScalar(aspect < 1.2 ? 0.78 : 1);
      camera.updateProjectionMatrix();
      if (!running) renderOnce();
    }

    resize();
    renderOnce();

    return {
      setProgress(p: number) {
        const next = clamp01(p);
        if (next === progress) return;
        progress = next;
        if (!running || reducedMotion) renderOnce();
      },
      setPointer(x: number, y: number, inside: boolean) {
        if (reducedMotion) return;
        pointer.set(x, y);
        if (pointerInside !== inside) {
          pointerInside = inside;
          if (!inside) setActiveInternal(null, true);
        }
      },
      setActive(id: string | null) {
        setActiveInternal(id, false);
        if (!running || reducedMotion) renderOnce();
      },
      playEntrance() {
        if (disposed || entranceArmed || mode !== "hero") return;
        entranceArmed = true;
        if (!running || reducedMotion) renderOnce();
      },
      resize,
      start() {
        if (disposed || running) return;
        running = true;
        lastTime = 0;
        if (reducedMotion) {
          running = false;
          renderOnce();
          return;
        }
        frameId = requestAnimationFrame(loop);
      },
      stop() {
        running = false;
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        running = false;
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
        for (const item of disposables) item.dispose();
        disposables.length = 0;
        // One release per acquisition. The other canvas may still be holding
        // the same brushed field, and it is the last one out that frees it.
        for (const cacheKey of held) releaseTexture(cacheKey);
        held.length = 0;
        geometryCache.clear();
        edgeCache.clear();
        units.length = 0;
        meshes.length = 0;
        hits.length = 0;
        scene.environment = null;
        scene.fog = null;
        scene.clear();
        renderer.dispose();
        // The page mounts two of these. A browser keeps only so many live
        // WebGL contexts, and a disposed renderer holds on to its one until
        // the GPU process gets round to it, so this one is handed back by
        // hand rather than waiting for the collector.
        renderer.forceContextLoss();
      },
    };
  } catch (error) {
    for (const item of disposables) item.dispose();
    for (const cacheKey of held) releaseTexture(cacheKey);
    held.length = 0;
    renderer.dispose();
    throw error instanceof Error ? error : new Error("Ingot scene failed");
  }
}
