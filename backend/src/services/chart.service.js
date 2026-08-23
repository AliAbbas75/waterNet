const zlib = require("zlib");

/**
 * Minimal line-chart rasteriser.
 *
 * Charts are drawn to an RGBA buffer and encoded as PNG with nothing but
 * node's zlib. Both the PDF and the DOCX embed the very same image, so the two
 * documents cannot drift apart, and the backend stays free of native canvas
 * bindings or a headless browser.
 */

// 5x7 glyphs, enough to label numeric axes.
const GLYPHS = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
};

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

// Charts are fully opaque, so they are encoded as RGB rather than RGBA. An
// alpha channel would make pdfkit emit a separate soft-mask object per chart,
// doubling the image count in the PDF for no visible difference.
const CHANNELS = 3;

function createCanvas(width, height, background = [255, 255, 255]) {
  const data = Buffer.alloc(width * height * CHANNELS);
  for (let i = 0; i < width * height; i++) {
    data[i * CHANNELS] = background[0];
    data[i * CHANNELS + 1] = background[1];
    data[i * CHANNELS + 2] = background[2];
  }
  return { width, height, data };
}

function encodePng(canvas) {
  const { width, height, data } = canvas;
  const stride = width * CHANNELS;
  // Every scanline carries a leading filter byte; 0 means "no filtering".
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function blend(canvas, x, y, [r, g, b], alpha = 1) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * CHANNELS;
  const d = canvas.data;
  d[i] = Math.round(d[i] * (1 - alpha) + r * alpha);
  d[i + 1] = Math.round(d[i + 1] * (1 - alpha) + g * alpha);
  d[i + 2] = Math.round(d[i + 2] * (1 - alpha) + b * alpha);
}

function fillRect(canvas, x, y, w, h, color, alpha = 1) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) blend(canvas, x + dx, y + dy, color, alpha);
  }
}

// Bresenham, widened by stamping a square nib at each step.
function drawLine(canvas, x0, y0, x1, y1, color, thickness = 1, alpha = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const half = Math.floor(thickness / 2);

  for (;;) {
    fillRect(canvas, x0 - half, y0 - half, thickness, thickness, color, alpha);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function drawText(canvas, text, x, y, color, scale = 2) {
  let cursor = x;
  for (const ch of String(text)) {
    const glyph = GLYPHS[ch] || GLYPHS[" "];
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] === "1") {
          fillRect(canvas, cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cursor += (5 + 1) * scale;
  }
}

function textWidth(text, scale = 2) {
  return String(text).length * 6 * scale;
}

function formatTick(value) {
  const abs = Math.abs(value);
  if (abs >= 100) return String(Math.round(value));
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

const INK = [15, 23, 42];
const GRID = [226, 232, 240];
const AXIS = [148, 163, 184];
const SAFE_BAND = [16, 185, 129];

const SERIES_COLORS = [
  [37, 99, 235],
  [217, 70, 239],
  [234, 88, 12],
  [13, 148, 136],
  [220, 38, 38],
  [124, 58, 237],
  [101, 163, 13],
  [8, 145, 178]
];

function seriesColor(index) {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/**
 * @param series Array<{ points: Array<{ ts, value }> }> — one entry per plant.
 * @param threshold Optional { safeMin, safeMax }, shaded behind the lines.
 * Returns a PNG buffer, or null when there is nothing plottable.
 */
function renderMetricChart({ series = [], threshold = null, width = 1000, height = 320 } = {}) {
  const plots = series
    .map((s, i) => ({
      color: s.color || seriesColor(i),
      points: (s.points || []).filter((p) => typeof p.value === "number" && Number.isFinite(p.value))
    }))
    .filter((s) => s.points.length > 0);

  if (!plots.length) return null;

  const canvas = createCanvas(width, height);
  const left = 72;
  const right = width - 24;
  const top = 16;
  const bottom = height - 34;
  const plotW = right - left;
  const plotH = bottom - top;

  let lo = Infinity;
  let hi = -Infinity;
  for (const plot of plots) {
    for (const p of plot.points) {
      if (p.value < lo) lo = p.value;
      if (p.value > hi) hi = p.value;
    }
  }
  // Keep the safe band on screen so a flat in-spec line still reads as in-spec.
  if (threshold && Number.isFinite(threshold.safeMin)) lo = Math.min(lo, threshold.safeMin);
  if (threshold && Number.isFinite(threshold.safeMax)) hi = Math.max(hi, threshold.safeMax);

  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const span = hi - lo;
  lo -= span * 0.08;
  hi += span * 0.08;

  const yFor = (value) => bottom - ((value - lo) / (hi - lo)) * plotH;

  let tsLo = Infinity;
  let tsHi = -Infinity;
  for (const plot of plots) {
    for (const p of plot.points) {
      const t = new Date(p.ts).getTime();
      if (t < tsLo) tsLo = t;
      if (t > tsHi) tsHi = t;
    }
  }
  const tsSpan = tsHi - tsLo || 1;
  const xFor = (ts) => left + ((new Date(ts).getTime() - tsLo) / tsSpan) * plotW;

  if (threshold && Number.isFinite(threshold.safeMin) && Number.isFinite(threshold.safeMax)) {
    const bandTop = Math.max(top, yFor(threshold.safeMax));
    const bandBottom = Math.min(bottom, yFor(threshold.safeMin));
    if (bandBottom > bandTop) {
      fillRect(canvas, left, bandTop, plotW, bandBottom - bandTop, SAFE_BAND, 0.12);
    }
  }

  for (let i = 0; i <= 4; i++) {
    const value = lo + ((hi - lo) * i) / 4;
    const y = yFor(value);
    drawLine(canvas, left, y, right, y, GRID, 1);
    const label = formatTick(value);
    drawText(canvas, label, left - 10 - textWidth(label), y - 7, AXIS);
  }

  drawLine(canvas, left, top, left, bottom, AXIS, 1);
  drawLine(canvas, left, bottom, right, bottom, AXIS, 1);

  for (const plot of plots) {
    const sorted = plot.points
      .slice()
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    if (sorted.length === 1) {
      const x = xFor(sorted[0].ts);
      fillRect(canvas, x - 3, yFor(sorted[0].value) - 3, 6, 6, plot.color);
      continue;
    }
    for (let i = 1; i < sorted.length; i++) {
      drawLine(
        canvas,
        xFor(sorted[i - 1].ts),
        yFor(sorted[i - 1].value),
        xFor(sorted[i].ts),
        yFor(sorted[i].value),
        plot.color,
        3
      );
    }
  }

  return encodePng(canvas);
}

module.exports = { renderMetricChart, seriesColor, encodePng, createCanvas };
