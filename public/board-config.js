'use strict';
const $ = id => document.getElementById(id);
const DEFAULT_FEED = 'https://feeds.bbci.co.uk/persian/rss.xml';
const LEGACY_DEFAULT_FEED = 'https://news.google.com/rss/search?q=%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF+%D8%A7%DB%8C%D8%B1%D8%A7%D9%86+OR+%D8%B7%D9%84%D8%A7+OR+%D8%A7%D8%B1%D8%B2+OR+%D9%86%D9%81%D8%AA&hl=fa&gl=IR&ceid=IR:fa';
const SOURCE_OPTIONS = [
  ['gram18','طلای ۱۸ عیار · TGJU'],['gram21','طلای ۲۱ عیار · محاسبه از TGJU'],['gram24','طلای ۲۴ عیار · TGJU'],
  ['mazaneh','مظنه · TGJU'],['coin_full','سکه امامی · TGJU'],['coin_old','سکه قدیم / بهار آزادی · TGJU'],
  ['coin_half','نیم سکه · TGJU'],['coin_quarter','ربع سکه · TGJU'],['coin_gerami','سکه گرمی · TGJU'],
  ['ounce','انس جهانی · TGJU'],['usd','دلار · TGJU'],['aed','درهم · TGJU'],['eur','یورو · TGJU'],['silver','نقره ۹۹۹ · TGJU'],['oil','نفت برنت · TGJU'],
  ...(window.FARZIN_ASSET_CATALOG?.items||[]).map(item=>[item.symbol,`${item.label} · ${item.categoryLabel}`]),
  ['custom','نماد سفارشی TGJU'],['manual','ورود دستی']
];
let LIVE_ASSET_OPTIONS = [];
const DEFAULT_ROWS = [
  {id:'mazaneh-main',label:'مظنه',source:'mazaneh',unit:'تومان',manualValue:'',visible:true,featured:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'gram18-main',label:'گرم طلای ۱۸ عیار',source:'gram18',unit:'تومان',manualValue:'',visible:true,featured:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'emami86-main',label:'سکه امامی ۸۶',source:'coin_full',unit:'تومان',manualValue:'',visible:true,featured:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'oldcoin-main',label:'سکه قدیم',source:'coin_old',unit:'تومان',manualValue:'',visible:true,featured:false,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'half86-main',label:'نیم سکه ۸۶',source:'coin_half',unit:'تومان',manualValue:'',visible:true,featured:false,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'quarter86-main',label:'ربع سکه ۸۶',source:'coin_quarter',unit:'تومان',manualValue:'',visible:true,featured:false,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'gramcoin-main',label:'سکه یک گرمی',source:'coin_gerami',unit:'تومان',manualValue:'',visible:true,featured:false,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'gram24-main',label:'طلای ۲۴ عیار',source:'gram24',unit:'تومان',manualValue:'',visible:true,featured:false,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'gram21-main',label:'طلای ۲۱ عیار',source:'gram21',unit:'تومان',manualValue:'',visible:true,featured:false,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'ounce-main',label:'انس طلا',source:'ounce',unit:'دلار',manualValue:'',visible:true,featured:false,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0}
];
const DEFAULT_SIDE = [
  {id:'usd-side',label:'دلار',source:'usd',unit:'تومان',manualValue:'',visible:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'aed-side',label:'درهم',source:'aed',unit:'تومان',manualValue:'',visible:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'eur-side',label:'یورو',source:'eur',unit:'تومان',manualValue:'',visible:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'silver-side',label:'نقره ۹۹۹',source:'silver',unit:'تومان / گرم',manualValue:'',visible:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0},
  {id:'oil-side',label:'نفت برنت',source:'oil',unit:'دلار / بشکه',manualValue:'',visible:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0}
];
const BOARD_DEFAULTS = {
  refreshSeconds:30, showMainRates:true, showSideRates:true, showMarketStatus:true, showClock:true,
  showJalaliDate:true, showGregorianDate:true, showGoldChart:true, showContacts:true, showFooter:true,
  showNewsTicker:true, tickerLabel:'تازه‌ترین اخبار جهان', newsFeedUrl:DEFAULT_FEED, newsRefreshSeconds:180,
  tickerSpeed:65, tickerFontSize:17, chartRange:'1d', mainColumns:2, sidePanelPercent:27, mainCardGap:18, mainFontScale:1.1, sideFontScale:1.1, cardScrollSpeed:32, tgjuWidgetCode:'', footerLines:[{id:'board-footer-quote',text:'زر، جلوه‌ای از زیبایی‌ست؛ اعتماد، ماندگارترین دارایی‌ست.',visible:true}]
};
const STORY_DEFAULTS = {showMainRates:true,showSideRates:true,showMarketStatus:true,showGoldChart:true,showBothDates:true,showContacts:true,showFooter:true};
const GLOBAL_DEFAULTS = {brand:'گالری طلا و سکه فرزین',subtitle:'نرخ لحظه‌ای بازار طلا و سکه',mainTitle:'نرخ لحظه‌ای طلا و سکه',sideTitle:'ارز و بازارهای جهانی',chartTitle:'نمودار تغییرات طلای ۱۸ عیار',bgColor:'#0b0b0a',goldColor:'#c8a85c',textColor:'#f5f0e5',mutedColor:'#bcb19b',watermarkOpacity:8,showLogo:true,showFrame:true};
const DEFAULT_CONTACTS = [{id:'contact-phone',title:'تلفن',value:'',visible:true},{id:'contact-whatsapp',title:'واتساپ',value:'',visible:true},{id:'contact-address',title:'آدرس',value:'',visible:true}];
const DEFAULT_FOOTERS = [{id:'footer-main',text:'نرخ‌ها ممکن است در طول روز تغییر کنند',visible:true}];
let settings = null;
let toastTimer;
function id(prefix){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function baseSettings(raw){
  const s = raw && typeof raw==='object' ? raw : {};
  for(const [key,value] of Object.entries(GLOBAL_DEFAULTS)) if(s[key]===undefined) s[key]=value;
  if(!Array.isArray(s.contactCards)) s.contactCards=structuredClone(DEFAULT_CONTACTS);
  if(!Array.isArray(s.footerLines)) s.footerLines=structuredClone(DEFAULT_FOOTERS);
  s.contactCards=s.contactCards.map((item,i)=>({id:item.id||id('contact'),title:item.title||`اطلاعات ${i+1}`,value:item.value||'',visible:item.visible!==false}));
  s.footerLines=s.footerLines.map((item,i)=>({id:item.id||id('footer'),text:item.text||'',visible:item.visible!==false}));
  if(!Array.isArray(s.sections) || !s.sections.length){s.sections=[{id:'main-prices',title:'نرخ طلا و سکه',visible:true,rows:structuredClone(DEFAULT_ROWS)}];}
  if(!s.schemaVersion || Number(s.schemaVersion)<4){
    const oldRows=s.sections.flatMap(sec=>sec.rows||[]);
    const oldBySource=new Map(oldRows.map(row=>[row.source,row]));
    const rows=structuredClone(DEFAULT_ROWS).map(row=>{
      const old=oldBySource.get(row.source);
      return old ? {...row,manualValue:old.manualValue||'',visible:old.visible!==false,featured:old.featured??row.featured} : row;
    });
    s.sections=[{id:'main-prices',title:'نرخ طلا و سکه',visible:true,rows}];
    s.schemaVersion=4;
  }
  s.sideRates=Array.isArray(s.sideRates)?s.sideRates:structuredClone(DEFAULT_SIDE);
  s.boardConfig={...structuredClone(BOARD_DEFAULTS),...(s.boardConfig||{})};
  for(const row of [...s.sections.flatMap(section=>section.rows||[]),...s.sideRates]){
    row.showTwoPrices=row.showTwoPrices??s.boardConfig.showTwoPrices;
    row.buySpreadPercent=row.buySpreadPercent??s.boardConfig.buySpreadPercent;
    row.sellSpreadPercent=row.sellSpreadPercent??s.boardConfig.sellSpreadPercent;
  }
  delete s.boardConfig.showTwoPrices;delete s.boardConfig.buySpreadPercent;delete s.boardConfig.sellSpreadPercent;
  if(!Array.isArray(s.boardConfig.footerLines))s.boardConfig.footerLines=structuredClone(BOARD_DEFAULTS.footerLines);
  if(s.boardConfig.newsFeedUrl===LEGACY_DEFAULT_FEED)s.boardConfig.newsFeedUrl=DEFAULT_FEED;
  s.storyConfig={...structuredClone(STORY_DEFAULTS),...(s.storyConfig||{})};
  return s;
}
function allMainRows(){return settings.sections.flatMap((section,sectionIndex)=>(section.rows||[]).map((row,rowIndex)=>({sectionIndex,rowIndex,row})));}
function sourceSelect(value){const options=[...SOURCE_OPTIONS,...LIVE_ASSET_OPTIONS.filter(([v])=>!SOURCE_OPTIONS.some(([k])=>k===v))];return `<select data-row-field="source">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select>`;}
function iconSelect(value,scope='row'){const field=scope==='side'?'data-side-field':'data-row-field';const icons=window.FARZIN_ASSET_CATALOG?.iconTypes||['auto','gold','coin','silver','currency','crypto','oil','metal','commodity','forex','stock','fund','bond','generic'];return `<select ${field}="icon">${icons.map(icon=>`<option value="${icon}" ${icon===value?'selected':''}>آیکون ${icon}</option>`).join('')}</select>`;}
function assetDefaults(source){return (window.FARZIN_ASSET_CATALOG?.items||[]).find(item=>item.symbol===source)||null;}
function renderMainRows(){
  const host=$('mainRatesEditor');
  host.innerHTML=allMainRows().map(({sectionIndex,rowIndex,row},index)=>`
    <div class="config-item asset-config-item" data-row-id="${esc(row.id)}" data-section-index="${sectionIndex}" data-row-index="${rowIndex}">
      <input class="row-input" data-row-field="label" value="${esc(row.label)}" placeholder="نام ردیف" aria-label="نام قیمت">
      ${sourceSelect(row.source)}
      <input class="row-input" data-row-field="unit" value="${esc(row.unit)}" placeholder="واحد">
      <input class="row-input" data-row-field="symbol" value="${esc(row.symbol||'')}" placeholder="شناسه نماد سفارشی TGJU">
      <input class="row-input" type="number" min="0.000001" step="any" data-row-field="divisor" value="${esc(row.divisor||1)}" placeholder="تقسیم بر">
      ${iconSelect(row.icon||'')}
       <div class="row-actions"><label class="mini-check"><input type="checkbox" data-row-field="visible" ${row.visible!==false?'checked':''}> نمایش</label><label class="mini-check"><input type="checkbox" data-row-field="featured" ${row.featured?'checked':''}> ویژه</label><button class="icon-btn" data-move="up" title="بالا">↑</button><button class="icon-btn" data-move="down" title="پایین">↓</button><button class="icon-btn danger" data-delete title="حذف">×</button></div>
       <input class="row-input" style="grid-column:1/-1" data-row-field="manualValue" value="${esc(row.manualValue||'')}" placeholder="مقدار دستی؛ فقط وقتی منبع ورود دستی است">
       <div class="card-quote-settings"><label class="mini-check"><input type="checkbox" data-row-field="showTwoPrices" ${row.showTwoPrices!==false?'checked':''}> نمایش خرید و فروش</label><label class="field"><span>حاشیه خرید (%)</span><input type="number" min="0" max="20" step="0.05" data-row-field="buySpreadPercent" value="${esc(row.buySpreadPercent??0)}"></label><label class="field"><span>حاشیه فروش (%)</span><input type="number" min="0" max="20" step="0.05" data-row-field="sellSpreadPercent" value="${esc(row.sellSpreadPercent??0)}"></label></div>
    </div>`).join('') || '<p class="empty-custom-list">هنوز ردیفی اضافه نشده است.</p>';
  host.querySelectorAll('.config-item').forEach(el=>{
    const sIndex=Number(el.dataset.sectionIndex), rIndex=Number(el.dataset.rowIndex);
    el.querySelectorAll('[data-row-field]').forEach(input=>input.addEventListener(input.type==='checkbox'||input.tagName==='SELECT'?'change':'input',()=>{
      const row=settings.sections[sIndex]?.rows?.[rIndex];if(!row)return;
      row[input.dataset.rowField]=input.type==='checkbox'?input.checked:(input.type==='number'?Number(input.value):input.value);if(input.dataset.rowField==='source'){const asset=assetDefaults(input.value);if(asset){row.symbol='';row.unit=asset.unit;row.divisor=asset.divisor;row.icon=asset.icon;}else if(input.value!=='custom')row.symbol='';renderMainRows();}
    }));
    el.querySelector('[data-move="up"]')?.addEventListener('click',()=>moveMain(sIndex,rIndex,-1));
    el.querySelector('[data-move="down"]')?.addEventListener('click',()=>moveMain(sIndex,rIndex,1));
    el.querySelector('[data-delete]')?.addEventListener('click',()=>{settings.sections[sIndex].rows.splice(rIndex,1);renderMainRows();});
  });
}
function moveMain(sIndex,rIndex,direction){const list=settings.sections[sIndex].rows,next=rIndex+direction;if(next<0||next>=list.length)return;[list[rIndex],list[next]]=[list[next],list[rIndex]];renderMainRows();}
function renderSideRows(){
  const opts=SOURCE_OPTIONS;
  const host=$('sideRatesEditor');
  host.innerHTML=settings.sideRates.map((item,index)=>`<div class="config-item asset-config-item" data-side-id="${esc(item.id)}">
    <input class="row-input" data-side-field="label" value="${esc(item.label)}" placeholder="نام دارایی">
    <select data-side-field="source">${[...opts,...LIVE_ASSET_OPTIONS.filter(([v])=>!opts.some(([k])=>k===v))].map(([v,l])=>`<option value="${esc(v)}" ${v===item.source?'selected':''}>${esc(l)}</option>`).join('')}</select>
    <input class="row-input" data-side-field="unit" value="${esc(item.unit||'')}" placeholder="واحد">
    <input class="row-input" data-side-field="symbol" value="${esc(item.symbol||'')}" placeholder="شناسه نماد سفارشی TGJU">
    <input class="row-input" type="number" min="0.000001" step="any" data-side-field="divisor" value="${esc(item.divisor||1)}" placeholder="تقسیم بر">
    ${iconSelect(item.icon||'','side')}
     <div class="row-actions"><label class="mini-check"><input type="checkbox" data-side-field="visible" ${item.visible!==false?'checked':''}> نمایش</label><button class="icon-btn" data-move="up" title="بالا">↑</button><button class="icon-btn" data-move="down" title="پایین">↓</button><button class="icon-btn danger" data-delete title="حذف">×</button></div>
     <input class="row-input" style="grid-column:1/-1" data-side-field="manualValue" value="${esc(item.manualValue||'')}" placeholder="مقدار دستی، در صورت انتخاب ورود دستی">
     <div class="card-quote-settings"><label class="mini-check"><input type="checkbox" data-side-field="showTwoPrices" ${item.showTwoPrices!==false?'checked':''}> نمایش خرید و فروش</label><label class="field"><span>حاشیه خرید (%)</span><input type="number" min="0" max="20" step="0.05" data-side-field="buySpreadPercent" value="${esc(item.buySpreadPercent??0)}"></label><label class="field"><span>حاشیه فروش (%)</span><input type="number" min="0" max="20" step="0.05" data-side-field="sellSpreadPercent" value="${esc(item.sellSpreadPercent??0)}"></label></div>
  </div>`).join('')||'<p class="empty-custom-list">دارایی جانبی تعریف نشده است.</p>';
  host.querySelectorAll('.config-item').forEach(el=>{
    const item=settings.sideRates.find(x=>x.id===el.dataset.sideId);if(!item)return;
    el.querySelectorAll('[data-side-field]').forEach(input=>input.addEventListener(input.type==='checkbox'||input.tagName==='SELECT'?'change':'input',()=>{item[input.dataset.sideField]=input.type==='checkbox'?input.checked:(input.type==='number'?Number(input.value):input.value);if(input.dataset.sideField==='source'){const asset=assetDefaults(input.value);if(asset){item.symbol='';item.unit=asset.unit;item.divisor=asset.divisor;item.icon=asset.icon;}else if(input.value!=='custom')item.symbol='';renderSideRows();}}));
    el.querySelector('[data-move="up"]')?.addEventListener('click',()=>moveSide(item.id,-1));
    el.querySelector('[data-move="down"]')?.addEventListener('click',()=>moveSide(item.id,1));
    el.querySelector('[data-delete]')?.addEventListener('click',()=>{settings.sideRates=settings.sideRates.filter(x=>x.id!==item.id);renderSideRows();});
  });
}
function moveSide(itemId,direction){const i=settings.sideRates.findIndex(x=>x.id===itemId),n=i+direction;if(i<0||n<0||n>=settings.sideRates.length)return;[settings.sideRates[i],settings.sideRates[n]]=[settings.sideRates[n],settings.sideRates[i]];renderSideRows();}
function renderContactsAndFooters(){
  const contacts=$('boardContactsEditor'),footers=$('boardFootersEditor');
  contacts.innerHTML=settings.contactCards.map((item,index)=>`<div class="config-item custom-config-item" data-contact-id="${esc(item.id)}">
    <input class="row-input" data-contact-field="title" value="${esc(item.title)}" placeholder="عنوان کادر">
    <input class="row-input" data-contact-field="value" value="${esc(item.value)}" placeholder="متن، شماره یا آدرس">
    <div class="row-actions"><label class="mini-check"><input type="checkbox" data-contact-field="visible" ${item.visible!==false?'checked':''}> نمایش</label><button class="icon-btn" data-move="up" title="بالا">↑</button><button class="icon-btn" data-move="down" title="پایین">↓</button><button class="icon-btn danger" data-delete title="حذف">×</button></div>
  </div>`).join('')||'<p class="empty-custom-list">هنوز کادری اضافه نشده است.</p>';
  footers.innerHTML=settings.boardConfig.footerLines.map(item=>`<div class="config-item footer-config-item" data-footer-id="${esc(item.id)}">
    <input class="row-input" style="grid-column:span 2" data-footer-field="text" value="${esc(item.text)}" placeholder="متن فوتر">
    <div class="row-actions"><label class="mini-check"><input type="checkbox" data-footer-field="visible" ${item.visible!==false?'checked':''}> نمایش</label><button class="icon-btn" data-move="up" title="بالا">↑</button><button class="icon-btn" data-move="down" title="پایین">↓</button><button class="icon-btn danger" data-delete title="حذف">×</button></div>
  </div>`).join('')||'<p class="empty-custom-list">هنوز متنی برای فوتر اضافه نشده است.</p>';
  contacts.querySelectorAll('.custom-config-item').forEach(el=>{
    const item=settings.contactCards.find(x=>x.id===el.dataset.contactId);if(!item)return;
    el.querySelectorAll('[data-contact-field]').forEach(input=>input.addEventListener(input.type==='checkbox'?'change':'input',()=>{item[input.dataset.contactField]=input.type==='checkbox'?input.checked:input.value;}));
    el.querySelector('[data-move="up"]')?.addEventListener('click',()=>moveCustom(settings.contactCards,item.id,-1,renderContactsAndFooters));
    el.querySelector('[data-move="down"]')?.addEventListener('click',()=>moveCustom(settings.contactCards,item.id,1,renderContactsAndFooters));
    el.querySelector('[data-delete]')?.addEventListener('click',()=>{settings.contactCards=settings.contactCards.filter(x=>x.id!==item.id);renderContactsAndFooters();});
  });
  footers.querySelectorAll('.footer-config-item').forEach(el=>{
    const item=settings.boardConfig.footerLines.find(x=>x.id===el.dataset.footerId);if(!item)return;
    el.querySelectorAll('[data-footer-field]').forEach(input=>input.addEventListener(input.type==='checkbox'?'change':'input',()=>{item[input.dataset.footerField]=input.type==='checkbox'?input.checked:input.value;}));
    el.querySelector('[data-move="up"]')?.addEventListener('click',()=>moveCustom(settings.boardConfig.footerLines,item.id,-1,renderContactsAndFooters));
    el.querySelector('[data-move="down"]')?.addEventListener('click',()=>moveCustom(settings.boardConfig.footerLines,item.id,1,renderContactsAndFooters));
    el.querySelector('[data-delete]')?.addEventListener('click',()=>{settings.boardConfig.footerLines=settings.boardConfig.footerLines.filter(x=>x.id!==item.id);renderContactsAndFooters();});
  });
}
function moveCustom(list,itemId,direction,rerender){const i=list.findIndex(x=>x.id===itemId),n=i+direction;if(i<0||n<0||n>=list.length)return;[list[i],list[n]]=[list[n],list[i]];rerender();}
function loadControls(){
  document.querySelectorAll('[data-board]').forEach(el=>{const key=el.dataset.board;if(el.type==='checkbox')el.checked=Boolean(settings.boardConfig[key]);else el.value=settings.boardConfig[key]??'';});
  document.querySelectorAll('[data-story]').forEach(el=>{el.checked=Boolean(settings.storyConfig[el.dataset.story]);});
  document.querySelectorAll('[data-global]').forEach(el=>{const key=el.dataset.global;if(el.type==='checkbox')el.checked=Boolean(settings[key]);else el.value=settings[key]??'';});
  if($('talasanjState')) $('talasanjState').textContent='تمام نرخ‌ها مستقیماً از TGJU دریافت می‌شوند؛ نیازی به کلید نیست.';
  if($('arzhaamState')) $('arzhaamState').textContent='تمام نرخ‌ها مستقیماً از TGJU دریافت می‌شوند؛ نیازی به کلید نیست.';
  renderMainRows();renderSideRows();renderContactsAndFooters();
}
function collect(){
  document.querySelectorAll('[data-board]').forEach(el=>{settings.boardConfig[el.dataset.board]=el.type==='checkbox'?el.checked:(el.type==='number'?Number(el.value):el.value);});
  document.querySelectorAll('[data-story]').forEach(el=>{settings.storyConfig[el.dataset.story]=el.checked;});
  document.querySelectorAll('[data-global]').forEach(el=>{settings[el.dataset.global]=el.type==='checkbox'?el.checked:(el.type==='number'?Number(el.value):el.value);});
  settings.schemaVersion=6;
}
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500);}
async function loadLiveAssetOptions(){try{const response=await fetch('/api/assets',{cache:'no-store'});const data=await response.json();LIVE_ASSET_OPTIONS=(data.assets||[]).map(item=>[item.symbol,`${item.label||item.symbol} · فید زنده TGJU`]);if(settings){renderMainRows();renderSideRows();}}catch{LIVE_ASSET_OPTIONS=[];}}
async function load(){
  try{const response=await fetch('/api/config',{cache:'no-store'});const data=await response.json();settings=baseSettings(data.settings||{});await loadLiveAssetOptions();setTimeout(loadLiveAssetOptions,4500);window.apiKeyConfigured=Boolean(data.apiKeyConfigured);window.arzhaamKeyConfigured=Boolean(data.arzhaamKeyConfigured);loadControls();}
  catch(error){toast(`بارگذاری تنظیمات ناموفق بود: ${error.message}`);settings=baseSettings({});loadControls();}
}
async function save(){
  collect();const payload={settings};
  $('saveBoardConfig').disabled=true;$('saveBoardConfig').textContent='در حال ذخیره…';
  try{const response=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw new Error(data.error||'ذخیره تنظیمات انجام نشد.');
    window.apiKeyConfigured=false;window.arzhaamKeyConfigured=false;loadControls();$('configSaveMessage').textContent='تمام تنظیمات ذخیره شد.';toast('تنظیمات تابلو با موفقیت ذخیره شد.');
  }catch(error){$('configSaveMessage').textContent='ذخیره ناموفق';toast(error.message);}
  finally{$('saveBoardConfig').disabled=false;$('saveBoardConfig').textContent='ذخیره تمام تنظیمات';}
}
$('addMainRate').addEventListener('click',()=>{if(!settings.sections.length)settings.sections=[{id:'main-prices',title:'نرخ‌های اصلی',visible:true,rows:[]}];settings.sections[0].rows.push({id:id('rate'),label:'قیمت جدید',source:'manual',symbol:'',divisor:1,icon:'auto',unit:'تومان',manualValue:'',visible:true,featured:false,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0});renderMainRows();});
$('addSideRate').addEventListener('click',()=>{settings.sideRates.push({id:id('side'),label:'دارایی جدید',source:'manual',symbol:'',divisor:1,icon:'auto',unit:'',manualValue:'',visible:true,showTwoPrices:true,buySpreadPercent:0,sellSpreadPercent:0});renderSideRows();});
$('addBoardContact').addEventListener('click',()=>{settings.contactCards.push({id:id('contact'),title:'عنوان جدید',value:'متن دلخواه',visible:true});renderContactsAndFooters();});
$('addBoardFooter').addEventListener('click',()=>{settings.boardConfig.footerLines.push({id:id('board-footer'),text:'متن جدید فوتر تابلو',visible:true});renderContactsAndFooters();});
async function clearProviderKey(provider){if(!confirm('کلید ذخیره‌شده این سرویس حذف شود؟'))return;const payload={};payload[provider==='talasanj'?'clearApiKey':'clearArzhaamKey']=true;const response=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw new Error(data.error||'حذف کلید ناموفق بود.');window.apiKeyConfigured=Boolean(data.apiKeyConfigured);window.arzhaamKeyConfigured=Boolean(data.arzhaamKeyConfigured);loadControls();toast('کلید ذخیره‌شده حذف شد.');}

$('saveBoardConfig').addEventListener('click',save);

$('forceTgjuRefresh')?.addEventListener('click',async()=>{
  const button=$('forceTgjuRefresh');button.disabled=true;button.textContent='در حال دریافت از TGJU…';
  try{
    await fetch('/api/refresh',{method:'POST',cache:'no-store'});
    let result=null;
    for(let i=0;i<8;i++){
      await new Promise(resolve=>setTimeout(resolve,900));
      const response=await fetch('/api/dashboard-data',{cache:'no-store'});result=await response.json();
      if(result.hasPrices||result.status==='offline')break;
    }
    $('tgjuSourceStatus').textContent=result?.hasPrices?`داده دریافت شد · ${result.symbol_count||0} نماد · ${result.updated_at||'زمان منبع نامشخص'}`:(result?.last_error||'هنوز نرخ معتبری دریافت نشده است.');
    toast(result?.hasPrices?'دریافت نرخ TGJU انجام شد.':'دریافت نرخ ناموفق بود؛ وضعیت منبع را بررسی کن.');
  }catch(error){$('tgjuSourceStatus').textContent=error.message;toast(error.message);}
  finally{button.disabled=false;button.textContent='دریافت نرخ همین حالا';}
});
async function refreshTgjuSourceStatus(){
  try{const data=await (await fetch('/api/health',{cache:'no-store'})).json();const labels={connecting:'در حال دریافت اولین نرخ از TGJU…',online:'اتصال TGJU برقرار است',partial:'اتصال برقرار است؛ بعضی نمادها در پاسخ نیستند',stale:'منبع موقتاً قطع است؛ آخرین نرخ‌ها حفظ شده‌اند',offline:'اتصال به TGJU برقرار نشد'};$('tgjuSourceStatus').textContent=labels[data.tgjuStatus]||'وضعیت منبع نامشخص';}
  catch(error){$('tgjuSourceStatus').textContent='سرور محلی در دسترس نیست: '+error.message;}
}
refreshTgjuSourceStatus();setInterval(refreshTgjuSourceStatus,5000);

$('reloadBoardConfig').addEventListener('click',()=>load());
$('previewTgjuWidget')?.addEventListener('click',async()=>{const mount=$('tgjuWidgetPreview');try{await window.FarzinTGJUWidget?.mount(mount,$('tgjuWidgetCode').value);toast('پیش‌نمایش ویجت در پنل اجرا شد.');}catch(error){toast(error.message||'کد ویجت معتبر نیست.');}});
load();
