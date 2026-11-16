(function (root) {
  'use strict';
  const GOLD = '#d6b66b';
  function draw(ctx, type, x, y, size, color) {
    const t = String(type || 'generic').toLowerCase();
    const s = Math.max(8, Number(size) || 18), r = s / 2, c = color || GOLD;
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = c; ctx.fillStyle = `${c}18`; ctx.lineWidth = Math.max(1.2, s * .075); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const circle = (rad, fill = false) => { ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); };
    const polygon = pts => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    if (t === 'gold' || t === 'coin') {
      circle(r * .82, true); circle(r * .63); circle(r * .43);
      ctx.beginPath(); ctx.moveTo(-r*.28,0); ctx.lineTo(r*.28,0); ctx.moveTo(0,-r*.28); ctx.lineTo(0,r*.28); ctx.stroke();
      if (t === 'gold') { ctx.beginPath(); ctx.moveTo(-r*.48,-r*.48); ctx.lineTo(-r*.25,-r*.64); ctx.lineTo(0,-r*.48); ctx.lineTo(r*.25,-r*.64); ctx.lineTo(r*.48,-r*.48); ctx.stroke(); }
    } else if (t === 'silver' || t === 'metal') {
      polygon([[0,-r*.9],[r*.7,-r*.12],[r*.35,r*.72],[-r*.35,r*.72],[-r*.7,-r*.12]]);
      ctx.beginPath(); ctx.moveTo(0,-r*.9); ctx.lineTo(0,r*.72); ctx.moveTo(-r*.7,-r*.12); ctx.lineTo(r*.7,-r*.12); ctx.stroke();
    } else if (t === 'oil') {
      ctx.beginPath(); ctx.moveTo(0,-r*.92); ctx.bezierCurveTo(r*.16,-r*.52,r*.72,-r*.08,r*.58,r*.42); ctx.bezierCurveTo(r*.45,r*.95,-r*.45,r*.95,-r*.58,r*.42); ctx.bezierCurveTo(-r*.72,-r*.08,-r*.16,-r*.52,0,-r*.92); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (['currency','forex','usd','eur','gbp','aed','try','cad','chf','cny','jpy','iqd','rub'].includes(t)) {
      circle(r*.82, true); ctx.font = `700 ${s*.62}px Arial`; ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=c;const glyph=({forex:'↔',usd:'$',eur:'€',gbp:'£',aed:'د',try:'₺',cad:'C$',chf:'₣',cny:'¥',jpy:'¥',iqd:'د',rub:'₽',currency:'$'})[t]||'$';ctx.fillText(glyph,0,1);
    } else if (['crypto','bitcoin','ethereum','tether','ripple','solana','bnb','cardano','dogecoin','tron'].includes(t)) {
      circle(r*.82, true); ctx.font = `700 ${s*.68}px Arial`; ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=c;
      const glyph = ({bitcoin:'₿',ethereum:'◆',tether:'₮',ripple:'✕',solana:'≋',bnb:'◆',cardano:'₳',dogecoin:'Ð',tron:'Ｔ',crypto:'₿'})[t] || '₿';ctx.fillText(glyph,0,1);
    } else if (t === 'commodity') {
      ctx.beginPath();ctx.moveTo(-r*.58,r*.68);ctx.lineTo(-r*.36,-r*.58);ctx.lineTo(0,-r*.82);ctx.lineTo(r*.36,-r*.58);ctx.lineTo(r*.58,r*.68);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-r*.48,r*.25);ctx.quadraticCurveTo(0,-r*.08,r*.48,r*.25);ctx.stroke();
    } else if (t === 'stock' || t === 'fund') {
      ctx.beginPath();ctx.moveTo(-r*.72,r*.7);ctx.lineTo(-r*.72,-r*.62);ctx.lineTo(r*.72,-r*.62);ctx.lineTo(r*.72,r*.7);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-r*.48,r*.35);ctx.lineTo(-r*.12,-r*.02);ctx.lineTo(r*.12,r*.18);ctx.lineTo(r*.48,-r*.36);ctx.stroke();
    } else if (t === 'bond') {
      ctx.beginPath();ctx.rect(-r*.62,-r*.72,r*1.24,r*1.44);ctx.stroke();
      for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-r*.35,i*r*.35);ctx.lineTo(r*.35,i*r*.35);ctx.stroke();}
    } else {
      circle(r*.78, true); ctx.beginPath();ctx.moveTo(-r*.35,0);ctx.lineTo(r*.35,0);ctx.moveTo(0,-r*.35);ctx.lineTo(0,r*.35);ctx.stroke();
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
  root.FarzinAssetIcons = { draw, infer };
})(window);
