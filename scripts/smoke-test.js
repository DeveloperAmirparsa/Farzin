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


async function testBoardBootWithoutStructuredClone() {
  let quadraticCurveCalls = 0;
  const drawnText = [];
  const ctx = new Proxy({
    font: '10px sans-serif',
    measureText(value) { const size = Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 10; return { width: String(value).length * size * 0.6 }; },
    fillText(value, x, y, maxWidth) { drawnText.push({ value:String(value), font:this.font, measuredWidth:this.measureText(value).width, maxWidth }); },
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
  window.innerWidth = 390; window.innerHeight = 844; window.devicePixelRatio = 3; resizeHandler();
  assert.equal(elements.get('boardCanvas').width, 780, 'mobile canvas backing dimensions should respect the DPR safety cap');
  assert.equal(elements.get('boardCanvas').height, 1688, 'mobile canvas backing dimensions should follow the viewport');
  assert.ok(transforms.at(-1)[0] < 1, 'board design should scale down on a narrow mobile viewport');
  window.innerWidth = 3840; window.innerHeight = 2160; resizeHandler();
  assert.equal(elements.get('boardCanvas').width, 4096, '4K rendering should stay within the canvas memory safety cap');
  assert.ok(transforms.length > 1, 'canvas should recalculate scale after display resolution changes');
}

function testBoardLongTextFit() {
  const source = fs.readFileSync(path.join(publicDir, 'board.js'), 'utf8');
  const declaration = source.match(/function text\([\s\S]*?\n\}/)?.[0];
  assert.ok(declaration, 'board should provide a measured text fitting helper');
  const sandbox = {};
  vm.runInNewContext(`${declaration}; this.drawFitText = text;`, sandbox);
  let drawn = null;
  const ctx = {
    save() {}, restore() {}, font:'',
    measureText(value) { const size = Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 10; return { width:String(value).length * size * 0.6 }; },
    fillText(value, x, y, maxWidth) { drawn = { value:String(value), width:this.measureText(value).width, maxWidth, font:this.font }; }
  };
  sandbox.drawFitText(ctx, '123456789012345678901234', 0, 0, 28, '#fff', 'center', 700, 180, 10);
  assert.ok(drawn, 'board should draw long numbers');
  assert.ok(drawn.width <= drawn.maxWidth, 'board long numbers should be measured to fit card bounds');
  assert.ok(Number(drawn.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) >= 10, 'board should preserve the configured minimum font size');
}

function testBoardCardLayout() {
  const source = fs.readFileSync(path.join(publicDir, 'board.js'), 'utf8');
  const declarations = ['cardGrid', 'centeredText', 'quotePrices'].map(name => {
    const declaration = source.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(declaration, `board should provide ${name}`);
    return declaration;
  });
  const sandbox = { Math, Number, String, Boolean, Intl };
  vm.runInNewContext(`function faNum(value){return new Intl.NumberFormat('fa-IR',{maximumFractionDigits:2}).formatToParts(value).map(part=>part.type==='group'?',':part.type==='decimal'?'.':part.value).join('');}\n${declarations.join('\n')}; this.cardGrid = cardGrid; this.centeredText = centeredText; this.quotePrices = quotePrices; this.faNum = faNum;`, sandbox);
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: i }));
  const first = sandbox.cardGrid(rows, 2, 60, 250, 1000, 420, 14, 4);
  assert.equal(first.rows, 5, 'main cards should retain all configured rows in the scrolling strip');
  assert.equal(first.items.length, 10, 'main-card scrolling should include every configured card');
  assert.equal(first.scrollable, true, 'main-card strip should scroll when it exceeds the viewport');
  assert.equal(first.positions[1].x, 567, 'card positions should follow predictable grid columns');
  assert.equal(first.positions[1].y, 250, 'card positions should stay on the first grid row');
  assert.equal(first.cycleHeight, first.rows * first.rowPitch, 'scroll cycle should land at the same card position after a full loop');
  assert.match(source, /cardScrollOffset\+=scrollSpeed\*dt;sideScrollOffset\+=scrollSpeed\*dt/, 'main and side card strips should continuously scroll');
  assert.match(source, /cycles=grid\.scrollable\?Array\.from\(\{length:Math\.ceil\(areaH\/grid\.cycleHeight\)\+2\}/, 'main strip should draw enough repeated cycles to avoid blank gaps');
  assert.match(source, /cycles=grid\.scrollable\?Array\.from\(\{length:Math\.ceil\(listH\/grid\.cycleHeight\)\+2\}/, 'side strip should draw enough repeated cycles to avoid blank gaps');
  assert.match(source, /centeredText\(ctx,'خرید ما'/, 'cards should label the buy quote');
  assert.match(source, /centeredText\(ctx,'فروش ما'/, 'cards should label the sell quote');
  assert.match(source, /card\.showTwoPrices===false/, 'single-price mode should be configured independently on each rate card');
  assert.doesNotMatch(source, /hasSpread|!hasSpread/, 'enabled two-price mode should not be hidden when spreads are zero');
  assert.match(source, /drawCardQuotes\(rate,row,/, 'main cards should render using their own quote settings');
  assert.match(source, /drawCardQuotes\(rate,item,/, 'side cards should render using their own quote settings');
  assert.match(fs.readFileSync(path.join(publicDir, 'board-config.js'), 'utf8'), /data-row-field="buySpreadPercent"[\s\S]*data-row-field="sellSpreadPercent"/, 'main card editor should expose independent buy and sell spreads');
  assert.match(fs.readFileSync(path.join(publicDir, 'board-config.js'), 'utf8'), /data-side-field="buySpreadPercent"[\s\S]*data-side-field="sellSpreadPercent"/, 'side card editor should expose independent buy and sell spreads');
  const quotes = sandbox.quotePrices({ price: 1000 }, { buySpreadPercent: 2, sellSpreadPercent: 3 });
  assert.equal(quotes.buy, '۹۸۰', 'buy quote should apply the configured discount');
  assert.equal(quotes.sell, '۱,۰۳۰', 'sell quote should use a comma for thousands');
  assert.equal(sandbox.faNum(1234.56), '۱,۲۳۴.۵۶', 'number formatting should use comma thousands and dot decimals with Persian digits');
  const independentQuotes = sandbox.quotePrices({ price: 1000 }, { buySpreadPercent: 5, sellSpreadPercent: 1 });
  assert.equal(independentQuotes.buy, '۹۵۰', 'each card should calculate its configured buy spread independently');
  assert.equal(independentQuotes.sell, '۱,۰۱۰', 'each card should calculate its configured sell spread independently');
  const boardHtml = fs.readFileSync(path.join(publicDir, 'board.html'), 'utf8');
  assert.match(boardHtml, /id="farzinLogout"/, 'board should provide secure logout inside its controls');
  assert.match(boardHtml, /\.board-controls\.hidden\{opacity:0;pointer-events:none\}/, 'board controls including logout should auto-hide');
  assert.match(fs.readFileSync(path.join(publicDir, 'board.js'), 'utf8'), /document\.addEventListener\('mousemove',revealBoardControls\)/, 'pointer movement should reveal the board controls');
  let drawn = null;
  const ctx = {
    save() {}, restore() {}, font: '', textAlign: '', textBaseline: '', direction: '', fillStyle: '',
    measureText(value) { const size = Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 10; return { width: String(value).length * size * 0.6 }; },
    fillText(value, x, y) { drawn = { value, x, y, align: this.textAlign, baseline: this.textBaseline }; }
  };
  sandbox.centeredText(ctx, 'price', 300, 200, 24, '#fff');
  assert.deepEqual(drawn, { value: 'price', x: 300, y: 200, align: 'center', baseline: 'middle' }, 'centered card text should use horizontal and vertical canvas centering');
}

function testNumberSeparators() {
  const storySource = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
  const declaration = storySource.match(/function faNumber\([\s\S]*?\n\}/)?.[0];
  assert.ok(declaration, 'story should provide its numeric formatter');
  const sandbox = { Intl, Number, String };
  vm.runInNewContext(`${declaration}; this.faNumber = faNumber;`, sandbox);
  assert.equal(sandbox.faNumber(1234.56), '۱,۲۳۴.۵۶', 'story numbers should use comma thousands and dot decimals');
}

function testStoryCardQuotes() {
  const source = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
  const formatter = source.match(/function faNumber\([\s\S]*?\n\}/)?.[0];
  const quoteCalculator = source.match(/function storyQuotePrices\([\s\S]*?\n\}/)?.[0];
  assert.ok(formatter && quoteCalculator, 'story should provide a quote calculator and number formatter');
  const sandbox = { Intl, Number, String, Math };
  vm.runInNewContext(`${formatter}\n${quoteCalculator}; this.storyQuotePrices = storyQuotePrices;`, sandbox);
  const quotes = sandbox.storyQuotePrices(1000, { buySpreadPercent:2, sellSpreadPercent:3 });
  assert.equal(quotes.buy, '۹۸۰', 'story buy quote should apply its configured discount');
  assert.equal(quotes.sell, '۱,۰۳۰', 'story sell quote should apply its configured premium');
  const independent = sandbox.storyQuotePrices(1000, { buySpreadPercent:5, sellSpreadPercent:1 });
  assert.equal(independent.buy, '۹۵۰', 'story cards should calculate buy spreads independently');
  assert.equal(independent.sell, '۱,۰۱۰', 'story cards should calculate sell spreads independently');
  assert.deepEqual({ ...sandbox.storyQuotePrices('', { buySpreadPercent:5, sellSpreadPercent:5 }) }, { buy:'-', sell:'-' }, 'missing story prices should render as a dash, not zero');
  assert.match(source, /data-row-field="showTwoPrices"[\s\S]*data-row-field="buySpreadPercent"[\s\S]*data-row-field="sellSpreadPercent"/, 'story row editor should expose buy/sell visibility and independent spreads');
  assert.match(source, /row\.showTwoPrices===false/, 'story renderer should preserve single-price cards');
  assert.doesNotMatch(source, /hasConfiguredSpread|!hasConfiguredSpread/, 'enabled story two-price mode should not depend on non-zero spreads');
  assert.match(source, /drawFitText\(ctx,'خرید ما'/, 'story cards should label buy quotes');
  assert.match(source, /drawFitText\(ctx,'فروش ما'/, 'story cards should label sell quotes');
  assert.match(source, /function drawStoryPrice\(/, 'story prices should render their unit separately from the numeric value');
  assert.match(source, /unitWidth \+ gap <= maxWidth/, 'story price unit and number should be measured together to prevent overlap');
  assert.match(source, /data\.value===''\?'-':formatValue\(data\.value\)/, 'missing market prices should render as a dash');
}

function testStoryLongTextFit() {
  const source = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
  assert.match(source, /const drawRateCard=\(row,x,y,w,h\)=>/, 'story rates should use a shared redesigned rate-card renderer');
  assert.match(source, /const x0=70,areaW=940,gapX=14,gapY=10,cols=rows\.length>1\?2:1/, 'story main rates should use a readable two-column layout');
  assert.match(source, /const cardH=Math\.max\(58,Math\.min\(112,Math\.floor\(\(430-gapY\*\(rowCount-1\)\)\/rowCount\)\)\)/, 'story rate-card height should fit the available space and stay readable');
  assert.match(source, /valueSize=Math\.min\(44,h\*\.32,w\*\.095\)/, 'story quote values should use large type within card bounds');
  assert.match(source, /const chartY=Math\.max\(cursorY,1120\),chartH=210/, 'story chart should follow rate cards without overlapping contacts');
  assert.match(source, /const headerY=settings\.showLogo\?246:196,headerCellW=455,headerCellH=58/, 'story header should use a roomy grid below the separate logo and brand area');
  assert.match(source, /headerCards\.push\(\{primary:`ساعت تهران \$\{tehranClock\(\)\}`/, 'story clock should render inside a header card');
  assert.match(source, /primary:globalUpdatedAt\?`آخرین نرخ/, 'story update time should render inside a header card');
  assert.match(source, /const col=i%2,row=Math\.floor\(i\/2\)/, 'story header cards should use a two-column grid');
  assert.doesNotMatch(source, /gregorianDate|میلادی \$\{/, 'story output should omit Gregorian dates');
  assert.match(source, /drawStoryPrice\(ctx,value,unit,/, 'story single-price cards should place the unit beside the value');
  assert.match(source, /mid=cy\+ch\/2/, 'story info cards should center their content vertically');
  assert.match(source, /brandW\+gap\+size,left=\(width-groupW\)\/2/, 'story header brand and logo group should be centered with equal frame margins');
  assert.match(source, /valueY=y\+h\*\.84/, 'story buy and sell values should remain within compact market cards');
  assert.match(source, /availableH=Math\.max\(0,1585-y\)/, 'story contact cards should be restricted to the reserved contact area');
  assert.match(source, /const footerStart=Math\.max\(1620,contentBottom\+32\)/, 'story footer should remain below contacts rather than moving over them');
  const declaration = source.match(/function drawFitText\([\s\S]*?\n\}/)?.[0];
  assert.ok(declaration, 'story should provide a measured text fitting helper');
  const sandbox = {};
  vm.runInNewContext(`${declaration}; this.drawFitText = drawFitText;`, sandbox);
  let drawn = null;
  const ctx = {
    font:'', measureText(value) { const size = Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 10; return { width:String(value).length * size * 0.6 }; },
    fillText(value, x, y, maxWidth) { drawn = { value:String(value), width:this.measureText(value).width, maxWidth, font:this.font }; }
  };
  sandbox.drawFitText(ctx, '123456789012345678901234', 0, 0, 28, '#fff', 'center', 700, 180, 11);
  assert.ok(drawn, 'story should draw long numbers');
  assert.ok(drawn.width <= drawn.maxWidth, 'story long numbers should be measured to fit card bounds');
  assert.ok(Number(drawn.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) >= 11, 'story should preserve the configured minimum font size');
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
    env: { ...process.env, PORT:String(port), HOST:'127.0.0.1', FARZIN_DATA_DIR:tempData, ADMIN_USER:'admin', ADMIN_PASSWORD:'test-password-with-adequate-length' },
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
    assert.equal((await fetch(`${base}/`,{redirect:'manual'})).status,303,'Admin home must redirect to the login page');
    assert.equal((await fetch(`${base}/board-config`,{redirect:'manual'})).status,303,'Board configuration must be protected');
    assert.equal((await fetch(`${base}/api/config`)).status,401,'Private settings API must be protected');
    assert.equal((await fetch(`${base}/board`,{redirect:'manual'})).status,303,'Board must require login like other pages');
    assert.equal((await fetch(`${base}/api/public-config`)).status,401,'Display configuration API must require login');
    assert.equal((await fetch(`${base}/login.css`)).status,200,'Login assets should be public');
    assert.equal((await fetch(`${base}/login.js`)).status,200,'Login logic should be public');
    assert.equal((await fetch(`${base}/boot.css`)).status,200,'Shared loading styles should be public');
    assert.equal((await fetch(`${base}/boot.js`)).status,200,'Shared loading logic should be public');
    const loginPage = await (await fetch(`${base}/login`)).text();
    assert.ok(loginPage.includes('id="loginForm"') && loginPage.includes('/boot.css'), 'Login page should include login UI and shared boot assets');
    const forbidden = await fetch(`${base}/403`);
    assert.equal(forbidden.status,403,'Custom forbidden page should return HTTP 403');
    assert.match(await forbidden.text(),/دسترسی مجاز نیست/);
    assert.equal((await fetch(`${base}/api/health`)).status,200,'Deployment health check should remain public');
    assert.equal((await fetch(`${base}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'wrong-password'})})).status,401,'Incorrect credentials should be rejected');
    const login = await fetch(`${base}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'test-password-with-adequate-length'})});
    assert.equal(login.status,200,'Valid credentials should log in');
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const auth = { headers: { Cookie: cookie } };
    const editorPage = await (await fetch(`${base}/`,auth)).text();
    assert.match(editorPage,/id="farzinBoot"/,'Authenticated application pages should include the shared loading overlay');
    assert.match(editorPage,/id="farzinLogout"/,'Authenticated application pages should expose logout');
    assert.equal((await fetch(`${base}/`,auth)).status,200,'Admin can open the editor with a session');
    assert.equal((await (await fetch(`${base}/api/session`,auth)).json()).authenticated,true,'Session endpoint should confirm authentication');
    assert.equal((await fetch(`${base}/board`,auth)).status,200,'Admin can open the board');
    assert.equal((await fetch(`${base}/api/config`,auth)).status,200,'Admin can read private config');
    assert.equal((await fetch(`${base}/api/config`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({settings:{schemaVersion:5}})})).status,200,'Admin can save settings');
    assert.equal((await fetch(`${base}/api/logout`,{method:'POST',headers:{Cookie:cookie}})).status,200,'Logout should revoke the session');
    assert.equal((await fetch(`${base}/api/config`,auth)).status,401,'Revoked session must no longer authorize requests');
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
    ADMIN_USER: 'admin',
    ADMIN_PASSWORD: 'test-password-with-adequate-length',
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
    assert.equal((await fetch(`${base}/`, { redirect: 'manual' })).status, 303, 'Story studio must redirect unauthenticated users to login');
    assert.equal((await fetch(`${base}/board`, { redirect: 'manual' })).status, 303, 'Board must require login');
    assert.equal((await fetch(`${base}/api/config`)).status, 401, 'Private settings API must require login');
    const loginResponse = await fetch(`${base}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test-password-with-adequate-length' })
    });
    assert.equal(loginResponse.status, 200, 'Correct credentials should establish a session');
    const cookie = loginResponse.headers.get('set-cookie').split(';')[0];
    assert.match(loginResponse.headers.get('set-cookie'), /HttpOnly/);
    assert.match(loginResponse.headers.get('set-cookie'), /SameSite=Strict/);
    const authFetch = (url, options = {}) => fetch(url, { ...options, headers: { ...(options.headers || {}), Cookie: cookie } });
    for (const route of ['/', '/board', '/board-config', '/tgju-widget', '/board.js', '/board-config.js', '/tgju-widget.js', '/asset-catalog.js', '/asset-icons.js', '/farzin-logo.png']) {
      const response = await authFetch(`${base}${route}`, { signal: AbortSignal.timeout(3000) });
      assert.equal(response.status, 200, `${route} should return HTTP 200`);
    }
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.host, '0.0.0.0', 'Server should bind to all LAN interfaces');
    assert.equal(health.source, 'TGJU');
    const publicConfigResponse = await authFetch(`${base}/api/public-config`);
    assert.equal(publicConfigResponse.status, 200);
    const liveAssetsResponse = await authFetch(`${base}/api/assets`);
    assert.equal(liveAssetsResponse.status, 200);
    const config = await (await authFetch(`${base}/api/config`)).json();
    assert.ok(config && typeof config === 'object');
    assert.equal(config.source, 'TGJU');
    assert.equal(config.sourceRequiresKey, false);

    let market = null;
    for (let i = 0; i < 30; i++) {
      const response = await authFetch(`${base}/api/dashboard-data`, { signal: AbortSignal.timeout(1200) });
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
    await authFetch(`${base}/api/dashboard-data`, { signal: AbortSignal.timeout(1500) });
    assert.ok(Date.now() - startedAt < 1200, 'Dashboard API should return from local cache quickly');
    const refresh = await authFetch(`${base}/api/refresh`, { method: 'POST', signal: AbortSignal.timeout(1500) });
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
  await testBoardBootWithoutStructuredClone();
  testBoardLongTextFit();
testBoardCardLayout();
  testNumberSeparators();
  testStoryCardQuotes();
  testStoryLongTextFit();
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
  assert.ok(logo.readUInt32BE(16) > 0 && logo.readUInt32BE(20) > 0, 'Logo should have valid PNG dimensions');
  console.log(`Smoke test passed: ${jsFiles.length} JavaScript files, story layout, expanded TGJU asset catalogue and per-asset icons, deployment templates, TGJU widget safety checks, legacy-browser board boot fallback, mock live TGJU feed, all-symbol mapping, IRR/Toman conversions, fast dashboard responses, LAN bind, refresh and valid PNG logo.`);
})().catch(error => {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
});
