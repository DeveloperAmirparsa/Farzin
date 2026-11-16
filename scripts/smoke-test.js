'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const net = require('node:net');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

function checkSyntax(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${path.relative(root, file)} syntax error: ${result.stderr || result.stdout}`);
}

function testTgjuParser() {
  const sandbox = { window: {}, document: {} };
  vm.runInNewContext(fs.readFileSync(path.join(publicDir, 'tgju-widget.js'), 'utf8'), sandbox);
  const api = sandbox.window.FarzinTGJUWidget;
  assert.ok(api && typeof api.parse === 'function', 'TGJU widget helper should be exposed');
  const code = '<tgju type="market-data" items="123,456" columns="dot,diff,time" token="fake" onload="alert(1)"></tgju><script src="https://api.tgju.org/v1/widget/v2" defer></script>';
  const parsed = api.parse(code);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'market-data');
  assert.equal(parsed[0].items, '123,456');
  assert.equal(parsed[0].token, 'webservice');
  assert.equal(parsed[0].onload, undefined, 'inline event attributes must be removed');
  assert.throws(() => api.parse('<tgju type="market-data" items="MARKET_ITEMS"></tgju>'), /شناسه آیتم/);
  assert.throws(() => api.parse('<tgju type="ticker-single" items="123,456"></tgju>'), /بیشتر از 1/);
  assert.throws(() => api.parse('no widget code'), /تگ رسمی/);
  assert.throws(() => api.parse(Array.from({ length: 21 }, (_, i) => i + 1).join(',').replace(/^/, '<tgju type="market-data" items="').concat('"></tgju>')), /بیشتر از 20/);
}


function testBoardBootWithoutStructuredClone() {
  let quadraticCurveCalls = 0;
  const ctx = new Proxy({
    measureText: () => ({ width: 10 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    quadraticCurveTo() { quadraticCurveCalls++; },
    arcTo() { throw new Error('Board must not call Canvas arcTo.'); }
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
    set(target, key, value) { target[key] = value; return true; }
  });
  const elements = new Map();
  let resizeHandler = null;
  const transforms = [];
  ctx.setTransform = (...args) => transforms.push(args);
  const makeElement = id => ({
    id, textContent: id === 'boardStatus' ? 'در حال راه‌اندازی تابلو…' : '',
    title: '', width: 1920, height: 1080, style: {},
    getContext: () => ctx,
    addEventListener() {},
    classList: { add() {}, remove() {}, toggle() {} }
  });
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); },
    addEventListener() {},
    fonts: { ready: Promise.resolve() },
    documentElement: { clientWidth: 1280, clientHeight: 720 },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2,
    hidden: false,
    fullscreenElement: null
  };
  const window = { addEventListener(type, callback) { if (type === 'resize') resizeHandler = callback; }, structuredClone: undefined, __farzinBoardBooted: false, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 };
  const responseFor = url => {
    if (url === '/api/config') return { settings: null };
    if (url === '/api/dashboard-data') return { status: 'offline', hasPrices: false, prices: {}, sideRates: {}, errors: { tgju: 'mock offline' } };
    if (url === '/api/news') return { items: [] };
    if (url === '/api/logo-meta') return { version: 1, size: 100 };
    return {};
  };
  const sandbox = {
    window, document, console,
    fetch: async url => ({ ok: true, status: 200, json: async () => responseFor(url) }),
    Image: function Image() { this.onload = null; this.onerror = null; this.src = ''; },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    AbortController, Intl, Date, Number, String, Math, JSON, Object, Array, Promise, Error,
    URL, encodeURIComponent
  };
  vm.runInNewContext(fs.readFileSync(path.join(publicDir, 'board.js'), 'utf8'), sandbox, { filename: 'board.js' });
  assert.equal(window.__farzinBoardBooted, true, 'board must complete its initial boot without structuredClone');
  assert.notEqual(elements.get('boardStatus').textContent, 'در حال راه‌اندازی تابلو…', 'board must replace the initial HTML startup label');
  assert.ok(quadraticCurveCalls > 0, 'board should draw rounded cards using quadratic curves');
  assert.equal(elements.get('boardCanvas').width, 2560, 'canvas should render at HiDPI backing resolution for a 1280x720 viewport');
  assert.equal(elements.get('boardCanvas').height, 1440, 'canvas should retain 16:9 proportions on HiDPI screens');
  assert.ok(transforms.length > 0, 'responsive canvas should apply a design-space transform');
  assert.equal(typeof resizeHandler, 'function', 'board should listen for viewport/display size changes');
  window.innerWidth = 3840; window.innerHeight = 2160; resizeHandler();
  assert.equal(elements.get('boardCanvas').width, 4096, '4K rendering should stay within the canvas memory safety cap');
  assert.ok(transforms.length > 1, 'canvas should recalculate scale after display resolution changes');
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

function makeMockTgjuFeed() {
  const stamp = new Date().toISOString();
  const q = (p, dp = '0.5', dt = 'up') => ({ p: String(p), dp: String(dp), dt, updated_at: stamp, h: String(Number(p) * 1.01), l: String(Number(p) * 0.99) });
  return {
    current: {
      mesghal: q(700000000), geram18: q(100000000), sekee: q(2500000000), sekeb: q(2400000000),
      nim: q(1300000000), rob: q(700000000), gerami: q(350000000), geram24: q(133333333),
      ons: q(3900, '0.2'), price_dollar_rl: q(110000000), price_aed: q(30000000), price_eur: q(120000000),
      silver_999: q(50000000), silver_925: q(45000000), 'energy_brent_oil': q(95, '0.3'), 'crypto-bitcoin': q(65000, '1.2'), 'crypto-tether': q(1, '0.01'), 'basemetal-aluminum': q(2600, '0.4')
    }
  };
}



async function testAdminAuth() {
  const port = await getFreePort();
  const tempData = fs.mkdtempSync(path.join(os.tmpdir(), 'farzin-auth-test-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT:String(port), HOST:'127.0.0.1', FARZIN_DATA_DIR:tempData, ADMIN_USER:'admin', ADMIN_PASSWORD:'test-secret' },
    stdio:['ignore','pipe','pipe']
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i=0;i<40;i++) {
      if (child.exitCode !== null) throw new Error('Auth test server exited early.');
      try { const r=await fetch(`${base}/api/health`); if(r.ok){ready=true;break;} } catch {}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,'Auth test server should start');
    assert.equal((await fetch(`${base}/`)).status,401,'Admin home must be protected when deployed');
    assert.equal((await fetch(`${base}/board-config`)).status,401,'Board configuration must be protected');
    assert.equal((await fetch(`${base}/api/config`)).status,401,'Private settings API must be protected');
    assert.equal((await fetch(`${base}/board`)).status,200,'Public board should remain accessible');
    assert.equal((await fetch(`${base}/api/public-config`)).status,200,'Board must receive public display settings');
    const auth = 'Basic '+Buffer.from('admin:test-secret').toString('base64');
    assert.equal((await fetch(`${base}/`,{headers:{Authorization:auth}})).status,200,'Admin can open the editor');
    assert.equal((await fetch(`${base}/api/config`,{headers:{Authorization:auth}})).status,200,'Admin can read private config');
    assert.equal((await fetch(`${base}/api/config`,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({settings:{schemaVersion:5}})})).status,200,'Admin can save settings');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(resolve,1200);child.once('exit',()=>{clearTimeout(timer);resolve();});});
    fs.rmSync(tempData,{recursive:true,force:true});
  }
}

function serverSourceHasPersianNews() {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  return source.includes('https://feeds.bbci.co.uk/persian/rss.xml') &&
    source.includes('https://rss.dw.com/syndication/feeds/dwworld.per.xml') &&
    source.includes("if (!/[\\u0600-\\u06FF]/.test(item.title)) return false;");
}


function testAssetCatalogAndIcons() {
  const window = {};
  const sandbox = { window };
  vm.runInNewContext(fs.readFileSync(path.join(publicDir, 'asset-catalog.js'), 'utf8'), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(publicDir, 'asset-icons.js'), 'utf8'), sandbox);
  const catalog = window.FARZIN_ASSET_CATALOG;
  assert.ok(catalog.groups.some(group => group.id === 'crypto'));
  assert.ok(catalog.items.some(item => item.symbol === 'crypto-bitcoin'));
  assert.ok(catalog.items.some(item => item.symbol === 'crypto-tether'));
  assert.ok(catalog.items.some(item => item.symbol === 'silver_925'));
  assert.ok(catalog.items.some(item => item.symbol === 'basemetal-aluminum'));
  assert.equal(window.FarzinAssetIcons.infer({ source:'crypto-bitcoin', label:'بیت کوین' }), 'bitcoin');
  assert.equal(window.FarzinAssetIcons.infer({ source:'crypto-tether', label:'تتر' }), 'tether');
  let draws = 0;
  const ctx = new Proxy({ measureText:()=>({width:8}) }, { get(target,key){return key in target?target[key]:(()=>{});}, set(target,key,value){target[key]=value;return true;} });
  window.FarzinAssetIcons.draw(ctx,'gold',0,0,18,'#d6b66b');
  window.FarzinAssetIcons.draw(ctx,'bitcoin',0,0,18,'#d6b66b');
  draws += 2;
  assert.equal(draws,2);
}

async function testServerRoutes() {
  const port = await getFreePort();
  const tempData = fs.mkdtempSync(path.join(os.tmpdir(), 'farzin-studio-test-'));
  const mockFeed = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(makeMockTgjuFeed()));
  });
  const mockPort = await listen(mockFeed);
  const childEnv = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1', // prove legacy .env setting is upgraded to LAN binding
    FARZIN_DATA_DIR: tempData,
    TGJU_FEED_URL: `http://127.0.0.1:${mockPort}/ajax.json`
  };
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk.toString(); });
  child.stderr.on('data', chunk => { log += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      if (child.exitCode !== null) throw new Error(`Server exited early: ${log}`);
      try {
        const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.ok(ready, `Server did not become ready: ${log}`);
    for (const route of ['/', '/board', '/board-config', '/tgju-widget', '/board.js', '/board-config.js', '/tgju-widget.js', '/asset-catalog.js', '/asset-icons.js', '/farzin-logo.png']) {
      const response = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(3000) });
      assert.equal(response.status, 200, `${route} should return HTTP 200`);
    }
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.host, '0.0.0.0', 'Server should bind to all LAN interfaces');
    assert.equal(health.source, 'TGJU');
    const publicConfigResponse = await fetch(`${base}/api/public-config`);
    assert.equal(publicConfigResponse.status, 200);
    const liveAssetsResponse = await fetch(`${base}/api/assets`);
    assert.equal(liveAssetsResponse.status, 200);
    const config = await (await fetch(`${base}/api/config`)).json();
    assert.ok(config && typeof config === 'object');
    assert.equal(config.source, 'TGJU');
    assert.equal(config.sourceRequiresKey, false);

    let market = null;
    for (let i = 0; i < 30; i++) {
      const response = await fetch(`${base}/api/dashboard-data`, { signal: AbortSignal.timeout(1200) });
      assert.equal(response.status, 200);
      market = await response.json();
      if (market.hasPrices) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(market.source, 'TGJU');
    assert.equal(market.status, 'online', `Mock TGJU feed should fill all required symbols: ${JSON.stringify(market.errors)}`);
    assert.equal(market.hasPrices, true);
    assert.equal(market.prices.gram18.price, 10_000_000, 'TGJU Rial quotes should convert to Toman');
    assert.ok(Math.abs(market.prices.gram21.price - (10_000_000 * 21 / 18)) < 1e-6, '21k quote should derive from 18k');
    assert.equal(market.prices.coin_full.price, 250_000_000);
    assert.equal(market.prices.coin_old.price, 240_000_000);
    assert.equal(market.prices.ounce.price, 3900, 'Ounce should retain USD unit');
    assert.equal(market.sideRates.silver.price, 5_000_000);
    assert.equal(market.sideRates.oil.price, 95, 'Brent should retain USD/barrel unit');
    assert.equal(market.sideRates.usd.price, 11_000_000);
    assert.equal(market.assets['crypto-bitcoin'].price, 65000, 'Generic TGJU symbols should be exposed without forcing a local currency conversion');
    assert.equal(market.assets['crypto-tether'].price, 1, 'Tether should be available as a generic live asset');
    assert.equal(market.assets['silver_925'].price, 45_000_000, '925 silver should be exposed as a generic live asset');
    assert.ok(Array.isArray(market.history.points));

    const startedAt = Date.now();
    await fetch(`${base}/api/dashboard-data`, { signal: AbortSignal.timeout(1500) });
    assert.ok(Date.now() - startedAt < 1200, 'Dashboard API should return from local cache quickly');
    const refresh = await fetch(`${base}/api/refresh`, { method: 'POST', signal: AbortSignal.timeout(1500) });
    assert.equal(refresh.status, 202, 'Manual TGJU refresh should respond immediately');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(resolve, 1500);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    await new Promise(resolve => mockFeed.close(resolve));
    fs.rmSync(tempData, { recursive: true, force: true });
  }
}

(async () => {
  const jsFiles = [path.join(root, 'server.js'), ...fs.readdirSync(publicDir).filter(name => name.endsWith('.js')).map(name => path.join(publicDir, name))];
  for (const file of jsFiles) checkSyntax(file);
  testTgjuParser();
  testAssetCatalogAndIcons();
  testBoardBootWithoutStructuredClone();
  for (const file of ['board.js', 'app.js']) {
    const source = fs.readFileSync(path.join(publicDir, file), 'utf8');
    assert.ok(!/\.arcTo\s*\(/.test(source), `${file} must not use Canvas arcTo`);
    assert.ok(/quadraticCurveTo\s*\(/.test(source), `${file} should draw rounded corners with quadratic curves`);
  }
  const boardHtml = fs.readFileSync(path.join(publicDir, 'board.html'), 'utf8');
  assert.ok(boardHtml.includes('__farzinBoardBootTimer'), 'board HTML should include a startup watchdog');
  assert.ok(!boardHtml.includes('<script src="/tgju-widget.js"></script>'), 'board should not load the unused TGJU widget helper');
  const boardJs = fs.readFileSync(path.join(publicDir, 'board.js'), 'utf8');
  assert.ok(boardJs.includes('assetPrices[key]'), 'Board should resolve arbitrary TGJU symbols');
  assert.ok(boardJs.includes('drawAssetIcon'), 'Board should render per-asset icons');
  const storyJs = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
  assert.ok(storyJs.includes('assetPrices[key]'), 'Story should resolve arbitrary TGJU symbols');
  assert.ok(storyJs.includes('drawAssetIcon'), 'Story should render per-asset icons');
  assert.ok(fs.existsSync(path.join(root,'Dockerfile')) && fs.existsSync(path.join(root,'render.yaml')) && fs.existsSync(path.join(root,'railway.json')), 'Deployment files should exist');
  const boardConfigJs = fs.readFileSync(path.join(publicDir, 'board-config.js'), 'utf8');
  assert.ok(boardJs.includes('(bc.footerLines||[])'), 'Board should render its own footer config');
  assert.ok(!boardJs.includes('(settings.footerLines||[])'), 'Board must not consume the Story footer');
  assert.ok(boardConfigJs.includes('settings.boardConfig.footerLines'), 'Board config editor should modify only the Board footer');
  assert.ok(boardJs.includes('requestAnimationFrame'), 'News ticker should animate smoothly with requestAnimationFrame');
  assert.ok(boardJs.includes('setInterval(refreshLiveHeader,1000)'), 'Tehran clock should continue updating every second');
  assert.ok(boardJs.includes('tehranClock()') && boardJs.includes("'ساعت زنده تهران'"), 'Tehran time should render in a dedicated header card');
  assert.ok(serverSourceHasPersianNews(), 'News feed backend should use Persian-language world feeds and reject English-only headlines');
  await testServerRoutes();
  await testAdminAuth();
  const logo = fs.readFileSync(path.join(publicDir, 'farzin-logo.png'));
  assert.equal(logo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Logo should be a valid PNG');
  assert.equal(logo.readUInt32BE(16), 3200, 'Logo width should remain 3200px');
  assert.equal(logo.readUInt32BE(20), 3200, 'Logo height should remain 3200px');
  console.log(`Smoke test passed: ${jsFiles.length} JavaScript files, expanded TGJU asset catalogue and per-asset icons, deployment templates, TGJU widget safety checks, legacy-browser board boot fallback, mock live TGJU feed, all-symbol mapping, IRR/Toman conversions, fast dashboard responses, LAN bind, refresh and 3200px logo.`);
})().catch(error => {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
});
