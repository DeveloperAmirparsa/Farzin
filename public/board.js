'use strict';
const canvas=document.getElementById('boardCanvas');
const ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const cloneConfig=value=>{if(typeof window.structuredClone==='function')return window.structuredClone(value);return JSON.parse(JSON.stringify(value));};
const DEFAULT_FEED='https://feeds.bbci.co.uk/persian/rss.xml';
const tehranClockFormatter=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const gregorianDateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
const jalaliDateFormatter=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
const jalaliWeekdayFormatter=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran',weekday:'long'});
const faNumberFormatter=new Intl.NumberFormat('fa-IR',{maximumFractionDigits:2});
const DEFAULTS={brand:'گالری طلا و سکه فرزین',subtitle:'نرخ لحظه‌ای بازار طلا و سکه',mainTitle:'نرخ لحظه‌ای طلا و سکه',sideTitle:'ارز و بازارهای جهانی',bgColor:'#0b0b0a',goldColor:'#c8a85c',textColor:'#f5f0e5',mutedColor:'#bcb19b',watermarkOpacity:8,showFrame:true,showLogo:true,showAttribution:true,contactCards:[],footerLines:[],sections:[],sideRates:[],boardConfig:{refreshSeconds:30,showMainRates:true,showSideRates:true,showMarketStatus:true,showClock:true,showJalaliDate:true,showGregorianDate:true,showFooter:true,showNewsTicker:true,tickerLabel:'تازه‌ترین اخبار جهان',newsFeedUrl:DEFAULT_FEED,newsRefreshSeconds:180,tickerSpeed:65,mainColumns:2,sidePanelPercent:27,mainCardGap:18,mainFontScale:1.1,sideFontScale:1.1,cardScrollSpeed:32,tgjuWidgetCode:'',footerLines:[{id:'board-footer-quote',text:'زر، جلوه‌ای از زیبایی‌ست؛ اعتماد، ماندگارترین دارایی‌ست.',visible:true}]}};
let settings=cloneConfig(DEFAULTS),livePrices={},sideRates={},assetPrices={},latestPayload=null,latestError='',newsItems=[],newsError='',logo=new Image(),logoReady=false,logoVersion=null,pollInProgress=false,lastNewsFetch=0,nextRefreshAt=Date.now()+30000,tickerOffset=0,tickerLastFrameAt=0,cardScrollOffset=0,sideScrollOffset=0,lastBoardFrameAt=0,canvasScale=1,controlHideTimer=null,refreshTimer=null,newsTimer=null,connectionState='connecting',lastSuccessAt=0,serverOffline=false,apiKeyConfigured=false,arzhaamKeyConfigured=false;
const DESIGN_WIDTH=1920,DESIGN_HEIGHT=1080;
function resizeCanvas(){
  const cssWidth=Math.max(1,Number(window.innerWidth)||document.documentElement?.clientWidth||1920);
  const cssHeight=Math.max(1,Number(window.innerHeight)||document.documentElement?.clientHeight||1080);
  const requestedDpr=Math.max(1,Math.min(2,Number(window.devicePixelRatio)||1));
  const pixelBudgetDpr=Math.sqrt(16777216/(cssWidth*cssHeight));
  const dpr=Math.max(.75,Math.min(requestedDpr,pixelBudgetDpr,4096/cssWidth,4096/cssHeight));
  const pixelWidth=Math.max(1,Math.round(cssWidth*dpr)),pixelHeight=Math.max(1,Math.round(cssHeight*dpr));
  if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
  if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
  const scaleX=pixelWidth/DESIGN_WIDTH,scaleY=pixelHeight/DESIGN_HEIGHT;
  canvasScale=Math.min(scaleX,scaleY);
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#050504';ctx.fillRect(0,0,pixelWidth,pixelHeight);
  ctx.setTransform(scaleX,0,0,scaleY,0,0);
  ctx.imageSmoothingEnabled=true;
  render();
}
window.addEventListener('resize',resizeCanvas);
function snapCanvasPixel(value){return Math.round(value*canvasScale)/canvasScale;}
function faNum(v){const n=Number(v);if(!Number.isFinite(n))return String(v??'—');return faNumberFormatter.formatToParts(n).map(part=>part.type==='group'?',':part.type==='decimal'?'.':part.value).join('');}
let cachedDateKey='',cachedDateInfo=null;
function dateInfo(){const now=new Date(),key=gregorianDateFormatter.format(now);if(key===cachedDateKey&&cachedDateInfo)return cachedDateInfo;const greg=key;try{const p=jalaliDateFormatter.formatToParts(now);const get=t=>p.find(x=>x.type===t)?.value||'00';const faPad=t=>new Intl.NumberFormat('fa-IR',{useGrouping:false,minimumIntegerDigits:t==='year'?4:2}).format(Number(get(t)));cachedDateInfo={jalali:`${faPad('year')}/${faPad('month')}/${faPad('day')}`,weekday:jalaliWeekdayFormatter.format(now),greg};}catch(error){cachedDateInfo={jalali:'—',weekday:jalaliWeekdayFormatter.format(now),greg};}cachedDateKey=key;return cachedDateInfo;}
let cachedClockSecond=-1,cachedClock='';
function tehranClock(){const second=Math.floor(Date.now()/1000);if(second!==cachedClockSecond){cachedClockSecond=second;cachedClock=tehranClockFormatter.format(new Date(second*1000));}return cachedClock;}
function sourceTime(v){if(v===null||v===undefined||v==='')return'زمان منبع نامشخص';const numeric=typeof v==='number'||/^\d{10,13}$/.test(String(v));const n=Number(v);const d=new Date(numeric?(n<1e12?n*1000:n):v);return Number.isNaN(d.getTime())?'زمان منبع نامشخص':new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);}
function text(c,value,x,y,size,color,align='center',weight=500,maxWidth=1500,minSize=10){const str=String(value??'');let px=Math.max(minSize,size);c.save();c.textAlign=align;c.textBaseline='alphabetic';c.direction='rtl';c.fillStyle=color;do{c.font=`${weight} ${px}px Vazirmatn,Tahoma,sans-serif`;if(c.measureText(str).width<=maxWidth||px<=minSize)break;px=Math.max(minSize,px-1);}while(true);c.fillText(str,x,y,maxWidth);c.restore();}
function centeredText(c,value,x,y,size,color,weight=700,maxWidth=400,minSize=11){const str=String(value??'');let px=Math.max(minSize,size);c.save();c.textAlign='center';c.textBaseline='middle';c.direction='rtl';c.fillStyle=color;do{c.font=`${weight} ${px}px Vazirmatn,Tahoma,sans-serif`;if(c.measureText(str).width<=maxWidth||px<=minSize)break;px=Math.max(minSize,px-1);}while(true);c.fillText(str,x,y,maxWidth);c.restore();}
function roundRect(c,x,y,w,h,r){
  // Quadratic curves avoid malformed/legacy arcTo calls on embedded TV canvases.
  const width=Math.max(0,Number(w)||0),height=Math.max(0,Number(h)||0);
  const radius=Math.max(0,Math.min(Number(r)||0,width/2,height/2));
  const right=x+width,bottom=y+height;
  c.beginPath();
  c.moveTo(x+radius,y);
  c.lineTo(right-radius,y);
  c.quadraticCurveTo(right,y,right,y+radius);
  c.lineTo(right,bottom-radius);
  c.quadraticCurveTo(right,bottom,right-radius,bottom);
  c.lineTo(x+radius,bottom);
  c.quadraticCurveTo(x,bottom,x,bottom-radius);
  c.lineTo(x,y+radius);
  c.quadraticCurveTo(x,y,x+radius,y);
  c.closePath();
}
function mixGold(hex,f){const h=String(hex||'#c8a85c').replace('#','');const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return`rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;}
function normalize(raw){const s={...cloneConfig(DEFAULTS),...(raw||{})};s.boardConfig={...cloneConfig(DEFAULTS.boardConfig),...(s.boardConfig||{})};if(!Array.isArray(s.boardConfig.footerLines))s.boardConfig.footerLines=cloneConfig(DEFAULTS.boardConfig.footerLines);if(!raw?.schemaVersion||Number(raw.schemaVersion)<4){s.sections=[{id:'main-prices',title:'نرخ طلا و سکه',visible:true,rows:[{id:'mazaneh-main',label:'مظنه',source:'mazaneh',unit:'تومان',visible:true,featured:true},{id:'gram18-main',label:'گرم طلای ۱۸ عیار',source:'gram18',unit:'تومان',visible:true,featured:true},{id:'emami86-main',label:'سکه امامی ۸۶',source:'coin_full',unit:'تومان',visible:true,featured:true},{id:'oldcoin-main',label:'سکه قدیم',source:'coin_old',unit:'تومان',visible:true},{id:'half86-main',label:'نیم سکه',source:'coin_half',unit:'تومان',visible:true},{id:'quarter86-main',label:'ربع سکه',source:'coin_quarter',unit:'تومان',visible:true},{id:'gramcoin-main',label:'سکه یک گرمی',source:'coin_gerami',unit:'تومان',visible:true},{id:'gram24-main',label:'طلای ۲۴ عیار',source:'gram24',unit:'تومان',visible:true},{id:'gram21-main',label:'طلای ۲۱ عیار',source:'gram21',unit:'تومان',visible:true},{id:'ounce-main',label:'انس طلا',source:'ounce',unit:'دلار',visible:true}]}];s.sideRates=[{id:'usd-side',label:'دلار',source:'usd',unit:'تومان',visible:true},{id:'aed-side',label:'درهم',source:'aed',unit:'تومان',visible:true},{id:'eur-side',label:'یورو',source:'eur',unit:'تومان',visible:true},{id:'silver-side',label:'نقره ۹۹۹',source:'silver',unit:'تومان / گرم',visible:true},{id:'oil-side',label:'نفت برنت',source:'oil',unit:'دلار / بشکه',visible:true}];}s.sections=Array.isArray(s.sections)?s.sections:[];s.sideRates=Array.isArray(s.sideRates)?s.sideRates:[];s.contactCards=Array.isArray(s.contactCards)?s.contactCards:[];s.footerLines=Array.isArray(s.footerLines)?s.footerLines:[];for(const card of [...s.sections.flatMap(section=>section.rows||[]),...s.sideRates]){card.showTwoPrices=card.showTwoPrices??s.boardConfig.showTwoPrices;card.buySpreadPercent=card.buySpreadPercent??s.boardConfig.buySpreadPercent;card.sellSpreadPercent=card.sellSpreadPercent??s.boardConfig.sellSpreadPercent;}return s;}
function mainRows(){return settings.sections.filter(s=>s.visible!==false).flatMap(s=>(s.rows||[]).filter(r=>r.visible!==false));}
function rateFor(rowOrSource,manualValue=''){const row=typeof rowOrSource==='object'&&rowOrSource?rowOrSource:{source:rowOrSource,manualValue};const source=String(row.source||'');if(source==='manual')return{price:row.manualValue||manualValue||'',change_pct:null,direction:null,updated_at:null,unit:''};const key=String(row.symbol||source);const item=['usd','aed','eur','silver','oil'].includes(source)?sideRates[source]:(livePrices[source]||assetPrices[key]);if(!item)return{price:'',change_pct:null,direction:null,updated_at:null,unit:''};const divisor=Math.max(0.0000001,Number(row.divisor)||1);return divisor===1?item:{...item,price:Number(item.price)/divisor,low:item.low===null?null:Number(item.low)/divisor,high:item.high===null?null:Number(item.high)/divisor};}
function drawAssetIcon(type,x,y,size=17){if(window.FarzinAssetIcons)window.FarzinAssetIcons.draw(ctx,type,x,y,size,settings.goldColor||'#c8a85c');}
function drawFadedAssetIcon(type,x,y,size,alpha=.1){ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.transform(.72,0,-.22,1,0,0);drawAssetIcon(type,0,0,size);ctx.restore();}
function assetIcon(item){return window.FarzinAssetIcons?window.FarzinAssetIcons.infer(item):'generic';}
function valueString(rate){if(rate?.price===undefined||rate?.price===null||rate?.price==='')return'در انتظار نرخ';const n=Number(rate.price);return Number.isFinite(n)?faNum(n):String(rate.price);}
function drawArrow(x,y,direction,size=8){const col=direction==='up'?'#4fca8a':direction==='down'?'#eb7770':'#9e988a';ctx.save();ctx.fillStyle=col;ctx.beginPath();if(direction==='up'){ctx.moveTo(x,y-size);ctx.lineTo(x-size,y+size*.55);ctx.lineTo(x+size,y+size*.55);}else if(direction==='down'){ctx.moveTo(x,y+size);ctx.lineTo(x-size,y-size*.55);ctx.lineTo(x+size,y-size*.55);}else{ctx.rect(x-size,y-2,size*2,4);}ctx.closePath();ctx.fill();ctx.restore();}
function drawBackground(){const bg=settings.bgColor||'#0b0b0a';ctx.fillStyle=bg;ctx.fillRect(0,0,1920,1080);ctx.fillStyle='#ffffff04';ctx.fillRect(55,205,1810,1);if(logoReady&&Number(settings.watermarkOpacity)>0){ctx.save();ctx.globalAlpha=Math.max(0,Math.min(.12,Number(settings.watermarkOpacity)/100));ctx.drawImage(logo,790,250,360,360);ctx.restore();}if(settings.showFrame!==false){ctx.save();ctx.strokeStyle='#ffffff18';ctx.lineWidth=1;ctx.strokeRect(.5,.5,1919,1079);ctx.restore();}}
function drawHeader(){
  const g=settings.goldColor||'#c8a85c',main=settings.textColor||'#f5f0e5',muted=settings.mutedColor||'#bcb19b',bc=settings.boardConfig||{};
  if(settings.showLogo!==false&&logoReady){ctx.save();ctx.shadowColor=`${g}55`;ctx.shadowBlur=18;ctx.drawImage(logo,915,42,90,90);ctx.restore();}
  text(ctx,settings.brand||'',960,155,33,g,'center',800,850,19);
  text(ctx,settings.subtitle||'',960,181,15,muted,'center',400,850,10);
  // Market status and Tehran clock now occupy separate, balanced header cards.
  if(bc.showMarketStatus!==false){
    const x=55,y=70,w=215,h=70,open=latestPayload?.market_open;
    const label=open===true?'بازار باز است':open===false?'بازار بسته است':'وضعیت بازار نامشخص';
    const col=open===true?'#69c68d':open===false?'#d98273':'#baa56c';
    ctx.save();ctx.fillStyle='#ffffff0a';ctx.strokeStyle=`${g}64`;roundRect(ctx,x,y,w,h,12);ctx.fill();ctx.stroke();
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(x+20,y+35,6,0,Math.PI*2);ctx.fill();ctx.restore();
    text(ctx,'وضعیت بازار',x+w-16,y+25,12,muted,'right',500,w-45,9);
    text(ctx,label,x+w/2,y+53,16,col,'center',700,w-24,11);
  }
  if(bc.showClock!==false){
    const x=284,y=70,w=220,h=70;
    ctx.save();ctx.fillStyle='#ffffff0a';ctx.strokeStyle=`${g}64`;roundRect(ctx,x,y,w,h,12);ctx.fill();ctx.stroke();ctx.restore();
    text(ctx,'ساعت زنده تهران',x+w-16,y+25,12,muted,'right',500,w-30,9);
    text(ctx,tehranClock(),x+w/2,y+55,26,main,'center',700,w-28,19);
  }
  const date=dateInfo();
  if(bc.showJalaliDate!==false){ctx.save();ctx.fillStyle='#ffffff09';ctx.strokeStyle=`${g}65`;roundRect(ctx,1515,55,100,44,11);ctx.fill();ctx.stroke();roundRect(ctx,1623,55,222,44,11);ctx.fill();ctx.stroke();ctx.restore();text(ctx,date.weekday,1565,84,15,g,'center',700,88,11);text(ctx,`شمسی  ${date.jalali}`,1734,84,17,main,'center',650,208,12);}
  if(bc.showGregorianDate!==false){ctx.save();ctx.fillStyle='#ffffff07';ctx.strokeStyle=`${g}42`;roundRect(ctx,1515,108,330,38,10);ctx.fill();ctx.stroke();ctx.restore();text(ctx,`میلادی  ${date.greg}`,1680,133,15,muted,'center',500,300,11);}
  const stamp=latestPayload?.updated_at?sourceTime(latestPayload.updated_at):'در انتظار نرخ';
  text(ctx,`آخرین دریافت نرخ  ${stamp}`,535,119,13,muted,'left',500,350,10);
  ctx.save();ctx.strokeStyle=`${g}55`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(55,195);ctx.lineTo(1865,195);ctx.stroke();ctx.restore();
}
function mainAreaWidth(){const percent=Math.max(20,Math.min(40,Number(settings.boardConfig?.sidePanelPercent)||27));return Math.max(760,Math.min(1400,1757-(1920*percent/100)));}
function cardGrid(items,columns,x,y,width,height,gap,maxRows){const cols=Math.max(1,Math.floor(columns)),visibleRows=Math.max(1,Math.floor(maxRows)),rows=Math.max(1,Math.ceil(items.length/cols)),cardW=(width-gap*(cols-1))/cols,cardH=(height-gap*(visibleRows-1))/visibleRows,rowPitch=cardH+gap,cycleHeight=rows*rowPitch;return{items,cols,rows,cardW,cardH,rowPitch,cycleHeight,scrollable:rows>visibleRows,positions:items.map((_,i)=>({x:x+(i%cols)*(cardW+gap),y:y+Math.floor(i/cols)*rowPitch}))};}
function drawCardSurface(x,y,w,h,featured=false){const hue=42+12*(.5+.5*Math.sin(Date.now()/1300));ctx.save();ctx.shadowColor=`hsla(${hue},82%,62%,${featured?.48:.3})`;ctx.shadowBlur=featured?18:13;ctx.fillStyle=featured?'#111714':'#0d1312';ctx.strokeStyle=featured?'#d8bd8380':'#ffffff24';ctx.lineWidth=1.2;roundRect(ctx,x,y,w,h,22);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#ffffff0b';ctx.lineWidth=1;roundRect(ctx,x+2,y+2,w-4,h-4,20);ctx.stroke();ctx.restore();if(featured){ctx.save();ctx.fillStyle='#d8bd83';roundRect(ctx,x+1,y+h*.28,3,h*.44,2);ctx.fill();ctx.restore();}}
function quotePrices(rate,card={}){const quotes=window.FarzinQuotePrices(rate?.price,card);return quotes?{buy:faNum(quotes.buy),sell:faNum(quotes.sell)}:{buy:'داده در دسترس نیست',sell:'داده در دسترس نیست'};}
function drawCardQuotes(rate,card,x,y,w,h,fontScale,unit=''){const size=Math.min(42,h*.24,w*.09)*fontScale;if(card.showTwoPrices===false){const missing=rate?.price===''||rate?.price===undefined||rate?.price===null,price=missing?'داده در دسترس نیست':faNum(rate.price),direction=rate?.direction==='up'?'#73d6a4':rate?.direction==='down'?'#f1a07f':settings.mutedColor;centeredText(ctx,missing?'—':price,x+w/2,y+h*.55,size,'#f3d88e',800,w-38,10);if(rate?.change_pct!==null&&rate?.change_pct!==undefined&&Number.isFinite(Number(rate.change_pct))){const change=Number(rate.change_pct),trend=`${change>0?'▲ ':change<0?'▼ ':'• '}${faNum(Math.abs(change))}٪`;centeredText(ctx,trend,x+w/2,y+h*.78,Math.min(15,h*.14)*fontScale,direction,700,w-36,9);}else if(missing)centeredText(ctx,'داده در دسترس نیست',x+w/2,y+h*.8,Math.min(12,h*.13)*fontScale,settings.mutedColor,500,w-30,8);if(unit)centeredText(ctx,unit,x+w/2,y+h-8,10,settings.mutedColor,500,w-28,8);return;}const prices=quotePrices(rate,card),pad=Math.max(12,w*.06),columnW=(w-pad*2-12)/2,labelY=y+Math.max(47,h*.43),valueY=y+Math.max(72,h*.68);centeredText(ctx,'خرید ما',x+pad+columnW/2,labelY,Math.min(15,h*.13)*fontScale,'#73d6a4',700,columnW-8,9);centeredText(ctx,prices.buy,x+pad+columnW/2,valueY,size,'#a8f0c8',800,columnW-8,10);centeredText(ctx,'فروش ما',x+w-pad-columnW/2,labelY,Math.min(15,h*.13)*fontScale,'#f1a07f',700,columnW-8,9);centeredText(ctx,prices.sell,x+w-pad-columnW/2,valueY,size,'#ffd0ad',800,columnW-8,10);if(unit)centeredText(ctx,unit,x+w/2,y+h-8,10,settings.mutedColor,500,w-28,8);}
 function drawMainPriceBoard(){const bc=settings.boardConfig||{};if(bc.showMainRates===false)return;const rows=mainRows(),x0=60,totalW=mainAreaWidth(),cols=Math.min(3,Math.max(1,Number(bc.mainColumns)||2)),gap=Math.max(14,Math.min(32,Number(bc.mainCardGap)||20)),fontScale=Math.max(.85,Math.min(1.5,Number(bc.mainFontScale)||1.1)),y0=250,areaH=678,grid=cardGrid(rows,cols,x0,y0,totalW,areaH,gap,3);ctx.save();ctx.fillStyle='#ffffff05';ctx.strokeStyle='#ffffff18';ctx.lineWidth=1;roundRect(ctx,x0,y0-24,totalW,702,16);ctx.fill();ctx.stroke();ctx.restore();text(ctx,settings.mainTitle||'نرخ لحظه‌ای طلا و سکه',x0+totalW-20,239,25,settings.goldColor,'right',800,totalW-40,15);if(!rows.length){centeredText(ctx,'برای نمایش نرخ، از پنل کانفیگ ردیف اضافه کنید',x0+totalW/2,y0+339,22,settings.mutedColor,500,totalW-60,14);return;}ctx.save();ctx.beginPath();ctx.rect(x0,y0,totalW,areaH);ctx.clip();const offset=grid.scrollable?cardScrollOffset%grid.cycleHeight:0,cycles=grid.scrollable?Array.from({length:Math.ceil(areaH/grid.cycleHeight)+2},(_,i)=>i*grid.cycleHeight-offset):[0];cycles.forEach(shift=>grid.items.forEach((row,i)=>{const{x,y}=grid.positions[i],cy=snapCanvasPixel(y+shift),rate=rateFor(row),featured=Boolean(row.featured);if(cy+grid.cardH<y0||cy>y0+areaH)return;drawCardSurface(x,cy,grid.cardW,grid.cardH,featured);drawAssetIcon(assetIcon(row),row.showTwoPrices===false?x+22:x+grid.cardW-22,cy+17,18);if(row.showTwoPrices===false)text(ctx,row.label||'',x+grid.cardW-18,cy+Math.min(26,grid.cardH*.2),Math.min(19,grid.cardH*.16)*fontScale,settings.mutedColor,'right',700,grid.cardW-48,10);else centeredText(ctx,row.label||'',x+grid.cardW/2,cy+22,Math.min(19,grid.cardH*.16)*fontScale,settings.mutedColor,700,grid.cardW-68,10);ctx.save();ctx.strokeStyle=`${settings.goldColor}35`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+grid.cardW/2,cy+grid.cardH*.39);ctx.lineTo(x+grid.cardW/2,cy+grid.cardH*.78);ctx.stroke();ctx.restore();drawCardQuotes(rate,row,x,cy,grid.cardW,grid.cardH,fontScale,row.unit||rate.unit||'');}));ctx.restore();}
function drawSideCard(item,rate,x,y,w,h,fontScale){
  drawCardSurface(x,y,w,h,false);
  const labelSize=Math.min(18,h*.17)*fontScale;
  ctx.save();ctx.beginPath();roundRect(ctx,x,y,w,h,22);ctx.clip();drawFadedAssetIcon(assetIcon(item),x+w*.77,y+h*.59,Math.min(76,h*.72),.1);ctx.restore();
  text(ctx,item.label||'',x+w-18,y+Math.min(27,h*.24),labelSize,settings.textColor,'right',700,w-52,10);
  if(item.showTwoPrices===false){
    const missing=rate?.price===''||rate?.price===undefined||rate?.price===null;
    const price=missing?'—':faNum(rate.price);
    const unit=String(rate?.unit||item.unit||'').trim();
    centeredText(ctx,price,x+w/2,y+h*.57,Math.min(30,h*.28,w*.075)*fontScale,'#f3d88e',800,w*.54,12);
    if(unit)text(ctx,unit,x+14,y+h*.57+4,Math.min(12,h*.12),settings.mutedColor,'left',500,Math.max(30,w*.28),8);
    if(missing)centeredText(ctx,'داده در دسترس نیست',x+w/2,y+h*.79,12,settings.mutedColor,500,w-36,9);
    else if(Number.isFinite(Number(rate?.change_pct)))centeredText(ctx,`${Number(rate.change_pct)>0?'▲ ':Number(rate.change_pct)<0?'▼ ':'• '}${faNum(Math.abs(Number(rate.change_pct)))}٪`,x+w/2,y+h*.8,13,rate.direction==='up'?'#73d6a4':rate.direction==='down'?'#f1a07f':settings.mutedColor,600,w-36,9);
  }else{
    const prices=quotePrices(rate,item),unit=String(rate?.unit||item.unit||'').trim(),priceSize=Math.min(20,h*.19,w*.052)*fontScale;
    const buyY=y+h*.59,sellY=y+h*.82;
    centeredText(ctx,prices.buy,x+w/2,buyY,priceSize,'#a8f0c8',800,w*.48,10);
    centeredText(ctx,'خرید',x+w-14,buyY,Math.min(12,h*.11), '#73d6a4',600,w*.18,8);
    if(unit)text(ctx,unit,x+12,buyY+4,Math.min(11,h*.1),settings.mutedColor,'left',500,w*.2,7);
    centeredText(ctx,prices.sell,x+w/2,sellY,priceSize,'#ffd0ad',800,w*.48,10);
    centeredText(ctx,'فروش',x+w-14,sellY,Math.min(12,h*.11),'#f1a07f',600,w*.18,8);
    if(unit)text(ctx,unit,x+12,sellY+4,Math.min(11,h*.1),settings.mutedColor,'left',500,w*.2,7);
  }
}
function drawSidePanel(){const bc=settings.boardConfig||{};if(bc.showSideRates===false)return;const rates=(settings.sideRates||[]).filter(r=>r.visible!==false),percent=Math.max(20,Math.min(40,Number(bc.sidePanelPercent)||27)),w=1920*percent/100,x=1920-55-w,y0=220,h=725,g=settings.goldColor||'#c8a85c',fontScale=Math.max(.85,Math.min(1.5,Number(bc.sideFontScale)||1.1)),listY=y0+56,listH=655,gap=10,visibleRows=Math.min(6,Math.max(1,rates.length)),grid=cardGrid(rates,1,x+11,listY,w-22,listH,gap,visibleRows);ctx.save();const glass=ctx.createLinearGradient(x,y0,x+w,y0+h);glass.addColorStop(0,'#ffffff14');glass.addColorStop(.48,'#34413978');glass.addColorStop(1,'#101816c9');ctx.fillStyle=glass;ctx.strokeStyle='#ffffff30';ctx.lineWidth=1;roundRect(ctx,x,y0,w,h,18);ctx.fill();ctx.stroke();ctx.restore();text(ctx,settings.sideTitle||'ارز و بازارهای جهانی',x+w-22,y0+34,23,g,'right',800,w-44,14);ctx.save();ctx.beginPath();ctx.rect(x+8,listY,w-16,listH);ctx.clip();const offset=grid.scrollable?sideScrollOffset%grid.cycleHeight:0,cycles=grid.scrollable?Array.from({length:Math.ceil(listH/grid.cycleHeight)+2},(_,i)=>i*grid.cycleHeight-offset):[0];cycles.forEach(shift=>grid.items.forEach((item,i)=>{const{y}=grid.positions[i],cy=snapCanvasPixel(y+shift);if(cy+grid.cardH<listY||cy>listY+listH)return;drawSideCard(item,rateFor(item),x+11,cy,w-22,grid.cardH,fontScale);}));ctx.restore();}

function drawFooter(){const bc=settings.boardConfig||{};
  if(bc.showFooter!==false){
    const f=(bc.footerLines||[]).filter(x=>x.visible!==false&&String(x.text||'').trim()).slice(0,5);
    if(f.length){
      const y=951,h=34,left=60,right=1860,gap=8,cardW=(right-left-gap*(f.length-1))/f.length;
      f.forEach((line,i)=>{const x=left+i*(cardW+gap);ctx.save();ctx.fillStyle='#ffffff07';ctx.strokeStyle=`${settings.goldColor}48`;ctx.lineWidth=1;roundRect(ctx,x,y,cardW,h,8);ctx.fill();ctx.stroke();ctx.restore();text(ctx,line.text,x+cardW/2,y+22,12,settings.mutedColor,'center',500,cardW-22,8);});
    }
  }
  text(ctx,'منبع نرخ‌ها · TGJU',60,997,9,settings.goldColor,'left',500,250,8);
}

function getTickerMessage(){
  const stories=newsItems.map(n=>`${n.title}${n.source?`  ◈ ${n.source}`:''}`).filter(Boolean);
  return stories.length?stories.join('     ✦     '):(newsError?'دریافت خبرهای فارسی موقتاً ممکن نیست؛ اتصال خبرخوان را بررسی کنید.':'در حال دریافت تازه‌ترین خبرهای فارسی جهان…');
}
function drawNewsTicker(){
  const bc=settings.boardConfig||{};if(bc.showNewsTicker===false)return;
  const y=1002,h=58;ctx.save();
  const grad=ctx.createLinearGradient(0,y,1920,y);grad.addColorStop(0,'#211a0d');grad.addColorStop(.5,'#13120e');grad.addColorStop(1,'#211a0d');
  ctx.fillStyle=grad;ctx.fillRect(0,y,1920,h);ctx.strokeStyle=`${settings.goldColor}90`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1920,y);ctx.stroke();ctx.fillStyle=settings.goldColor;ctx.fillRect(1610,y,310,h);ctx.restore();
  const label=bc.tickerLabel||'تازه‌ترین اخبار جهان';text(ctx,label,1765,y+36,Number(bc.tickerFontSize)||17,'#17130a','center',800,270,12);
  const msg=getTickerMessage();ctx.save();ctx.beginPath();ctx.rect(35,y+2,1555,h-4);ctx.clip();
  ctx.font=`600 ${Number(bc.tickerFontSize)||17}px Vazirmatn,Tahoma,sans-serif`;ctx.textBaseline='alphabetic';ctx.textAlign='right';ctx.direction='rtl';
  const width=ctx.measureText(msg).width+110,loopWidth=width+150,x=1590-(tickerOffset%loopWidth);
  ctx.fillStyle=settings.textColor;ctx.fillText(msg,x,y+37);ctx.fillText(msg,x+loopWidth,y+37);ctx.restore();
}
function animateTicker(timestamp){
  const now=Number(timestamp)||Date.now();if(document.hidden){tickerLastFrameAt=now;return;}if(!tickerLastFrameAt)tickerLastFrameAt=now;
  const dt=Math.max(0,Math.min(.05,(now-tickerLastFrameAt)/1000));tickerLastFrameAt=now;
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const columns=Math.min(3,Math.max(1,Number(settings?.boardConfig?.mainColumns)||2));
  const scrollSpeed=Math.max(5,Math.min(120,Number(settings?.boardConfig?.cardScrollSpeed)||32));
  if(!reducedMotion&&mainRows().length>columns*3)cardScrollOffset+=scrollSpeed*dt;
  if(!reducedMotion&&(settings.sideRates||[]).filter(item=>item.visible!==false).length>6)sideScrollOffset+=scrollSpeed*dt;
  if(!reducedMotion&&settings?.boardConfig?.showNewsTicker!==false){const tickerSpeed=Math.max(5,Math.min(140,Number(settings?.boardConfig?.tickerSpeed)||65));tickerOffset+=tickerSpeed*dt;}
  if(!document.hidden&&now-lastBoardFrameAt>=16){lastBoardFrameAt=now;render();}
  if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(animateTicker);
  else setTimeout(()=>animateTicker(Date.now()),33);
}
function isValidRate(item){return Boolean(item&&item.price!==undefined&&item.price!==null&&item.price!==''&&Number.isFinite(Number(item.price))&&Number(item.price)>=0);}
function hasUsableRates(data){const all=[...Object.values(data?.prices||{}),...Object.values(data?.sideRates||{}),...Object.values(data?.assets||{})];return all.some(isValidRate);}
function mergeValidRates(previous,incoming){const merged={...(previous||{})};for(const [key,item] of Object.entries(incoming||{})){if(isValidRate(item))merged[key]=item;}return merged;}
function updateConnectionStatus(){const s=$('boardStatus'),dot=$('liveDot');if(!s)return;const wait=Math.max(0,Math.ceil((nextRefreshAt-Date.now())/1000));let label='در حال اتصال به سرور محلی…',state=connectionState;if(state==='connecting')label='در حال دریافت قیمت از TGJU…';else if(state==='online')label=`نرخ معتبر دریافت شد · بروزرسانی بعدی ${faNum(wait)} ثانیه`;else if(state==='partial')label=`اتصال TGJU برقرار؛ برخی نمادها در فید موجود نیستند · ${faNum(wait)} ثانیه`;else if(state==='missing')label=`نرخ معتبر در دسترس نیست · ${faNum(wait)} ثانیه`;else if(state==='offline')label=serverOffline?`ارتباط با سرور محلی برقرار نشد · تلاش مجدد ${faNum(wait)} ثانیه دیگر`:`دریافت نرخ از TGJU ناموفق بود · تلاش مجدد ${faNum(wait)} ثانیه دیگر`;else if(state==='stale')label=`نمایش آخرین نرخ معتبر؛ داده تازه نرسیده · تلاش مجدد ${faNum(wait)} ثانیه دیگر`;s.textContent=label;s.title=latestError||'وضعیت اتصال بازار';if(dot){dot.classList.toggle('error',['offline','missing','stale'].includes(state));dot.classList.toggle('partial',state==='partial');dot.classList.toggle('online',['online','partial'].includes(state));}}

window.addEventListener('error',event=>{latestError=event.message||'خطای اجرای تابلو';const status=$('boardStatus');if(status)status.textContent='خطای اجرای تابلو: '+latestError;const dot=$('liveDot');if(dot)dot.classList.add('error');console.error('[Farzin Board error]',event.error||event.message);},true);
window.addEventListener('unhandledrejection',event=>{latestError=event.reason?.message||String(event.reason||'خطای درخواست پس‌زمینه');if(connectionState==='connecting')connectionState='offline';const status=$('boardStatus');if(status)status.textContent='خطای دریافت اطلاعات: '+latestError;updateConnectionStatus();console.error('[Farzin Board rejection]',event.reason);});
function render(){try{if(!ctx)throw new Error('مرورگر این دستگاه از Canvas دوبعدی پشتیبانی نمی‌کند.');drawBackground();drawHeader();drawMainPriceBoard();drawSidePanel();drawFooter();drawNewsTicker();updateConnectionStatus();}catch(error){latestError=error?.message||'خطای نمایش تابلو';const status=$('boardStatus');if(status)status.textContent='تابلو بارگذاری شد، اما خطای نمایش رخ داد: '+latestError;const dot=$('liveDot');if(dot)dot.classList.add('error');console.error('[Farzin Board render]',error);}}
async function fetchJson(url,timeoutMs=7000){const controller=typeof AbortController==='function'?new AbortController():null;const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;try{const options={cache:'no-store',headers:{'Accept':'application/json'}};if(controller)options.signal=controller.signal;const response=await fetch(url,options);const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;}finally{if(timer)clearTimeout(timer);}}
async function refreshLogo(){try{const data=await fetchJson('/api/logo-meta',3000);if(logoVersion!==data.version){logoVersion=data.version;const fresh=new Image();fresh.onload=()=>{logo=fresh;logoReady=true;render();};fresh.onerror=()=>{};fresh.src=`/farzin-logo.png?v=${encodeURIComponent(data.version)}`;}}catch{}}
async function refreshNews(force=false){const interval=Math.max(60,Math.min(900,Number(settings.boardConfig?.newsRefreshSeconds||180)))*1000;if(!force&&Date.now()-lastNewsFetch<interval)return;lastNewsFetch=Date.now();try{const data=await fetchJson('/api/news',5500);const nextItems=Array.isArray(data.items)?data.items:[];if(JSON.stringify(nextItems)!==JSON.stringify(newsItems))tickerOffset=0;newsItems=nextItems;newsError=nextItems.length?'':'در حال حاضر تیتر فارسی تازه‌ای در خبرخوان پیدا نشد.';}catch(error){newsError=error.message||'خطای خبرخوان';}render();}
function scheduleNews(){clearTimeout(newsTimer);const seconds=Math.max(60,Math.min(900,Number(settings.boardConfig?.newsRefreshSeconds)||180));newsTimer=setTimeout(()=>{refreshNews(true).finally(scheduleNews);},seconds*1000);}
async function refreshAll(){
  if(pollInProgress)return;
  pollInProgress=true;
  if(!hasUsableRates(latestPayload))connectionState='connecting';
  latestError='در حال دریافت نرخ‌ها از TGJU…';
  nextRefreshAt=Date.now()+2000;
  render();
  let retrySoon=false;
  try{
    void refreshLogo();
    const settle=promise=>promise.then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
    const [configResult,dataResult]=await Promise.all([
      settle(fetchJson('/api/public-config',2500)),
      settle(fetchJson('/api/dashboard-data',3500))
    ]);
    let configError='';
    if(configResult.status==='fulfilled'){
      const config=configResult.value;
      if(config.settings)settings=normalize(config.settings);
    }else configError=`تنظیمات محلی: ${configResult.reason?.message||'دریافت نشد'}`;
    if(dataResult.status==='rejected'){serverOffline=true;throw dataResult.reason||new Error('سرور محلی پاسخ نداد.');}
    serverOffline=false;
    const data=dataResult.value||{};
    const receivedRates=hasUsableRates(data);
    if(receivedRates){
      livePrices=mergeValidRates(livePrices,data.prices);
      sideRates=mergeValidRates(sideRates,data.sideRates);
      assetPrices=mergeValidRates(assetPrices,data.assets);
      const previousPayload=latestPayload||{};
      latestPayload={...previousPayload,...data,updated_at:data.updated_at||previousPayload.updated_at||null,market_open:data.market_open??previousPayload.market_open??null,prices:livePrices,sideRates,assets:assetPrices};
      lastSuccessAt=Date.now();
      const failures=Object.entries(data.errors||{}).filter(([key])=>!['gram21'].includes(key));
      latestError=[data.last_error||'',failures.map(([key,value])=>`${key}: ${value}`).join(' · '),configError].filter(Boolean).join(' · ');
      connectionState=data.status==='stale'?'stale':(failures.length||configError||data.status==='partial'?'partial':'online');
    }else if(data.status==='connecting'){
      latestPayload={...(latestPayload||{}),...data};
      latestError='سرور محلی آماده است؛ منتظر اولین پاسخ قیمت از TGJU هستیم.';
      connectionState='connecting';
      retrySoon=true;
    }else if(hasUsableRates(latestPayload)){
      latestError=[data.last_error||'',Object.values(data.errors||{}).join(' · '),'آخرین نرخ معتبر حفظ شده است.'].filter(Boolean).join(' · ');
      connectionState='stale';
    }else{
      latestPayload={...(latestPayload||{}),...data};
      latestError=data.last_error||Object.values(data.errors||{}).join(' · ')||'از TGJU هنوز قیمت معتبری دریافت نشده است.';
      connectionState='offline';
      retrySoon=true;
    }
    render();
  }catch(error){
    latestError=error.message||'ارتباط با سرور محلی برقرار نشد.';
    serverOffline=true;
    connectionState=hasUsableRates(latestPayload)?'stale':'offline';
    render();
    retrySoon=true;
  }finally{
    pollInProgress=false;
    const interval=Math.max(20,Math.min(300,Number(settings.boardConfig?.refreshSeconds)||30))*1000;
    const retryDelay=retrySoon?8000:interval;
    nextRefreshAt=Date.now()+retryDelay;
    render();
    scheduleRefresh(retryDelay);
  }
}
$('fullscreenBtn').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch(error){console.warn(error);}});
$('refreshBtn').addEventListener('click',async()=>{clearTimeout(refreshTimer);try{await fetch('/api/refresh',{method:'POST',cache:'no-store'});}catch{}refreshAll();});
function revealBoardControls(){const controls=$('boardControls');controls.classList.remove('hidden');clearTimeout(controlHideTimer);controlHideTimer=setTimeout(()=>controls.classList.add('hidden'),5000);}
document.addEventListener('mousemove',revealBoardControls);
document.addEventListener('touchstart',revealBoardControls,{passive:true});
document.fonts?.ready?.then(render);logo.onload=()=>{logoReady=true;render();};logo.onerror=()=>{};logo.src='/farzin-logo.png';
resizeCanvas();window.__farzinBoardBooted=true;if(window.__farzinBoardBootTimer)clearTimeout(window.__farzinBoardBootTimer);refreshNews(true).finally(scheduleNews);refreshAll();
if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(animateTicker);else setTimeout(()=>animateTicker(Date.now()),33);
window.addEventListener('online',()=>{clearTimeout(refreshTimer);refreshAll();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tickerLastFrameAt=0;lastBoardFrameAt=0;if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(animateTicker);clearTimeout(refreshTimer);refreshAll();}});
controlHideTimer=setTimeout(()=>$('boardControls').classList.add('hidden'),5000);
function scheduleRefresh(delayMs){clearTimeout(refreshTimer);const seconds=Math.max(20,Math.min(300,Number(settings.boardConfig?.refreshSeconds)||30));refreshTimer=setTimeout(()=>refreshAll(),Number.isFinite(delayMs)?delayMs:seconds*1000);}
