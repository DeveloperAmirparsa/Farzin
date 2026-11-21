(function (root) {
  'use strict';
  const PRIMARY = '#c5a875';
  const SECONDARY = '#9f9082';
  const MOCHA = '#6e503e';
  const CHAMPAGNE = '#e8d8be';
  const IVORY = '#f8f2e7';
  const CHOCOLATE = '#1b120e';
  let svgSeq = 0;

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

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return [197, 168, 117];
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [Number.isFinite(r) ? r : 197, Number.isFinite(g) ? g : 168, Number.isFinite(b) ? b : 117];
  }

  function rgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function draw3DMedallion(ctx, r, accent, rimLight, rimDark, coreTop, coreBottom) {
    // 1. Soft 3D ambient drop shadow beneath medallion
    ctx.save();
    ctx.fillStyle = 'rgba(14, 9, 6, 0.58)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.24, r * 0.92, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Extruded lower 3D metal edge (coin depth)
    ctx.save();
    ctx.fillStyle = safeLinear(ctx, -r, 0, r, r, [
      [0, rimDark],
      [0.5, accent],
      [1, CHOCOLATE]
    ], rimDark);
    ctx.beginPath();
    ctx.arc(0, r * 0.11, r * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Beveled outer metallic rim
    ctx.save();
    ctx.fillStyle = safeLinear(ctx, -r * 0.85, -r * 0.85, r * 0.85, r * 0.85, [
      [0, IVORY],
      [0.24, rimLight],
      [0.62, accent],
      [1, rimDark]
    ], rimLight);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Recessed deep-chocolate & mocha luxury inner face
    ctx.save();
    ctx.fillStyle = safeRadial(ctx, -r * 0.28, -r * 0.32, r * 0.06, 0, 0, r * 0.72, [
      [0, coreTop],
      [0.7, coreBottom],
      [1, '#140c08']
    ], coreBottom);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, r * 0.055);
    ctx.strokeStyle = 'rgba(248, 242, 231, 0.32)';
    ctx.stroke();
    ctx.restore();

    // 5. Top-left 3D glass specular arc
    ctx.save();
    ctx.strokeStyle = 'rgba(248, 242, 231, 0.72)';
    ctx.lineWidth = Math.max(1, r * 0.075);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, Math.PI * 1.12, Math.PI * 1.68);
    ctx.stroke();
    ctx.restore();
  }

  function draw(ctx, type, x, y, size, color) {
    const t = String(type || 'generic').toLowerCase();
    const s = Math.max(10, Number(size) || 18);
    const r = s / 2;
    const primary = color || PRIMARY;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (t === 'gold') {
      // Sculpted 3D Champagne, Muted Gold & Mocha Bullion Crest Medallion
      draw3DMedallion(ctx, r, primary, CHAMPAGNE, '#4f3728', '#38261d', CHOCOLATE);
      ctx.save();
      ctx.fillStyle = safeLinear(ctx, -r * 0.45, -r * 0.36, r * 0.45, r * 0.38, [
        [0, IVORY],
        [0.45, primary],
        [1, MOCHA]
      ], primary);
      ctx.beginPath();
      ctx.moveTo(-r * 0.44, -r * 0.08);
      ctx.lineTo(-r * 0.28, -r * 0.38);
      ctx.lineTo(0, -r * 0.16);
      ctx.lineTo(r * 0.28, -r * 0.38);
      ctx.lineTo(r * 0.44, -r * 0.08);
      ctx.lineTo(r * 0.34, r * 0.34);
      ctx.lineTo(-r * 0.34, r * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(0.8, r * 0.05);
      ctx.strokeStyle = 'rgba(248,242,231,0.62)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(248,242,231,0.34)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, r * 0.02);
      ctx.lineTo(0, -r * 0.12);
      ctx.lineTo(r * 0.2, r * 0.02);
      ctx.lineTo(0, r * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (t === 'coin') {
      // Sculpted 3D Minted Warm Ivory & Muted Taupe Sovereign Coin
      draw3DMedallion(ctx, r, SECONDARY, CHAMPAGNE, '#5a4a3f', '#38261d', CHOCOLATE);
      ctx.save();
      ctx.strokeStyle = safeLinear(ctx, -r * 0.45, -r * 0.45, r * 0.45, r * 0.45, [
        [0, IVORY],
        [0.5, CHAMPAGNE],
        [1, SECONDARY]
      ], SECONDARY);
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = IVORY;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r * 0.34 : r * 0.15;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (t === 'silver' || t === 'metal') {
      // Faceted 3D Warm Ivory & Muted Taupe Diamond Prism
      ctx.save();
      ctx.fillStyle = 'rgba(14,9,6,0.52)';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.56, r * 0.68, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = safeLinear(ctx, -r * 0.8, -r * 0.7, 0, r * 0.8, [
        [0, IVORY],
        [0.45, '#cbbcaf'],
        [1, '#736559']
      ], '#cbbcaf');
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(-r * 0.78, -r * 0.16);
      ctx.lineTo(0, r * 0.86);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = safeLinear(ctx, 0, -r * 0.8, r * 0.8, r * 0.8, [
        [0, CHAMPAGNE],
        [0.5, SECONDARY],
        [1, '#4f3728']
      ], SECONDARY);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(r * 0.78, -r * 0.16);
      ctx.lineTo(0, r * 0.86);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(248,242,231,0.68)';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(-r * 0.42, -r * 0.16);
      ctx.lineTo(r * 0.42, -r * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(248,242,231,0.72)';
      ctx.lineWidth = Math.max(0.8, r * 0.055);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(r * 0.78, -r * 0.16);
      ctx.lineTo(0, r * 0.86);
      ctx.lineTo(-r * 0.78, -r * 0.16);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    } else if (t === 'oil') {
      // Sculpted 3D Deep Chocolate & Mocha Oil Droplet
      ctx.save();
      ctx.fillStyle = 'rgba(14,9,6,0.54)';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.65, r * 0.6, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      const dropPath = () => {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.92);
        ctx.bezierCurveTo(r * 0.2, -r * 0.5, r * 0.76, -r * 0.02, r * 0.6, r * 0.48);
        ctx.bezierCurveTo(r * 0.44, r * 0.95, -r * 0.44, r * 0.95, -r * 0.6, r * 0.48);
        ctx.bezierCurveTo(-r * 0.76, -r * 0.02, -r * 0.2, -r * 0.5, 0, -r * 0.92);
        ctx.closePath();
      };

      ctx.fillStyle = safeRadial(ctx, -r * 0.24, r * 0.15, r * 0.06, 0, r * 0.22, r * 0.85, [
        [0, CHAMPAGNE],
        [0.28, MOCHA],
        [0.7, '#38261d'],
        [1, CHOCOLATE]
      ], MOCHA);
      dropPath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(232, 216, 190, 0.62)';
      ctx.lineWidth = Math.max(0.9, r * 0.06);
      dropPath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(248, 242, 231, 0.75)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.22, r * 0.22, r * 0.12, r * 0.28, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (['currency', 'forex', 'usd', 'eur', 'gbp', 'aed', 'try', 'cad', 'chf', 'cny', 'jpy', 'iqd', 'rub'].includes(t)) {
      draw3DMedallion(ctx, r, SECONDARY, IVORY, '#5a4a3f', '#2b1d16', CHOCOLATE);
      const glyph = ({
        forex: '↔', usd: '$', eur: '€', gbp: '£', aed: 'د', try: '₺',
        cad: 'C$', chf: '₣', cny: '¥', jpy: '¥', iqd: 'د', rub: '₽', currency: '$'
      })[t] || '$';
      ctx.save();
      ctx.font = `800 ${Math.round(s * (glyph.length > 1 ? 0.36 : 0.48))}px Vazirmatn, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(14,9,6,0.65)';
      ctx.fillText(glyph, 0, 1.8);
      ctx.fillStyle = safeLinear(ctx, 0, -r * 0.4, 0, r * 0.4, [
        [0, IVORY],
        [0.5, CHAMPAGNE],
        [1, SECONDARY]
      ], IVORY);
      ctx.fillText(glyph, 0, 0.5);
      ctx.restore();
    } else if (['crypto', 'bitcoin', 'ethereum', 'tether', 'ripple', 'solana', 'bnb', 'cardano', 'dogecoin', 'tron'].includes(t)) {
      draw3DMedallion(ctx, r, primary, CHAMPAGNE, '#4f3728', '#2b1d16', CHOCOLATE);
      const glyph = ({
        bitcoin: '₿', ethereum: '◆', tether: '₮', ripple: '✕', solana: '≋',
        bnb: '◆', cardano: '₳', dogecoin: 'Ð', tron: 'T', crypto: '₿'
      })[t] || '₿';
      ctx.save();
      ctx.font = `800 ${Math.round(s * 0.48)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(14,9,6,0.65)';
      ctx.fillText(glyph, 0, 1.8);
      ctx.fillStyle = safeLinear(ctx, 0, -r * 0.4, 0, r * 0.4, [
        [0, IVORY],
        [0.55, CHAMPAGNE],
        [1, primary]
      ], IVORY);
      ctx.fillText(glyph, 0, 0.5);
      ctx.restore();
    } else if (t === 'commodity') {
      draw3DMedallion(ctx, r, SECONDARY, IVORY, '#5a4a3f', '#2b1d16', CHOCOLATE);
      ctx.save();
      ctx.strokeStyle = IVORY;
      ctx.lineWidth = Math.max(1.2, r * 0.085);
      ctx.beginPath();
      ctx.moveTo(-r * 0.36, r * 0.34);
      ctx.lineTo(-r * 0.18, -r * 0.28);
      ctx.lineTo(0, -r * 0.42);
      ctx.lineTo(r * 0.18, -r * 0.28);
      ctx.lineTo(r * 0.36, r * 0.34);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.28, r * 0.08);
      ctx.quadraticCurveTo(0, -r * 0.1, r * 0.28, r * 0.08);
      ctx.stroke();
      ctx.restore();
    } else if (t === 'stock' || t === 'fund') {
      draw3DMedallion(ctx, r, primary, CHAMPAGNE, '#4f3728', '#2b1d16', CHOCOLATE);
      ctx.save();
      ctx.strokeStyle = IVORY;
      ctx.lineWidth = Math.max(1.3, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.26);
      ctx.lineTo(-r * 0.12, -r * 0.02);
      ctx.lineTo(r * 0.1, r * 0.14);
      ctx.lineTo(r * 0.38, -r * 0.28);
      ctx.stroke();
      ctx.fillStyle = CHAMPAGNE;
      ctx.beginPath();
      ctx.arc(r * 0.38, -r * 0.28, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (t === 'bond') {
      draw3DMedallion(ctx, r, SECONDARY, IVORY, '#5a4a3f', '#2b1d16', CHOCOLATE);
      ctx.save();
      ctx.strokeStyle = IVORY;
      ctx.lineWidth = Math.max(1.1, r * 0.08);
      ctx.beginPath();
      ctx.rect(-r * 0.28, -r * 0.34, r * 0.56, r * 0.68);
      ctx.stroke();
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, i * r * 0.16);
        ctx.lineTo(r * 0.16, i * r * 0.16);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      draw3DMedallion(ctx, r, primary, CHAMPAGNE, '#4f3728', '#2b1d16', CHOCOLATE);
      ctx.save();
      ctx.fillStyle = IVORY;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
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
    if (/silver|نقره|platinum|palladium|aluminum|copper|nickel|فلز|مس|نیکل/.test(s)) return 'silver';
    if (/coin|sekee|sekeb|nim|rob|gerami|سکه/.test(s)) return 'coin';
    if (/oil|energy|نفت|گاز|بنزین/.test(s)) return 'oil';
    if (/price_dollar_rl|\busd\b|دلار/.test(s)) return 'usd';
    if (/price_eur|\beur\b|یورو/.test(s)) return 'eur';
    if (/price_gbp|\bgbp\b|پوند/.test(s)) return 'gbp';
    if (/price_aed|\baed\b|درهم/.test(s)) return 'aed';
    if (/price_try|\btry\b|لیر/.test(s)) return 'try';
    if (/price_cad|\bcad\b/.test(s)) return 'cad';
    if (/price_chf|\bchf\b/.test(s)) return 'chf';
    if (/price_cny|\bcny\b|یوان/.test(s)) return 'cny';
    if (/price_jpy|\bjpy\b|ین/.test(s)) return 'jpy';
    if (/currency|ارز/.test(s)) return 'currency';
    if (/forex|fx|جفت.?ارز/.test(s)) return 'forex';
    if (/stock|index|tse|بورس|شاخص|سهام/.test(s)) return 'stock';
    if (/commodity|wheat|corn|coffee|sugar|گندم|ذرت|قهوه|شکر/.test(s)) return 'commodity';
    if (/gold|gram|mesghal|ounce|طلا|مظنه|آبشده|انس/.test(s)) return 'gold';
    return 'generic';
  }

  function svg(type, className = 'fz-asset-svg') {
    const t = String(type || 'generic').toLowerCase();
    const uid = ++svgSeq;
    const gBevel = `fzBev${uid}`;
    const gCore = `fzCor${uid}`;
    const gFace = `fzFac${uid}`;
    const isWarmGold = ['gold', 'oil', 'stock', 'fund', 'crypto', 'bitcoin', 'ethereum', 'tether', 'ripple', 'solana', 'bnb', 'cardano', 'dogecoin', 'tron', 'generic'].includes(t);
    const bevelTop = isWarmGold ? '#F8F2E7' : '#EFE7D8';
    const bevelMid = isWarmGold ? '#C5A875' : '#9F9082';
    const bevelBot = isWarmGold ? '#4F3728' : '#5A4A3F';
    const coreTop = isWarmGold ? '#38261D' : '#2B1D16';

    const defs = `<defs>
      <linearGradient id="${gBevel}" x1="15%" y1="10%" x2="85%" y2="90%">
        <stop offset="0%" stop-color="${bevelTop}"/>
        <stop offset="45%" stop-color="${bevelMid}"/>
        <stop offset="100%" stop-color="${bevelBot}"/>
      </linearGradient>
      <radialGradient id="${gCore}" cx="35%" cy="30%" r="72%">
        <stop offset="0%" stop-color="${coreTop}"/>
        <stop offset="75%" stop-color="#221712"/>
        <stop offset="100%" stop-color="#1B120E"/>
      </radialGradient>
      <linearGradient id="${gFace}" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stop-color="#F8F2E7"/>
        <stop offset="55%" stop-color="${isWarmGold ? '#C5A875' : '#E8D8BE'}"/>
        <stop offset="100%" stop-color="${isWarmGold ? '#6E503E' : '#9F9082'}"/>
      </linearGradient>
    </defs>`;

    const wrap = inner => `<svg class="${className}" viewBox="0 0 28 28" fill="none" aria-hidden="true">${defs}
      <ellipse cx="14" cy="24.2" rx="9" ry="2.2" fill="rgba(14,9,6,0.52)"/>
      <circle cx="14" cy="15.2" r="10.4" fill="${bevelBot}"/>
      <circle cx="14" cy="13.4" r="10.4" fill="url(#${gBevel})"/>
      <circle cx="14" cy="13.4" r="8.4" fill="url(#${gCore})" stroke="rgba(248,242,231,0.34)" stroke-width="0.65"/>
      <path d="M7.2 8.2A9.3 9.3 0 0 1 18.6 5.3" stroke="rgba(248,242,231,0.75)" stroke-width="1.15" stroke-linecap="round"/>
      ${inner}
    </svg>`;

    if (t === 'gold') {
      return wrap(`<path d="M9 13.5L10.8 9.2L14 11.7L17.2 9.2L19 13.5L17.6 17.6H10.4Z" fill="url(#${gFace})" stroke="rgba(248,242,231,0.65)" stroke-width="0.6" stroke-linejoin="round"/><path d="M14 11.6L15.8 14L14 16.4L12.2 14Z" fill="rgba(248,242,231,0.4)"/>`);
    }
    if (t === 'coin') {
      return wrap(`<circle cx="14" cy="13.4" r="5.5" stroke="url(#${gFace})" stroke-width="1.05"/><path d="M14 9.5L15.1 12.3L17.9 13.4L15.1 14.5L14 17.3L12.9 14.5L10.1 13.4L12.9 12.3Z" fill="url(#${gFace})"/>`);
    }
    if (t === 'silver' || t === 'metal') {
      return `<svg class="${className}" viewBox="0 0 28 28" fill="none" aria-hidden="true">${defs}
        <ellipse cx="14" cy="24.5" rx="7.6" ry="2.1" fill="rgba(14,9,6,0.48)"/>
        <polygon points="14,3 4.5,12 14,23.2" fill="#E8D8BE"/>
        <polygon points="14,3 23.5,12 14,23.2" fill="#9F9082"/>
        <polygon points="14,3 9,12 19,12" fill="#F8F2E7" opacity="0.72"/>
        <polygon points="14,3 23.5,12 14,23.2 4.5,12" stroke="rgba(248,242,231,0.75)" stroke-width="0.9" stroke-linejoin="round"/>
      </svg>`;
    }
    if (t === 'oil') {
      return `<svg class="${className}" viewBox="0 0 28 28" fill="none" aria-hidden="true">${defs}
        <ellipse cx="14" cy="24.5" rx="7.4" ry="2" fill="rgba(14,9,6,0.52)"/>
        <path d="M14 3.2C14 3.2 21.8 11.2 20.5 17C19.6 21.2 17.1 23.4 14 23.4C10.9 23.4 8.4 21.2 7.5 17C6.2 11.2 14 3.2 14 3.2Z" fill="url(#${gBevel})" stroke="rgba(248,242,231,0.68)" stroke-width="0.9"/>
        <ellipse cx="11.4" cy="15.2" rx="1.35" ry="3.1" transform="rotate(-18 11.4 15.2)" fill="rgba(248,242,231,0.72)"/>
      </svg>`;
    }
    if (['currency', 'forex', 'usd', 'eur', 'gbp', 'aed', 'try', 'cad', 'chf', 'cny', 'jpy', 'iqd', 'rub'].includes(t)) {
      const glyph = ({
        forex: 'FX', usd: '$', eur: '€', gbp: '£', aed: 'د', try: '₺',
        cad: 'C$', chf: '₣', cny: '¥', jpy: '¥', iqd: 'د', rub: '₽', currency: '$'
      })[t] || '$';
      const fontSize = glyph.length > 1 ? 8.2 : 11;
      return wrap(`<text x="14" y="17.2" text-anchor="middle" fill="url(#${gFace})" font-size="${fontSize}" font-weight="800" font-family="Vazirmatn, system-ui, sans-serif">${glyph}</text>`);
    }
    if (['crypto', 'bitcoin', 'ethereum', 'tether', 'ripple', 'solana', 'bnb', 'cardano', 'dogecoin', 'tron'].includes(t)) {
      const glyph = ({
        bitcoin: '₿', ethereum: '◆', tether: '₮', ripple: '✕', solana: '≋',
        bnb: '◆', cardano: '₳', dogecoin: 'Ð', tron: 'T', crypto: '₿'
      })[t] || '₿';
      return wrap(`<text x="14" y="17.2" text-anchor="middle" fill="url(#${gFace})" font-size="11" font-weight="800" font-family="system-ui, sans-serif">${glyph}</text>`);
    }
    if (t === 'commodity') {
      return wrap(`<path d="M9.8 17.5L11.5 10L14 8.2L16.5 10L18.2 17.5" stroke="url(#${gFace})" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.8 14C12.8 12.2 15.2 12.2 17.2 14" stroke="url(#${gFace})" stroke-width="1.2" stroke-linecap="round"/>`);
    }
    if (t === 'stock' || t === 'fund') {
      return wrap(`<path d="M9 16.5L12.2 13.2L14.5 14.9L18.5 10.2" stroke="url(#${gFace})" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18.5" cy="10.2" r="1.5" fill="#E8D8BE"/>`);
    }
    if (t === 'bond') {
      return wrap(`<rect x="10.2" y="9" width="7.6" height="9" rx="1.2" stroke="url(#${gFace})" stroke-width="1.2"/><path d="M12 11.8H16M12 14.2H16" stroke="url(#${gFace})" stroke-width="1.1" stroke-linecap="round"/>`);
    }
    return wrap(`<circle cx="14" cy="13.4" r="3" fill="url(#${gFace})"/>`);
  }

  root.FarzinAssetIcons = { draw, infer, svg };
})(window);
