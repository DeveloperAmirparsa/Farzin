(function (root) {
  'use strict';
  const PRIMARY = '#c5a875';
  const SECONDARY = '#9f9082';
  const MOCHA = '#6e503e';
  const CHAMPAGNE = '#e8d8be';
  const IVORY = '#f8f2e7';
  const CHOCOLATE = '#1b120e';
  const meshCache = new Map();
  const svgCache = new Map();
  const svgSide3DCache = new Map();
  const sideSpriteCache = new Map();
  const MAX_SIDE_SPRITES = 48;

  function safeSvgId(prefix, className) {
    return `${prefix}_${String(className || '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'}`;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    if (full.length !== 6) return [197, 168, 117];
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return [Number.isFinite(r) ? r : 197, Number.isFinite(g) ? g : 168, Number.isFinite(b) ? b : 117];
  }

  function mixColor(hexA, hexB, t) {
    const [r1, g1, b1] = hexToRgb(hexA);
    const [r2, g2, b2] = hexToRgb(hexB);
    const k = clamp(t, 0, 1);
    return `rgb(${Math.round(r1 + (r2 - r1) * k)},${Math.round(g1 + (g2 - g1) * k)},${Math.round(b1 + (b2 - b1) * k)})`;
  }

  function safeRadial(ctx, x0, y0, r0, x1, y1, r1, stops, fallback) {
    if (typeof ctx.createRadialGradient === 'function') {
      const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
      if (g && typeof g.addColorStop === 'function') {
        for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
        return g;
      }
    }
    return fallback;
  }

  function safeLinear(ctx, x0, y0, x1, y1, stops, fallback) {
    if (typeof ctx.createLinearGradient === 'function') {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      if (g && typeof g.addColorStop === 'function') {
        for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
        return g;
      }
    }
    return fallback;
  }

  function safeEllipse(c, cx, cy, rx, ry, rot = 0, sAng = 0, eAng = Math.PI * 2, ccw = false) {
    if (typeof c.ellipse === 'function') c.ellipse(cx, cy, rx, ry, rot, sAng, eAng, ccw);
    else c.arc(cx, cy, Math.max(1, (rx + ry) * 0.5), sAng, eAng, ccw);
  }

  // --- Lightweight 3D Vector & Projection Engine ---
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  function norm(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function rotatePoint(p, yaw, pitch, roll = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = p[0] * cy + p[2] * sy;
    const y1 = p[1];
    const z1 = -p[0] * sy + p[2] * cy;

    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x2 = x1;
    const y2 = y1 * cp - z1 * sp;
    const z2 = y1 * sp + z1 * cp;

    if (!roll) return [x2, y2, z2];
    const cr = Math.cos(roll), sr = Math.sin(roll);
    return [x2 * cr - y2 * sr, x2 * sr + y2 * cr, z2];
  }

  function projectPoint(p, camDist, scale, cx, cy) {
    const denom = Math.max(1.2, camDist - p[2]);
    const f = camDist / denom;
    return {
      x: cx + p[0] * scale * f,
      y: cy - p[1] * scale * f,
      z: p[2],
      f
    };
  }

  const KEY_LIGHT = norm([-0.48, 0.74, 0.56]);
  const RIM_LIGHT = norm([0.65, -0.32, 0.35]);

  function shadeColor(normal, palette, tag = '') {
    const d1 = clamp(dot(normal, KEY_LIGHT), 0, 1);
    const d2 = clamp(dot(normal, RIM_LIGHT), 0, 1);
    let tone = clamp(0.18 + d1 * 0.72 + d2 * 0.16, 0, 1);
    if (tag === 'groove-dark') tone *= 0.42;
    else if (tag === 'groove-light') tone = clamp(tone * 1.18 + 0.12, 0, 1);
    else if (tag === 'top') tone = clamp(tone + 0.14, 0, 1);
    if (tone < 0.45) return mixColor(palette.shadow, palette.mid, tone / 0.45);
    if (tone < 0.82) return mixColor(palette.mid, palette.bright, (tone - 0.45) / 0.37);
    return mixColor(palette.bright, palette.specular, (tone - 0.82) / 0.18);
  }

  // Ensures every face normal strictly points outward from its convex part's center
  function makeFace(pts, partCenter, palette, options = {}) {
    const nRaw = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    const center = pts.reduce((acc, p) => [acc[0] + p[0] / pts.length, acc[1] + p[1] / pts.length, acc[2] + p[2] / pts.length], [0, 0, 0]);
    const ordered = dot(nRaw, sub(center, partCenter)) < 0 ? pts.slice().reverse() : pts.slice();
    return {
      pts: ordered,
      palette,
      tag: options.tag || '',
      stroke: options.stroke !== undefined ? options.stroke : palette.edge,
      strokeWidth: options.strokeWidth || 0.9,
      onDraw2D: options.onDraw2D || null
    };
  }

  function renderFaces3D(faces, { yaw, pitch, roll = 0, camDist = 6.2, scale, cx, cy, maxW, maxH }) {
    const visible = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const face of faces) {
      const rPts = face.pts.map(p => rotatePoint(p, yaw, pitch, roll));
      const p0 = rPts[0], p1 = rPts[1], p2 = rPts[2];
      const n = norm(cross(sub(p1, p0), sub(p2, p0)));
      const centroid = rPts.reduce((a, b) => [a[0] + b[0] / rPts.length, a[1] + b[1] / rPts.length, a[2] + b[2] / rPts.length], [0, 0, 0]);
      const toCam = norm([-centroid[0], -centroid[1], camDist - centroid[2]]);
      if (dot(n, toCam) <= 0.002) continue;
      const uPts = rPts.map(p => projectPoint(p, camDist, 1, 0, 0));
      for (const p of uPts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const avgZ = rPts.reduce((s, p) => s + p[2], 0) / rPts.length;
      const minZ = Math.min(...rPts.map(p => p[2]));
      const fill = shadeColor(n, face.palette, face.tag);
      visible.push({
        uPts,
        avgZ,
        minZ,
        fill,
        stroke: face.stroke,
        strokeWidth: face.strokeWidth,
        overlay: face.onDraw2D
          ? face.onDraw2D(p => projectPoint(rotatePoint(p, yaw, pitch, roll), camDist, 1, 0, 0))
          : null
      });
    }
    if (!visible.length) return [];

    const spanX = Math.max(0.15, maxX - minX);
    const spanY = Math.max(0.15, maxY - minY);
    let effScale = scale;
    if (maxW && maxH) {
      effScale = Math.min(scale, maxW / spanX, maxH / spanY);
    }
    const midX = (minX + maxX) * 0.5;
    const midY = (minY + maxY) * 0.5;
    const offX = cx - midX * effScale;
    const offY = cy - midY * effScale;

    for (const f of visible) {
      f.sPts = f.uPts.map(p => ({ x: offX + p.x * effScale, y: offY + p.y * effScale }));
      if (f.overlay && f.overlay.matrix) {
        const [a, b, c, d, e, fy] = f.overlay.matrix;
        f.overlay.matrix = [
          a * effScale,
          b * effScale,
          c * effScale,
          d * effScale,
          offX + e * effScale,
          offY + fy * effScale
        ];
      }
    }
    visible.sort((a, b) => (a.avgZ - b.avgZ) || (a.minZ - b.minZ));
    return visible;
  }

  function computePlaneMatrix(projectFn, origin, axisU, axisV) {
    const o = projectFn(origin);
    const u = projectFn(add(origin, axisU));
    const v = projectFn(add(origin, axisV));
    return [u.x - o.x, u.y - o.y, v.x - o.x, v.y - o.y, o.x, o.y];
  }

  // --- Palettes ---
  const PAL = {
    gold: { shadow: '#543510', mid: '#c69338', bright: '#f4d98c', specular: '#fff9e6', edge: 'rgba(255,249,226,0.58)' },
    goldMatte: { shadow: '#472c0c', mid: '#ae7c2a', bright: '#e0bc68', specular: '#fff5d6', edge: 'rgba(255,245,214,0.42)' },
    silver: { shadow: '#484d57', mid: '#a7aeb9', bright: '#e6e9ef', specular: '#ffffff', edge: 'rgba(255,255,255,0.68)' },
    metal: { shadow: '#3a2f27', mid: '#87786a', bright: '#d4c8bc', specular: '#f8f2e7', edge: 'rgba(248,242,231,0.5)' },
    paper: { shadow: '#5d4736', mid: '#bfa88a', bright: '#efe2cb', specular: '#fffbf2', edge: 'rgba(248,242,231,0.55)' },
    darkCore: { shadow: '#120b08', mid: '#2b1d16', bright: '#4f3728', specular: '#8a664f', edge: 'rgba(232,216,190,0.38)' },
    crimson: { shadow: '#4d111a', mid: '#9b2b39', bright: '#d45b6a', specular: '#fbd5da', edge: 'rgba(251,213,218,0.5)' }
  };

  // --- Shared Convex Solid Builders ---
  function addFrustumFaces(faces, center, botPts, topPts, palette, options = {}) {
    const c = center;
    faces.push(makeFace(botPts.slice().reverse(), c, palette, options.botOpts));
    faces.push(makeFace(topPts, c, palette, { tag: 'top', ...(options.topOpts || {}) }));
    const n = botPts.length;
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const tag = typeof options.sideTag === 'function' ? options.sideTag(i) : (options.sideTag || '');
      faces.push(makeFace([botPts[i], botPts[next], topPts[next], topPts[i]], c, palette, { tag, ...(options.sideOpts || {}) }));
    }
  }

  function addBoxFaces(faces, cx, cy, cz, hw, hh, hd, palette, options = {}) {
    const bot = [
      [cx - hw, cy - hh, cz - hd],
      [cx + hw, cy - hh, cz - hd],
      [cx + hw, cy - hh, cz + hd],
      [cx - hw, cy - hh, cz + hd]
    ];
    const top = [
      [cx - hw, cy + hh, cz - hd],
      [cx + hw, cy + hh, cz - hd],
      [cx + hw, cy + hh, cz + hd],
      [cx - hw, cy + hh, cz + hd]
    ];
    addFrustumFaces(faces, [cx, cy, cz], bot, top, palette, options);
  }

  // 1. Gold / Silver Bullion Bar (3D tapered trapezoid bullion bar with stamped assay face)
  function buildBullionBarMesh(palette, stampText = '999.9', withGlobe = false) {
    const faces = [];
    const bw = 0.72, bl = 1.18, tw = 0.50, tl = 0.94, hy = 0.30;
    const bot = [[-bl, -hy, -bw], [bl, -hy, -bw], [bl, -hy, bw], [-bl, -hy, bw]];
    const top = [[-tl, hy, -tw], [tl, hy, -tw], [tl, hy, tw], [-tl, hy, tw]];
    addFrustumFaces(faces, [0, 0, 0], bot, top, palette, {
      topOpts: {
        onDraw2D: proj => {
          const m = computePlaneMatrix(proj, [0, hy + 0.005, 0], [0.6, 0, 0], [0, 0, 0.4]);
          return { kind: 'bullion-stamp', matrix: m, text: stampText, color: palette === PAL.silver ? '#363b44' : '#5e3c10' };
        }
      }
    });
    if (withGlobe) {
      // Non-intersecting tilted base disc / plinth underneath the bar
      const segs = 20, ringBot = [], ringTop = [];
      for (let i = 0; i < segs; i++) {
        const a = (i * Math.PI * 2) / segs;
        ringBot.push([Math.cos(a) * 1.15, -0.44, Math.sin(a) * 1.15]);
        ringTop.push([Math.cos(a) * 1.12, -0.32, Math.sin(a) * 1.12]);
      }
      addFrustumFaces(faces, [0, -0.38, 0], ringBot, ringTop, PAL.goldMatte, {
        topOpts: {
          onDraw2D: proj => ({
            kind: 'globe-lines',
            matrix: computePlaneMatrix(proj, [0, -0.315, 0], [0.95, 0, 0], [0, 0, 0.95])
          })
        }
      });
    }
    return faces;
  }

  // 2. Extruded Beveled Cylinder Coin / Token (Watertight 3D coin with reeded rim & single-poly caps)
  function buildCoinMesh(segments, radius, halfDepth, bevel, palette, facePalette, glyphSpec, milled = true) {
    const faces = [];
    const meshCenter = [0, 0, 0];
    const rOuter = radius;
    const rInner = radius - bevel;

    const ringBack = [], ringMidBack = [], ringMidFront = [], ringFront = [];
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments;
      const ca = Math.cos(a), sa = Math.sin(a);
      ringBack.push([ca * rInner, sa * rInner, -halfDepth]);
      ringMidBack.push([ca * rOuter, sa * rOuter, -halfDepth + bevel * 0.75]);
      ringMidFront.push([ca * rOuter, sa * rOuter, halfDepth - bevel * 0.75]);
      ringFront.push([ca * rInner, sa * rInner, halfDepth]);
    }

    faces.push(makeFace(ringBack.slice().reverse(), meshCenter, palette, { strokeWidth: 0.5 }));
    faces.push(makeFace(ringFront, meshCenter, facePalette || palette, {
      tag: 'top',
      strokeWidth: 0.7,
      onDraw2D: glyphSpec ? (proj => ({
        kind: glyphSpec.kind || 'coin-crest',
        matrix: computePlaneMatrix(proj, [0, 0, halfDepth + 0.008], [radius * 0.72, 0, 0], [0, -radius * 0.72, 0]),
        glyph: glyphSpec.glyph || '',
        color: glyphSpec.color || IVORY,
        ringColor: glyphSpec.ringColor || 'rgba(86,57,22,0.55)'
      })) : null
    }));

    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      faces.push(makeFace([ringBack[i], ringBack[next], ringMidBack[next], ringMidBack[i]], meshCenter, palette, { strokeWidth: 0.5 }));
      faces.push(makeFace([ringMidFront[i], ringMidFront[next], ringFront[next], ringFront[i]], meshCenter, palette, { tag: 'top', strokeWidth: 0.6 }));
      const tag = milled ? (i % 2 === 0 ? 'groove-light' : 'groove-dark') : '';
      faces.push(makeFace([ringMidBack[i], ringMidBack[next], ringMidFront[next], ringMidFront[i]], meshCenter, palette, { tag, strokeWidth: 0.5 }));
    }
    return faces;
  }

  // 3. Curved 3D Banknote Stack (Segmented S-wave bundle with layered paper edges)
  function buildBanknoteStackMesh(glyph) {
    const faces = [];
    const strips = 8;
    const width = 2.04, height = 1.24, depth = 0.28;
    const waveY = t => Math.sin(t * Math.PI * 1.15) * 0.14;
    const pts = [];
    for (let i = 0; i <= strips; i++) {
      const u = i / strips;
      const x = -width * 0.5 + u * width;
      const zCurve = waveY(u * 2 - 1);
      pts.push({ x, zFront: zCurve + depth * 0.5, zBack: zCurve - depth * 0.5 });
    }
    const hh = height * 0.5;
    for (let i = 0; i < strips; i++) {
      const a = pts[i], b = pts[i + 1];
      const cx = (a.x + b.x) * 0.5;
      const cz = (a.zFront + b.zFront + a.zBack + b.zBack) * 0.25;
      const c = [cx, 0, cz];
      // Front banknote face (faces +z)
      faces.push(makeFace([[a.x, -hh, a.zFront], [b.x, -hh, b.zFront], [b.x, hh, b.zFront], [a.x, hh, a.zFront]], c, PAL.paper, {
        tag: 'top',
        stroke: i === 0 || i === strips - 1 ? PAL.paper.edge : 'none',
        onDraw2D: i === Math.floor(strips / 2) ? (proj => ({
          kind: 'banknote-emblem',
          matrix: computePlaneMatrix(proj, [0, 0, waveY(0) + depth * 0.5 + 0.015], [0.68, 0, 0], [0, -0.68, 0]),
          glyph: glyph || '$'
        })) : null
      }));
      // Back face
      faces.push(makeFace([[b.x, -hh, b.zBack], [a.x, -hh, a.zBack], [a.x, hh, a.zBack], [b.x, hh, b.zBack]], c, PAL.paper, { stroke: 'none' }));
      // Top & bottom stacked paper edges
      faces.push(makeFace([[a.x, hh, a.zFront], [b.x, hh, b.zFront], [b.x, hh, b.zBack], [a.x, hh, b.zBack]], c, PAL.goldMatte, { tag: 'groove-light', strokeWidth: 0.6 }));
      faces.push(makeFace([[a.x, -hh, a.zBack], [b.x, -hh, b.zBack], [b.x, -hh, a.zFront], [a.x, -hh, a.zFront]], c, PAL.goldMatte, { tag: 'groove-dark', strokeWidth: 0.6 }));
      if (i === 0) {
        faces.push(makeFace([[a.x, -hh, a.zBack], [a.x, -hh, a.zFront], [a.x, hh, a.zFront], [a.x, hh, a.zBack]], c, PAL.goldMatte, { tag: 'groove-dark', strokeWidth: 0.8 }));
      }
      if (i === strips - 1) {
        faces.push(makeFace([[b.x, -hh, a.zFront], [b.x, -hh, b.zBack], [b.x, hh, b.zBack], [b.x, hh, b.zFront]], c, PAL.goldMatte, { tag: 'groove-light', strokeWidth: 0.8 }));
      }
    }
    return faces;
  }

  // 4. Ethereum 3D Double Pyramid Crystal
  function buildEthereumMesh() {
    const faces = [];
    const eq = [[0.78, 0, 0], [0, 0, 0.78], [-0.78, 0, 0], [0, 0, -0.78]];
    const topBase = eq.map(p => [p[0], 0.08, p[2]]);
    const topApex = [0, 1.14, 0];
    const topCenter = [0, 0.38, 0];
    faces.push(makeFace(topBase.slice().reverse(), topCenter, PAL.goldMatte));
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      faces.push(makeFace([topBase[i], topBase[next], topApex], topCenter, PAL.gold, { tag: 'top' }));
    }
    const botBase = eq.map(p => [p[0], -0.08, p[2]]);
    const botApex = [0, -1.14, 0];
    const botCenter = [0, -0.38, 0];
    faces.push(makeFace(botBase, botCenter, PAL.gold, { tag: 'top' }));
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      faces.push(makeFace([botBase[next], botBase[i], botApex], botCenter, PAL.goldMatte));
    }
    return faces;
  }

  // 5. Solana 3D Separated Slanted Bars
  function buildSolanaMesh() {
    const faces = [];
    const bar = (yc, skew, pal) => {
      const hh = 0.14, hd = 0.20;
      const bot = [
        [-0.86 - skew, yc - hh, -hd], [0.68 - skew, yc - hh, -hd],
        [0.68 - skew, yc - hh, hd], [-0.86 - skew, yc - hh, hd]
      ];
      const top = [
        [-0.68 + skew, yc + hh, -hd], [0.86 + skew, yc + hh, -hd],
        [0.86 + skew, yc + hh, hd], [-0.68 + skew, yc + hh, hd]
      ];
      addFrustumFaces(faces, [0, yc, 0], bot, top, pal);
    };
    bar(0.56, 0.14, PAL.gold);
    bar(0.0, -0.14, PAL.paper);
    bar(-0.56, 0.14, PAL.gold);
    return faces;
  }

  // 6. Stock 3D Ascending Bars + Base Plinth
  function buildStockMesh() {
    const faces = [];
    // Plinth base cleanly centered vertically
    addBoxFaces(faces, 0, -0.70, 0, 1.02, 0.09, 0.34, PAL.metal);
    // 3 strictly separated ascending 3D bars sitting on top of plinth
    addBoxFaces(faces, -0.62, -0.27, 0, 0.19, 0.32, 0.22, PAL.metal);
    addBoxFaces(faces, 0.0, -0.06, 0, 0.19, 0.53, 0.22, PAL.goldMatte);
    addBoxFaces(faces, 0.62, 0.17, 0, 0.19, 0.76, 0.22, PAL.gold, { tag: 'top' });
    return faces;
  }

  // 7. Fund 3D Extruded Pie Chart with Elevated Golden Slice (single-poly caps, zero radial seams)
  function buildFundMesh() {
    const faces = [];
    const buildSector = (startAng, endAng, radius, depth, offset, pal) => {
      const steps = Math.max(4, Math.round((endAng - startAng) / (Math.PI / 8)));
      const [ox, oy, oz] = offset;
      const c = [ox + Math.cos((startAng + endAng) * 0.5) * radius * 0.4, oy + Math.sin((startAng + endAng) * 0.5) * radius * 0.4, oz];
      const botArc = [], topArc = [];
      for (let i = 0; i <= steps; i++) {
        const a = startAng + (i / steps) * (endAng - startAng);
        botArc.push([ox + Math.cos(a) * radius, oy + Math.sin(a) * radius, oz - depth * 0.5]);
        topArc.push([ox + Math.cos(a) * radius, oy + Math.sin(a) * radius, oz + depth * 0.5]);
      }
      const centerBot = [ox, oy, oz - depth * 0.5];
      const centerTop = [ox, oy, oz + depth * 0.5];
      faces.push(makeFace([centerBot, ...botArc.slice().reverse()], c, pal, { strokeWidth: 0.6 }));
      faces.push(makeFace([centerTop, ...topArc], c, pal, { tag: 'top', strokeWidth: 0.6 }));
      for (let i = 0; i < steps; i++) {
        faces.push(makeFace([botArc[i], botArc[i + 1], topArc[i + 1], topArc[i]], c, pal, { strokeWidth: 0.5 }));
      }
      faces.push(makeFace([centerBot, botArc[0], topArc[0], centerTop], c, pal, { strokeWidth: 0.8 }));
      faces.push(makeFace([centerBot, centerTop, topArc[steps], botArc[steps]], c, pal, { strokeWidth: 0.8 }));
    };
    buildSector(Math.PI * 0.55, Math.PI * 1.92, 0.94, 0.34, [0, 0, 0], PAL.metal);
    buildSector(Math.PI * 2.02, Math.PI * 2.46, 0.96, 0.40, [0.16, 0.14, 0.10], PAL.gold);
    return faces;
  }

  // 8. Bond 3D Certificate Tablet + Wax Seal
  function buildBondMesh() {
    const faces = [];
    addBoxFaces(faces, 0, 0, 0, 0.72, 0.92, 0.14, PAL.paper, {
      sideOpts: {
        onDraw2D: null
      }
    });
    // Protruding 3D wax seal disc cleanly in front of parchment face
    const segs = 14, r = 0.25, cx = 0.32, cy = -0.44, z0 = 0.14, z1 = 0.25;
    const c = [cx, cy, (z0 + z1) * 0.5];
    const bot = [], top = [];
    for (let i = 0; i < segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      bot.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0]);
      top.push([cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, z1]);
    }
    addFrustumFaces(faces, c, bot, top, PAL.crimson);
    // Add crisp lines onto front face of tablet
    addBoxFaces(faces, 0, 0.42, 0.155, 0.42, 0.045, 0.02, PAL.darkCore);
    addBoxFaces(faces, 0, 0.16, 0.155, 0.42, 0.045, 0.02, PAL.darkCore);
    addBoxFaces(faces, -0.1, -0.10, 0.155, 0.32, 0.045, 0.02, PAL.darkCore);
    return faces;
  }

  // 9. Commodity 3D Faceted Wheat Sheaf (Non-overlapping 3D kernels around central stem)
  function buildCommodityMesh() {
    const faces = [];
    addBoxFaces(faces, 0, -0.05, 0, 0.055, 0.95, 0.055, PAL.goldMatte);
    const kernel = (kx, ky, kz, tilt) => {
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const rotK = p => [kx + p[0] * ct - p[1] * st, ky + p[0] * st + p[1] * ct, kz + p[2]];
      const c = [kx, ky, kz];
      const mid = [[0.20, 0, 0], [0, 0, 0.16], [-0.20, 0, 0], [0, 0, -0.16]].map(rotK);
      const topA = rotK([0, 0.28, 0]);
      const botA = rotK([0, -0.24, 0]);
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        faces.push(makeFace([mid[i], mid[next], topA], c, PAL.gold, { tag: 'top' }));
        faces.push(makeFace([mid[next], mid[i], botA], c, PAL.goldMatte));
      }
    };
    [-0.42, 0.0, 0.42].forEach(yy => {
      kernel(-0.34, yy, 0, 0.55);
      kernel(0.34, yy, 0, -0.55);
    });
    kernel(0, 0.86, 0, 0);
    return faces;
  }

  // 10. Generic / Gem 3D Emerald-Cut Faceted Diamond
  function buildDiamondMesh() {
    const faces = [];
    const segs = 8;
    const table = [], girdle = [];
    for (let i = 0; i < segs; i++) {
      const a = (i * Math.PI * 2) / segs + Math.PI / 8;
      table.push([Math.cos(a) * 0.56, 0.42, Math.sin(a) * 0.56]);
      girdle.push([Math.cos(a) * 0.95, 0.08, Math.sin(a) * 0.95]);
    }
    const culet = [0, -0.92, 0];
    const center = [0, 0, 0];
    faces.push(makeFace(table, center, PAL.gold, { tag: 'top' }));
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      faces.push(makeFace([girdle[i], girdle[next], table[next], table[i]], center, PAL.gold, { tag: 'top' }));
      faces.push(makeFace([girdle[next], girdle[i], culet], center, PAL.goldMatte));
    }
    return faces;
  }

  const CURRENCY_GLYPHS = {
    forex: 'FX', usd: '$', eur: '€', gbp: '£', aed: 'د.إ', omr: 'ر.ع',
    sar: 'ر.س', kwd: 'د.ک', iqd: 'د.ع', try: '₺', cad: 'C$', aud: 'A$',
    chf: '₣', cny: '¥', jpy: '¥', rub: '₽', currency: '$'
  };
  const CRYPTO_TYPES = ['crypto', 'bitcoin', 'ethereum', 'tether', 'ripple', 'solana', 'bnb', 'cardano', 'dogecoin', 'tron'];

  function buildMeshForType(t) {
    if (meshCache.has(t)) return meshCache.get(t);
    let faces;
    if (t === 'gold') faces = buildBullionBarMesh(PAL.gold, '999.9', false);
    else if (t === 'ounce') faces = buildBullionBarMesh(PAL.gold, '1 OZ', true);
    else if (t === 'silver') faces = buildBullionBarMesh(PAL.silver, 'Ag 999', false);
    else if (t === 'coin') faces = buildCoinMesh(28, 0.94, 0.19, 0.06, PAL.gold, PAL.gold, { kind: 'coin-crest', color: '#FFF9E6' }, true);
    else if (t === 'metal') {
      faces = [];
      const segs = 6, bot = [], top = [];
      for (let i = 0; i < segs; i++) {
        const a = (i * Math.PI * 2) / segs;
        bot.push([Math.cos(a) * 0.72, -0.28, Math.sin(a) * 0.72]);
        top.push([Math.cos(a) * 0.66, 0.30, Math.sin(a) * 0.66]);
      }
      addFrustumFaces(faces, [0, 0, 0], bot, top, PAL.metal);
    }
    else if (t in CURRENCY_GLYPHS) faces = buildBanknoteStackMesh(CURRENCY_GLYPHS[t]);
    else if (t === 'ethereum') faces = buildEthereumMesh();
    else if (t === 'solana') faces = buildSolanaMesh();
    else if (CRYPTO_TYPES.includes(t)) {
      const glyph = ({ bitcoin: '₿', tether: '₮', ripple: '✕', bnb: '◆', cardano: '₳', dogecoin: 'Ð', tron: 'T', crypto: '₿' })[t] || '₿';
      const segs = t === 'tether' ? 6 : t === 'bnb' ? 4 : 24;
      faces = buildCoinMesh(segs, 0.92, 0.20, 0.06, PAL.gold, PAL.darkCore, { kind: 'text-badge', glyph, color: '#F5DE9E' }, segs >= 16);
    }
    else if (t === 'stock') faces = buildStockMesh();
    else if (t === 'fund') faces = buildFundMesh();
    else if (t === 'bond') faces = buildBondMesh();
    else if (t === 'commodity') faces = buildCommodityMesh();
    else faces = buildDiamondMesh();
    meshCache.set(t, faces);
    return faces;
  }

  // Preserved 3D Oil Droplet ("ولی نفت خوبه نگهش دار")
  function drawOilDroplet(c, r, color, isSideView = false) {
    c.save();
    if (isSideView) {
      c.rotate(-0.18);
      const drop = ox => {
        c.beginPath();
        c.moveTo(ox, -r * 0.92);
        c.bezierCurveTo(ox + r * 0.22, -r * 0.48, ox + r * 0.66, -r * 0.02, ox + r * 0.52, r * 0.48);
        c.bezierCurveTo(ox + r * 0.36, r * 0.94, ox - r * 0.36, r * 0.94, ox - r * 0.52, r * 0.48);
        c.bezierCurveTo(ox - r * 0.66, -r * 0.02, ox - r * 0.22, -r * 0.48, ox, -r * 0.92);
        c.closePath();
      };
      c.fillStyle = '#38261d';
      drop(-r * 0.2);
      c.fill();
      c.fillStyle = safeRadial(c, r * 0.12, r * 0.16, r * 0.08, 0, r * 0.22, r * 0.85, [
        [0, CHAMPAGNE], [0.32, color || PRIMARY], [0.72, MOCHA], [1, CHOCOLATE]
      ], MOCHA);
      drop(0);
      c.fill();
      c.strokeStyle = 'rgba(248, 242, 231, 0.66)';
      c.lineWidth = Math.max(1, r * 0.055);
      drop(0);
      c.stroke();
      c.fillStyle = 'rgba(248, 242, 231, 0.72)';
      c.beginPath();
      safeEllipse(c, r * 0.16, r * 0.24, r * 0.09, r * 0.26, 0.22);
      c.fill();
    } else {
      c.fillStyle = 'rgba(14,9,6,0.54)';
      c.beginPath();
      safeEllipse(c, 0, r * 0.65, r * 0.6, r * 0.22, 0);
      c.fill();
      const dropPath = () => {
        c.beginPath();
        c.moveTo(0, -r * 0.92);
        c.bezierCurveTo(r * 0.2, -r * 0.5, r * 0.76, -r * 0.02, r * 0.6, r * 0.48);
        c.bezierCurveTo(r * 0.44, r * 0.95, -r * 0.44, r * 0.95, -r * 0.6, r * 0.48);
        c.bezierCurveTo(-r * 0.76, -r * 0.02, -r * 0.2, -r * 0.5, 0, -r * 0.92);
        c.closePath();
      };
      c.fillStyle = safeRadial(c, -r * 0.24, r * 0.15, r * 0.06, 0, r * 0.22, r * 0.85, [
        [0, CHAMPAGNE], [0.28, MOCHA], [0.7, '#38261d'], [1, CHOCOLATE]
      ], MOCHA);
      dropPath();
      c.fill();
      c.strokeStyle = 'rgba(232, 216, 190, 0.62)';
      c.lineWidth = Math.max(0.9, r * 0.06);
      dropPath();
      c.stroke();
      c.fillStyle = 'rgba(248, 242, 231, 0.75)';
      c.beginPath();
      safeEllipse(c, -r * 0.22, r * 0.22, r * 0.12, r * 0.28, -0.35);
      c.fill();
    }
    c.restore();
  }

  function cameraForType(t, isSideView) {
    if (isSideView) {
      if (t === 'coin' || CRYPTO_TYPES.includes(t) || t === 'fund' || t === 'bond') {
        return { yaw: -0.78, pitch: 0.20, roll: -0.08, camDist: 5.8 };
      }
      if (t in CURRENCY_GLYPHS) {
        return { yaw: -0.62, pitch: 0.28, roll: -0.09, camDist: 5.8 };
      }
      return { yaw: -0.72, pitch: 0.42, roll: -0.06, camDist: 5.8 };
    }
    if (t === 'coin' || CRYPTO_TYPES.includes(t) || t === 'fund' || t === 'bond') {
      return { yaw: -0.44, pitch: 0.18, roll: -0.05, camDist: 5.8 };
    }
    if (t in CURRENCY_GLYPHS) {
      return { yaw: -0.38, pitch: 0.24, roll: -0.06, camDist: 5.8 };
    }
    return { yaw: -0.58, pitch: 0.46, roll: -0.04, camDist: 5.8 };
  }

  // --- Canvas Renderer ---
  function drawOverlayCanvas(c, overlay) {
    if (!overlay) return;
    c.save();
    const [a, b, cc, d, e, f] = overlay.matrix;
    if (typeof c.transform === 'function') c.transform(a, b, cc, d, e, f);
    if (overlay.kind === 'bullion-stamp') {
      c.strokeStyle = 'rgba(62, 38, 12, 0.48)';
      c.lineWidth = 0.07;
      c.strokeRect(-0.85, -0.7, 1.7, 1.4);
      c.fillStyle = overlay.color;
      c.font = '800 0.62px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(overlay.text, 0, 0);
    } else if (overlay.kind === 'globe-lines') {
      c.strokeStyle = 'rgba(255, 249, 230, 0.45)';
      c.lineWidth = 0.05;
      c.beginPath(); c.arc(0, 0, 0.92, 0, Math.PI * 2); c.stroke();
      c.beginPath(); safeEllipse(c, 0, 0, 0.44, 0.92, 0); c.stroke();
    } else if (overlay.kind === 'coin-crest') {
      c.strokeStyle = overlay.ringColor;
      c.lineWidth = 0.08;
      c.beginPath(); c.arc(0, 0, 0.84, 0, Math.PI * 2); c.stroke();
      c.fillStyle = overlay.color;
      c.beginPath();
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI) / 6;
        const rad = i % 2 === 0 ? 0.56 : 0.26;
        const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    } else if (overlay.kind === 'banknote-emblem') {
      c.strokeStyle = 'rgba(79, 55, 40, 0.52)';
      c.lineWidth = 0.07;
      c.strokeRect(-1.05, -0.64, 2.1, 1.28);
      c.fillStyle = CHOCOLATE;
      c.beginPath(); c.arc(0, 0, 0.46, 0, Math.PI * 2); c.fill();
      c.strokeStyle = PRIMARY;
      c.lineWidth = 0.055;
      c.stroke();
      const fs = overlay.glyph.length >= 3 ? 0.42 : overlay.glyph.length === 2 ? 0.52 : 0.64;
      c.font = `800 ${fs}px Vazirmatn, Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = IVORY;
      c.fillText(overlay.glyph, 0, 0.02);
    } else if (overlay.kind === 'text-badge') {
      c.strokeStyle = 'rgba(197, 168, 117, 0.65)';
      c.lineWidth = 0.07;
      c.beginPath(); c.arc(0, 0, 0.82, 0, Math.PI * 2); c.stroke();
      c.fillStyle = overlay.color;
      c.font = '800 0.88px Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(overlay.glyph, 0, 0.04);
    }
    c.restore();
  }

  function drawProjectedMeshCanvas(c, type, cx, cy, size, isSideView) {
    const t = String(type || 'generic').toLowerCase();
    const cam = cameraForType(t, isSideView);
    const faces = buildMeshForType(t);
    const scale = Math.max(8, size * (isSideView ? 0.42 : 0.46));
    const maxDim = size * (isSideView ? 1.18 : 0.96);
    const projected = renderFaces3D(faces, { ...cam, scale, cx, cy, maxW: maxDim, maxH: maxDim });

    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const f of projected) {
      c.beginPath();
      f.sPts.forEach((p, idx) => (idx === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
      c.closePath();
      c.fillStyle = f.fill;
      c.fill();
      if (f.stroke && f.stroke !== 'none') {
        c.strokeStyle = f.stroke;
        c.lineWidth = Math.max(0.55, f.strokeWidth * (size / 72));
        c.stroke();
      }
      if (f.overlay) drawOverlayCanvas(c, f.overlay);
    }
    c.restore();
  }

  // --- SVG Renderer ---
  function overlaySvg(overlay) {
    if (!overlay) return '';
    const m = overlay.matrix.map(n => n.toFixed(3)).join(' ');
    if (overlay.kind === 'bullion-stamp') {
      return `<g transform="matrix(${m})">
        <rect x="-0.85" y="-0.7" width="1.7" height="1.4" fill="none" stroke="rgba(62,38,12,0.5)" stroke-width="0.07"/>
        <text x="0" y="0.22" text-anchor="middle" fill="${overlay.color}" font-size="0.62" font-weight="800" font-family="system-ui, sans-serif">${overlay.text}</text>
      </g>`;
    }
    if (overlay.kind === 'globe-lines') {
      return `<g transform="matrix(${m})">
        <circle cx="0" cy="0" r="0.92" fill="none" stroke="rgba(255,249,230,0.48)" stroke-width="0.055"/>
        <ellipse cx="0" cy="0" rx="0.44" ry="0.92" fill="none" stroke="rgba(255,249,230,0.42)" stroke-width="0.05"/>
      </g>`;
    }
    if (overlay.kind === 'coin-crest') {
      let pts = '';
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI) / 6;
        const rad = i % 2 === 0 ? 0.56 : 0.26;
        pts += `${(Math.cos(ang) * rad).toFixed(3)},${(Math.sin(ang) * rad).toFixed(3)} `;
      }
      return `<g transform="matrix(${m})">
        <circle cx="0" cy="0" r="0.84" fill="none" stroke="${overlay.ringColor}" stroke-width="0.08"/>
        <polygon points="${pts.trim()}" fill="${overlay.color}"/>
      </g>`;
    }
    if (overlay.kind === 'banknote-emblem') {
      const fs = overlay.glyph.length >= 3 ? 0.42 : overlay.glyph.length === 2 ? 0.52 : 0.64;
      return `<g transform="matrix(${m})">
        <rect x="-1.05" y="-0.64" width="2.1" height="1.28" fill="none" stroke="rgba(79,55,40,0.55)" stroke-width="0.07"/>
        <circle cx="0" cy="0" r="0.46" fill="#1B120E" stroke="#C5A875" stroke-width="0.055"/>
        <text x="0" y="${(fs * 0.36).toFixed(3)}" text-anchor="middle" fill="#F8F2E7" font-size="${fs}" font-weight="800" font-family="Vazirmatn, system-ui, sans-serif">${overlay.glyph}</text>
      </g>`;
    }
    if (overlay.kind === 'text-badge') {
      return `<g transform="matrix(${m})">
        <circle cx="0" cy="0" r="0.82" fill="none" stroke="rgba(197,168,117,0.7)" stroke-width="0.07"/>
        <text x="0" y="0.32" text-anchor="middle" fill="${overlay.color}" font-size="0.88" font-weight="800" font-family="system-ui, sans-serif">${overlay.glyph}</text>
      </g>`;
    }
    return '';
  }

  function renderProjectedMeshSvg(type, vw, vh, scale, cx, cy, isSideView, className) {
    const t = String(type || 'generic').toLowerCase();
    const cam = cameraForType(t, isSideView);
    const faces = buildMeshForType(t);
    const projected = renderFaces3D(faces, {
      ...cam,
      scale,
      cx,
      cy,
      maxW: vw * 0.86,
      maxH: vh * 0.86
    });
    const shapes = projected.map(f => {
      const ptsAttr = f.sPts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      const strokeAttr = f.stroke && f.stroke !== 'none'
        ? ` stroke="${f.stroke}" stroke-width="${Math.max(0.45, f.strokeWidth * (scale / 38)).toFixed(2)}" stroke-linejoin="round"`
        : '';
      return `<polygon points="${ptsAttr}" fill="${f.fill}"${strokeAttr}/>${overlaySvg(f.overlay)}`;
    }).join('');
    return `<svg class="${className}" viewBox="0 0 ${vw} ${vh}" fill="none" aria-hidden="true">${shapes}</svg>`;
  }

  // --- Public API ---
  function draw(ctx, type, x, y, size, color) {
    const t = String(type || 'generic').toLowerCase();
    const s = Math.max(10, Number(size) || 18);
    if (t === 'oil') {
      ctx.save();
      ctx.translate(x, y);
      drawOilDroplet(ctx, s / 2, color || PRIMARY, false);
      ctx.restore();
      return;
    }
    drawProjectedMeshCanvas(ctx, t, x, y, s, false);
  }

  function drawSide3D(ctx, type, x, y, size, color, options = {}) {
    const t = String(type || 'generic').toLowerCase();
    const s = Math.max(24, Number(size) || 64);
    const opacity = Number.isFinite(Number(options.opacity)) ? Number(options.opacity) : 0.24;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const box = Math.ceil(s * 1.48);
      const tform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
      const pxScale = Math.max(1, Math.min(3, Math.ceil(tform ? Math.hypot(tform.a, tform.b) : 1)));
      const cacheKey = `${t}:${box}:${pxScale}:${t === 'oil' ? (color || PRIMARY) : 'mesh'}`;
      let sprite = sideSpriteCache.get(cacheKey);
      if (!sprite) {
        sprite = document.createElement('canvas');
        sprite.width = box * pxScale;
        sprite.height = box * pxScale;
        const sc = sprite.getContext('2d');
        if (sc) {
          sc.setTransform(pxScale, 0, 0, pxScale, 0, 0);
          sc.clearRect(0, 0, box, box);
          if (t === 'oil') {
            sc.save();
            sc.translate(box * 0.5, box * 0.5);
            drawOilDroplet(sc, s * 0.5, color || PRIMARY, true);
            sc.restore();
          } else {
            drawProjectedMeshCanvas(sc, t, box * 0.5, box * 0.5, s, true);
          }
          sc.save();
          sc.globalCompositeOperation = 'destination-in';
          const fadeGrad = sc.createLinearGradient(0, 0, box, 0);
          fadeGrad.addColorStop(0, 'rgba(0,0,0,0.96)');
          fadeGrad.addColorStop(0.45, 'rgba(0,0,0,0.82)');
          fadeGrad.addColorStop(0.78, 'rgba(0,0,0,0.25)');
          fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
          sc.fillStyle = fadeGrad;
          sc.fillRect(0, 0, box, box);
          sc.restore();
          if (sideSpriteCache.size >= MAX_SIDE_SPRITES) {
            const oldestKey = sideSpriteCache.keys().next().value;
            if (oldestKey !== undefined) sideSpriteCache.delete(oldestKey);
          }
          sideSpriteCache.set(cacheKey, sprite);
        } else {
          sprite = null;
        }
      }
      if (sprite) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(sprite, x - box * 0.5, y - box * 0.5, box, box);
        ctx.restore();
        return;
      }
    }
    ctx.save();
    ctx.globalAlpha = opacity * 0.85;
    if (t === 'oil') {
      ctx.translate(x, y);
      drawOilDroplet(ctx, s * 0.5, color || PRIMARY, true);
    } else {
      drawProjectedMeshCanvas(ctx, t, x, y, s, true);
    }
    ctx.restore();
  }

  function svg(type, className = 'fz-asset-svg') {
    const t = String(type || 'generic').toLowerCase();
    const key = `${t}::${className}`;
    const cachedSvg = svgCache.get(key);
    if (cachedSvg) return cachedSvg;
    let out;
    if (t === 'oil') {
      const gradId = safeSvgId('fzOil', className);
      out = `<svg class="${className}" viewBox="0 0 28 28" fill="none" aria-hidden="true"><defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F8F2E7"/><stop offset="50%" stop-color="#C5A875"/><stop offset="100%" stop-color="#4F3728"/></linearGradient></defs>
        <ellipse cx="14" cy="24.5" rx="7.4" ry="2" fill="rgba(14,9,6,0.52)"/>
        <path d="M14 3.2C14 3.2 21.8 11.2 20.5 17C19.6 21.2 17.1 23.4 14 23.4C10.9 23.4 8.4 21.2 7.5 17C6.2 11.2 14 3.2 14 3.2Z" fill="url(#${gradId})" stroke="rgba(248,242,231,0.68)" stroke-width="0.9"/>
        <ellipse cx="11.4" cy="15.2" rx="1.35" ry="3.1" transform="rotate(-18 11.4 15.2)" fill="rgba(248,242,231,0.72)"/>
      </svg>`;
    } else {
      out = renderProjectedMeshSvg(t, 28, 28, 11.2, 14, 14.4, false, className);
    }
    svgCache.set(key, out);
    return out;
  }

  function svgSide3D(type, className = 'fz-asset-3d-svg') {
    const t = String(type || 'generic').toLowerCase();
    const key = `${t}::${className}`;
    const cachedSvg = svgSide3DCache.get(key);
    if (cachedSvg) return cachedSvg;
    let out;
    if (t === 'oil') {
      const gradId = safeSvgId('fzOil3d', className);
      out = `<svg class="${className}" viewBox="0 0 120 100" fill="none" aria-hidden="true"><defs><linearGradient id="${gradId}" x1="15%" y1="8%" x2="85%" y2="92%"><stop offset="0%" stop-color="#F8F2E7"/><stop offset="45%" stop-color="#C5A875"/><stop offset="100%" stop-color="#4F3728"/></linearGradient></defs>
        <g transform="rotate(-10 60 50)">
          <path d="M52 10C52 10 81 40 76 64C72 80 63 89 52 89C41 89 32 80 28 64C23 40 52 10 52 10Z" fill="#38261D"/>
          <path d="M62 10C62 10 91 40 86 64C82 80 73 89 62 89C51 89 42 80 38 64C33 40 62 10 62 10Z" fill="url(#${gradId})" stroke="rgba(248,242,231,0.7)" stroke-width="1.4"/>
          <ellipse cx="69" cy="59" rx="3.8" ry="11" transform="rotate(14 69 59)" fill="rgba(248,242,231,0.72)"/>
        </g>
      </svg>`;
    } else {
      out = renderProjectedMeshSvg(t, 120, 100, 38.5, 60, 51, true, className);
    }
    svgSide3DCache.set(key, out);
    return out;
  }

  function infer(item) {
    if (item && item.icon && item.icon !== 'auto') return item.icon;
    const s = `${item?.source || ''} ${item?.symbol || ''} ${item?.label || ''}`.toLowerCase();
    if (/crypto-bitcoin|bitcoin|\bbtc\b|بیت.?کوین/.test(s)) return 'bitcoin';
    if (/crypto-ethereum|ethereum|\beth\b|اتریوم/.test(s)) return 'ethereum';
    if (/crypto-tether|tether|\busdt\b|تتر/.test(s)) return 'tether';
    if (/crypto-ripple|ripple|\bxrp\b|ریپل/.test(s)) return 'ripple';
    if (/crypto-solana|solana|\bsol\b|سولانا/.test(s)) return 'solana';
    if (/crypto-binance|\bbnb\b|بایننس/.test(s)) return 'bnb';
    if (/crypto-cardano|\bada\b|کاردانو/.test(s)) return 'cardano';
    if (/crypto-dogecoin|\bdoge\b|دوج/.test(s)) return 'dogecoin';
    if (/crypto-tron|\btrx\b|ترون/.test(s)) return 'tron';
    if (/crypto|رمزارز|ارز دیجیتال/.test(s)) return 'crypto';
    if (/silver|نقره|platinum|پلاتین|palladium|پالادیوم/.test(s)) return 'silver';
    if (/basemetal|aluminum|copper|nickel|zinc|lead|cobalt|tin|فلز|مس|نیکل|روی|سرب|آلومینیوم/.test(s)) return 'metal';
    if (/coin|sekee|sekeb|nim|rob|gerami|سکه/.test(s)) return 'coin';
    if (/oil|energy|نفت|گاز|بنزین/.test(s)) return 'oil';
    if (/price_dollar_rl|\busd\b|دلار(?!.*کانادا|.*استرالیا|.*نیوزیلند|.*سنگاپور)/.test(s)) return 'usd';
    if (/price_eur|\beur\b|یورو/.test(s)) return 'eur';
    if (/price_gbp|\bgbp\b|پوند/.test(s)) return 'gbp';
    if (/price_aed|\baed\b|درهم/.test(s)) return 'aed';
    if (/price_omr|\bomr\b|ریال عمان|عمان/.test(s)) return 'omr';
    if (/price_sar|\bsar\b|ریال عربستان|عربستان/.test(s)) return 'sar';
    if (/price_kwd|\bkwd\b|دینار کویت|کویت/.test(s)) return 'kwd';
    if (/price_aud|\baud\b|دلار استرالیا/.test(s)) return 'aud';
    if (/price_try|\btry\b|لیر/.test(s)) return 'try';
    if (/price_cad|\bcad\b|دلار کانادا/.test(s)) return 'cad';
    if (/price_chf|\bchf\b|فرانک/.test(s)) return 'chf';
    if (/price_cny|\bcny\b|یوان/.test(s)) return 'cny';
    if (/price_jpy|\bjpy\b|ین ژاپن/.test(s)) return 'jpy';
    if (/price_iqd|\biqd\b|دینار عراق/.test(s)) return 'iqd';
    if (/price_rub|\brub\b|روبل/.test(s)) return 'rub';
    if (/forex|fx|جفت.?ارز|eur-usd|gbp-usd|usd-/.test(s)) return 'forex';
    if (/currency|ارز|دینار|ریال|روپیه|کرون|منات/.test(s)) return 'currency';
    if (/bond|اوراق/.test(s)) return 'bond';
    if (/fund|etf|صندوق/.test(s)) return 'fund';
    if (/stock|index|tse|بورس|شاخص|سهام|داوجونز|نزدک/.test(s)) return 'stock';
    if (/commodity|wheat|corn|coffee|sugar|cotton|barley|rice|cocoa|soybean|گندم|ذرت|قهوه|شکر|پنبه|جو|برنج|کاکائو|سویا/.test(s)) return 'commodity';
    if (/ounce|\bons\b|gold_global|انس/.test(s)) return 'ounce';
    if (/gold|gram|geram|mesghal|mazaneh|abshodeh|طلا|مظنه|آبشده|ابشده|شمش/.test(s)) return 'gold';
    return 'generic';
  }

  root.FarzinAssetIcons = { draw, drawSide3D, infer, svg, svgSide3D };
})(window);
