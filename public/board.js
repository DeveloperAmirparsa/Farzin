'use strict';
const canvas=document.getElementById('boardCanvas');
const ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const cloneConfig=value=>{if(typeof window.structuredClone==='function')return window.structuredClone(value);return JSON.parse(JSON.stringify(value));};
const DEFAULT_FEED='https://feeds.bbci.co.uk/persian/rss.xml';
const DEFAULTS={brand:'گالری طلا و سکه فرزین',subtitle:'نرخ لحظه‌ای بازار طلا و سکه',mainTitle:'نرخ لحظه‌ای طلا و سکه',sideTitle:'ارز و بازارهای جهانی',chartTitle:'نمودار تغییرات طلای ۱۸ عیار',bgColor:'#0b0b0a',goldColor:'#c8a85c',textColor:'#f5f0e5',mutedColor:'#bcb19b',watermarkOpacity:8,showFrame:true,showLogo:true,showAttribution:true,contactCards:[],footerLines:[],sections:[],sideRates:[],boardConfig:{refreshSeconds:30,showMainRates:true,showSideRates:true,showMarketStatus:true,showClock:true,showJalaliDate:true,showGregorianDate:true,showGoldChart:true,showContacts:true,showFooter:true,showNewsTicker:true,tickerLabel:'تازه‌ترین اخبار جهان',newsFeedUrl:DEFAULT_FEED,newsRefreshSeconds:180,tickerSpeed:65,chartRange:'1d',mainColumns:2,sidePanelPercent:27,tgjuWidgetCode:'',footerLines:[{id:'board-footer-quote',text:'زر، جلوه‌ای از زیبایی‌ست؛ اعتماد، ماندگارترین دارایی‌ست.',visible:true}]}};
let settings=cloneConfig(DEFAULTS),livePrices={},sideRates={},assetPrices={},latestPayload=null,historyPayload=null,latestError='',newsItems=[],newsError='',logo=new Image(),logoReady=false,logoVersion=null,pollInProgress=false,lastNewsFetch=0,nextRefreshAt=Date.now()+30000,tickerOffset=0,tickerLastFrameAt=0,controlHideTimer=null,refreshTimer=null,newsTimer=null,connectionState='connecting',lastSuccessAt=0,serverOffline=false,apiKeyConfigured=false,arzhaamKeyConfigured=false;
const DESIGN_WIDTH=1920,DESIGN_HEIGHT=1080;
function resizeCanvas(){
  const cssWidth=Math.max(1,Number(window.innerWidth)||document.documentElement?.clientWidth||1920);
  const cssHeight=Math.max(1,Number(window.innerHeight)||document.documentElement?.clientHeight||1080);
  const requestedDpr=Math.max(1,Math.min(2,Number(window.devicePixelRatio)||1));
  const dpr=Math.max(.75,Math.min(requestedDpr,4096/cssWidth,4096/cssHeight));
  const pixelWidth=Math.max(1,Math.round(cssWidth*dpr)),pixelHeight=Math.max(1,Math.round(cssHeight*dpr));
  if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
  if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
  const scale=Math.min(pixelWidth/DESIGN_WIDTH,pixelHeight/DESIGN_HEIGHT);
  const offsetX=(pixelWidth-DESIGN_WIDTH*scale)/2,offsetY=(pixelHeight-DESIGN_HEIGHT*scale)/2;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#050504';ctx.fillRect(0,0,pixelWidth,pixelHeight);
  ctx.setTransform(scale,0,0,scale,offsetX,offsetY);
  render();
}
window.addEventListener('resize',resizeCanvas);
function faNum(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('fa-IR',{maximumFractionDigits:2}).format(n):String(v??'—');}
function dateInfo(){const now=new Date();const greg=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);try{const p=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=t=>p.find(x=>x.type===t)?.value||'00';const faPad=t=>new Intl.NumberFormat('fa-IR',{useGrouping:false,minimumIntegerDigits:t==='year'?4:2}).format(Number(get(t)));const jalali=`${faPad('year')}/${faPad('month')}/${faPad('day')}`;const weekday=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran',weekday:'long'}).format(now);return{jalali,weekday,greg};}catch(error){const fallback=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',weekday:'long'}).format(now);return{jalali:'—',weekday:fallback,greg};}}
function tehranClock(){return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());}
function sourceTime(v){if(v===null||v===undefined||v==='')return'زمان منبع نامشخص';const numeric=typeof v==='number'||/^\d{10,13}$/.test(String(v));const n=Number(v);const d=new Date(numeric?(n<1e12?n*1000:n):v);return Number.isNaN(d.getTime())?'زمان منبع نامشخص':new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);}
function text(c,value,x,y,size,color,align='center',weight=500,maxWidth=1500,minSize=10){const str=String(value??'');let px=size;c.save();c.textAlign=align;c.textBaseline='alphabetic';c.direction='rtl';c.fillStyle=color;do{c.font=`${weight} ${px}px Vazirmatn,Tahoma,sans-serif`;if(c.measureText(str).width<=maxWidth||px<=minSize)break;px-=1;}while(px>minSize);c.fillText(str,x,y,maxWidth);c.restore();}
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
function normalize(raw){const s={...cloneConfig(DEFAULTS),...(raw||{})};s.boardConfig={...cloneConfig(DEFAULTS.boardConfig),...(s.boardConfig||{})};if(!Array.isArray(s.boardConfig.footerLines))s.boardConfig.footerLines=cloneConfig(DEFAULTS.boardConfig.footerLines);if(!raw?.schemaVersion||Number(raw.schemaVersion)<4){s.sections=[{id:'main-prices',title:'نرخ طلا و سکه',visible:true,rows:[{id:'mazaneh-main',label:'مظنه',source:'mazaneh',unit:'تومان',visible:true,featured:true},{id:'gram18-main',label:'گرم طلای ۱۸ عیار',source:'gram18',unit:'تومان',visible:true,featured:true},{id:'emami86-main',label:'سکه امامی ۸۶',source:'coin_full',unit:'تومان',visible:true,featured:true},{id:'oldcoin-main',label:'سکه قدیم',source:'coin_old',unit:'تومان',visible:true},{id:'half86-main',label:'نیم سکه ۸۶',source:'coin_half',unit:'تومان',visible:true},{id:'quarter86-main',label:'ربع سکه ۸۶',source:'coin_quarter',unit:'تومان',visible:true},{id:'gramcoin-main',label:'سکه یک گرمی',source:'coin_gerami',unit:'تومان',visible:true},{id:'gram24-main',label:'طلای ۲۴ عیار',source:'gram24',unit:'تومان',visible:true},{id:'gram21-main',label:'طلای ۲۱ عیار',source:'gram21',unit:'تومان',visible:true},{id:'ounce-main',label:'انس طلا',source:'ounce',unit:'دلار',visible:true}]}];s.sideRates=[{id:'usd-side',label:'دلار',source:'usd',unit:'تومان',visible:true},{id:'aed-side',label:'درهم',source:'aed',unit:'تومان',visible:true},{id:'eur-side',label:'یورو',source:'eur',unit:'تومان',visible:true},{id:'silver-side',label:'نقره ۹۹۹',source:'silver',unit:'تومان / گرم',visible:true},{id:'oil-side',label:'نفت برنت',source:'oil',unit:'دلار / بشکه',visible:true}];}s.sections=Array.isArray(s.sections)?s.sections:[];s.sideRates=Array.isArray(s.sideRates)?s.sideRates:[];s.contactCards=Array.isArray(s.contactCards)?s.contactCards:[];s.footerLines=Array.isArray(s.footerLines)?s.footerLines:[];return s;}
function mainRows(){return settings.sections.filter(s=>s.visible!==false).flatMap(s=>(s.rows||[]).filter(r=>r.visible!==false));}
function rateFor(rowOrSource,manualValue=''){const row=typeof rowOrSource==='object'&&rowOrSource?rowOrSource:{source:rowOrSource,manualValue};const source=String(row.source||'');if(source==='manual')return{price:row.manualValue||manualValue||'',change_pct:0,direction:'flat',updated_at:null,unit:''};const key=String(row.symbol||source);const item=['usd','aed','eur','silver','oil'].includes(source)?sideRates[source]:(livePrices[source]||assetPrices[key]);if(!item)return{price:'',change_pct:0,direction:'flat',updated_at:null,unit:''};const divisor=Math.max(0.0000001,Number(row.divisor)||1);return divisor===1?item:{...item,price:Number(item.price)/divisor,low:item.low===null?null:Number(item.low)/divisor,high:item.high===null?null:Number(item.high)/divisor};}
function drawAssetIcon(type,x,y,size=17){if(window.FarzinAssetIcons)window.FarzinAssetIcons.draw(ctx,type,x,y,size,settings.goldColor||'#c8a85c');}
function assetIcon(item){return window.FarzinAssetIcons?window.FarzinAssetIcons.infer(item):'generic';}
function valueString(rate){if(rate?.price===undefined||rate?.price===null||rate?.price==='')return'در انتظار نرخ';const n=Number(rate.price);return Number.isFinite(n)?faNum(n):String(rate.price);}
function drawArrow(x,y,direction,size=8){const col=direction==='up'?'#4fca8a':direction==='down'?'#eb7770':'#9e988a';ctx.save();ctx.fillStyle=col;ctx.beginPath();if(direction==='up'){ctx.moveTo(x,y-size);ctx.lineTo(x-size,y+size*.55);ctx.lineTo(x+size,y+size*.55);}else if(direction==='down'){ctx.moveTo(x,y+size);ctx.lineTo(x-size,y-size*.55);ctx.lineTo(x+size,y-size*.55);}else{ctx.rect(x-size,y-2,size*2,4);}ctx.closePath();ctx.fill();ctx.restore();}
function drawBackground(){const g=settings.goldColor||'#c8a85c',bg=settings.bgColor||'#0b0b0a';const grad=ctx.createRadialGradient(950,360,30,960,540,1300);grad.addColorStop(0,mixGold(g,.2));grad.addColorStop(.5,bg);grad.addColorStop(1,'#030302');ctx.fillStyle=grad;ctx.fillRect(0,0,1920,1080);if(logoReady&&Number(settings.watermarkOpacity)>0){ctx.save();ctx.globalAlpha=Math.max(0,Math.min(.25,Number(settings.watermarkOpacity)/100));ctx.globalCompositeOperation='screen';ctx.drawImage(logo,790,250,360,360);ctx.restore();}if(settings.showFrame!==false){ctx.save();ctx.strokeStyle=`${g}88`;ctx.lineWidth=2;roundRect(ctx,18,18,1884,1044,22);ctx.stroke();ctx.strokeStyle=`${g}24`;ctx.lineWidth=1;roundRect(ctx,31,31,1858,1018,17);ctx.stroke();ctx.restore();}}
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
function mainAreaWidth(){const percent=Math.max(20,Math.min(40,Number(settings.boardConfig?.sidePanelPercent)||27));return Math.max(900,Math.min(1280,1920-(1920*percent/100)-145));}
function drawMainPriceBoard(){const bc=settings.boardConfig||{};if(bc.showMainRates===false)return;const rows=mainRows();if(!rows.length){text(ctx,'برای نمایش نرخ، از پنل کانفیگ ردیف اضافه کنید',720,420,22,settings.mutedColor,'center',500,1000,15);return;}const x0=60,totalW=mainAreaWidth();text(ctx,settings.mainTitle||'نرخ لحظه‌ای طلا و سکه',x0+totalW-5,229,23,settings.goldColor,'right',800,totalW,15);const y0=250,cols=Math.min(3,Math.max(1,Number(bc.mainColumns)||2)),gap=Math.max(8,Math.min(24,Number(bc.mainCardGap)||14)),cardW=(totalW-gap*(cols-1))/cols,rowsCount=Math.ceil(rows.length/cols),availableH=420,cardH=Math.max(36,Math.min(76,(availableH-gap*(rowsCount-1))/rowsCount)),fontScale=Math.max(.75,Math.min(1.25,Number(bc.mainFontScale)||1));rows.forEach((row,i)=>{const r=Math.floor(i/cols),c=i%cols,x=x0+c*(cardW+gap),y=y0+r*(cardH+gap),rate=rateFor(row),featured=Boolean(row.featured);ctx.save();ctx.fillStyle=featured?'#c8a65320':'#ffffff09';ctx.strokeStyle=featured?`${settings.goldColor}b2`:'#a48d6045';ctx.lineWidth=featured?1.8:1;roundRect(ctx,x,y,cardW,cardH,12);ctx.fill();ctx.stroke();ctx.restore();const compact=cardH<57;drawAssetIcon(assetIcon(row),x+cardW-22,y+(compact?12:Math.min(20,cardH*.31)),compact?13:17);text(ctx,row.label||'',x+cardW-38,y+(compact?16:Math.min(25,cardH*.36)),Math.round((compact?11:15)*fontScale),settings.mutedColor,'right',600,cardW-54,8);const val=valueString(rate);text(ctx,val,x+cardW/2,y+(compact?36:Math.min(cardH*.73,52)),Math.round((compact?17:25)*fontScale),featured?'#efd07a':settings.textColor,'center',800,cardW-34,10);if(row.unit&&!compact)text(ctx,row.unit,x+15,y+cardH-8,10,settings.mutedColor,'left',400,100,8);});}
function drawSidePanel(){const bc=settings.boardConfig||{};if(bc.showSideRates===false)return;const rates=(settings.sideRates||[]).filter(r=>r.visible!==false);const percent=Math.max(20,Math.min(40,Number(bc.sidePanelPercent)||27));const w=1920*percent/100,x=1920-55-w,y0=220,h=725;ctx.save();ctx.fillStyle='#ffffff06';ctx.strokeStyle=`${settings.goldColor}55`;ctx.lineWidth=1.5;roundRect(ctx,x,y0,w,h,17);ctx.fill();ctx.stroke();ctx.restore();text(ctx,settings.sideTitle||'ارز و بازارهای جهانی',x+w-22,y0+35,21,settings.goldColor,'right',800,w-44,14);const startY=y0+57,availableH=548,gap=7,cardH=Math.max(30,Math.min(103,(availableH-gap*Math.max(0,rates.length-1))/Math.max(1,rates.length))),fontScale=Math.max(.75,Math.min(1.2,Number(bc.sideFontScale)||1));rates.forEach((item,i)=>{const y=startY+i*(cardH+gap),rate=rateFor(item);ctx.save();ctx.fillStyle='#ffffff0a';ctx.strokeStyle=`${settings.goldColor}50`;ctx.lineWidth=1;roundRect(ctx,x+12,y,w-24,cardH,11);ctx.fill();ctx.stroke();ctx.restore();const compact=cardH<58;drawAssetIcon(assetIcon(item),x+w-24,y+(compact?13:19),compact?13:17);text(ctx,item.label||'',x+w-41,y+(compact?17:26),Math.round((compact?11:16)*fontScale),settings.mutedColor,'right',600,w-68,8);text(ctx,valueString(rate),x+w/2,y+(compact?39:67),Math.round((compact?18:26)*fontScale),settings.textColor,'center',800,w-78,10);drawArrow(x+27,y+(compact?39:62),rate.direction,8);if(!compact){text(ctx,`${Number(rate.change_pct||0)>0?'+':''}${faNum(rate.change_pct||0)}٪`,x+52,y+68,11,rate.direction==='up'?'#69c88f':rate.direction==='down'?'#ec8278':settings.mutedColor,'left',600,92,8);text(ctx,rate.unit||item.unit||'',x+w-27,y+cardH-9,9,'#958a73','right',400,w-54,7);}});}

function historyPoints(){const candidate=historyPayload?.points||historyPayload?.history||historyPayload?.data||[];const raw=Array.isArray(candidate)?candidate:[];return raw.map(p=>{let t,v;if(Array.isArray(p))[t,v]=p;else if(p&&typeof p==='object'){t=p.timestamp||p.time||p.date;v=p.price??p.value;}const time=typeof t==='number'?new Date(t<1e12?t*1000:t).getTime():Date.parse(t);return{time,value:Number(v)};}).filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.value));}
function drawGoldChart(){const bc=settings.boardConfig||{};if(bc.showGoldChart===false)return;const x=60,y=700,w=mainAreaWidth(),h=245,g=settings.goldColor||'#c8a85c';ctx.save();ctx.fillStyle='#ffffff08';ctx.strokeStyle=`${g}70`;ctx.lineWidth=1.4;roundRect(ctx,x,y,w,h,16);ctx.fill();ctx.stroke();ctx.restore();const rangeLabel=({ '1d':'امروز','30d':'۳۰ روز اخیر','90d':'۹۰ روز اخیر','1y':'یک سال اخیر' })[bc.chartRange||'1d']||'امروز';text(ctx,`${settings.chartTitle||'نمودار طلای ۱۸ عیار'} · ${rangeLabel}`,x+w-22,y+32,18,g,'right',700,w-44,12);const gx=x+25,gy=y+55,gw=w-50,gh=137,pts=historyPoints();ctx.save();ctx.strokeStyle='#ffffff12';ctx.lineWidth=1;for(let i=1;i<=3;i++){const yy=gy+gh*i/4;ctx.beginPath();ctx.moveTo(gx,yy);ctx.lineTo(gx+gw,yy);ctx.stroke();}if(pts.length>1){const values=pts.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),span=max-min||1,coords=pts.map((p,i)=>({x:gx+i/(pts.length-1)*gw,y:gy+gh-(p.value-min)/span*gh}));const fill=ctx.createLinearGradient(0,gy,0,gy+gh);fill.addColorStop(0,`${g}35`);fill.addColorStop(1,`${g}00`);ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(gx+gw,gy+gh);ctx.lineTo(gx,gy+gh);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=g;ctx.lineWidth=3;ctx.lineJoin='round';ctx.stroke();const last=coords[coords.length-1];ctx.fillStyle=g;ctx.beginPath();ctx.arc(last.x,last.y,5,0,Math.PI*2);ctx.fill();text(ctx,faNum(max),gx+gw-4,gy+12,10,settings.mutedColor,'right',400,120,8);text(ctx,faNum(min),gx+gw-4,gy+gh-3,10,settings.mutedColor,'right',400,120,8);}else{text(ctx,'پس از دریافت نمونه‌های زنده TGJU، نمودار اینجا تکمیل می‌شود',x+w/2,gy+gh/2,15,settings.mutedColor,'center',400,w-80,11);}const d=dateInfo();text(ctx,`${d.weekday} · ${d.jalali}`,x+w-22,y+h-13,12,g,'right',600,w*.45,9);text(ctx,d.greg,x+22,y+h-13,12,settings.mutedColor,'left',500,w*.35,9);ctx.restore();}
function drawContactsAndFooter(){const bc=settings.boardConfig||{};const x=1920-55-(1920*Math.max(20,Math.min(40,Number(bc.sidePanelPercent)||27))/100)+12,w=(1920-55)-x-12;if(bc.showContacts!==false){const cards=(settings.contactCards||[]).filter(c=>c.visible!==false&&String(c.value||'').trim());if(cards.length){const cols=Math.min(3,cards.length),rows=Math.ceil(cards.length/cols),gap=5,top=842,areaH=92,cw=(w-gap*(cols-1))/cols,ch=(areaH-gap*(rows-1))/rows;cards.forEach((c,i)=>{const xx=x+(i%cols)*(cw+gap),yy=top+Math.floor(i/cols)*(ch+gap);ctx.save();ctx.fillStyle='#ffffff08';ctx.strokeStyle=`${settings.goldColor}55`;ctx.lineWidth=1;roundRect(ctx,xx,yy,cw,ch,8);ctx.fill();ctx.stroke();ctx.restore();if(ch>=38){text(ctx,c.title||'',xx+cw/2,yy+Math.min(14,ch*.38),10,settings.mutedColor,'center',500,cw-10,7);text(ctx,c.value||'',xx+cw/2,yy+ch-6,12,settings.textColor,'center',650,cw-10,8);}else{text(ctx,`${c.title||''}: ${c.value||''}`,xx+cw/2,yy+ch*.68,10,settings.textColor,'center',600,cw-8,7);}});}}
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
  const now=Number(timestamp)||Date.now();if(!tickerLastFrameAt)tickerLastFrameAt=now;
  const dt=Math.max(0,Math.min(.08,(now-tickerLastFrameAt)/1000));tickerLastFrameAt=now;
  if(settings?.boardConfig?.showNewsTicker!==false){tickerOffset+=(Number(settings.boardConfig?.tickerSpeed)||65)*dt;try{drawNewsTicker();}catch(error){console.warn('[Farzin ticker animation]',error);}}
  if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(animateTicker);
  else setTimeout(()=>animateTicker(Date.now()),33);
}
function isValidRate(item){return Boolean(item&&item.price!==undefined&&item.price!==null&&item.price!==''&&Number.isFinite(Number(item.price))&&Number(item.price)>=0);}
function hasUsableRates(data){const all=[...Object.values(data?.prices||{}),...Object.values(data?.sideRates||{}),...Object.values(data?.assets||{})];return all.some(isValidRate);}
function mergeValidRates(previous,incoming){const merged={...(previous||{})};for(const [key,item] of Object.entries(incoming||{})){if(isValidRate(item))merged[key]=item;}return merged;}
function refreshLiveHeader(){
  if(!ctx)return;
  try{
    ctx.save();ctx.beginPath();ctx.rect(45,30,470,135);ctx.clip();
    drawBackground();drawHeader();ctx.restore();
    updateConnectionStatus();
  }catch(error){try{ctx.restore();}catch{}console.warn('[Farzin live clock]',error);}
}
function updateConnectionStatus(){const s=$('boardStatus'),dot=$('liveDot');if(!s)return;const wait=Math.max(0,Math.ceil((nextRefreshAt-Date.now())/1000));let label='در حال اتصال به سرور محلی…',state=connectionState;if(state==='connecting')label='در حال دریافت قیمت از TGJU…';else if(state==='online')label=`نرخ معتبر دریافت شد · بروزرسانی بعدی ${faNum(wait)} ثانیه`;else if(state==='partial')label=`اتصال TGJU برقرار؛ برخی نمادها در فید موجود نیستند · ${faNum(wait)} ثانیه`;else if(state==='missing')label=`نرخ معتبر در دسترس نیست · ${faNum(wait)} ثانیه`;else if(state==='offline')label=serverOffline?`ارتباط با سرور محلی برقرار نشد · تلاش مجدد ${faNum(wait)} ثانیه دیگر`:`دریافت نرخ از TGJU ناموفق بود · تلاش مجدد ${faNum(wait)} ثانیه دیگر`;else if(state==='stale')label=`نمایش آخرین نرخ معتبر؛ داده تازه نرسیده · تلاش مجدد ${faNum(wait)} ثانیه دیگر`;s.textContent=label;s.title=latestError||'وضعیت اتصال بازار';if(dot){dot.classList.toggle('error',['offline','missing','stale'].includes(state));dot.classList.toggle('partial',state==='partial');dot.classList.toggle('online',['online','partial'].includes(state));}}

window.addEventListener('error',event=>{latestError=event.message||'خطای اجرای تابلو';const status=$('boardStatus');if(status)status.textContent='خطای اجرای تابلو: '+latestError;const dot=$('liveDot');if(dot)dot.classList.add('error');console.error('[Farzin Board error]',event.error||event.message);},true);
window.addEventListener('unhandledrejection',event=>{latestError=event.reason?.message||String(event.reason||'خطای درخواست پس‌زمینه');if(connectionState==='connecting')connectionState='offline';const status=$('boardStatus');if(status)status.textContent='خطای دریافت اطلاعات: '+latestError;updateConnectionStatus();console.error('[Farzin Board rejection]',event.reason);});
function render(){try{if(!ctx)throw new Error('مرورگر این دستگاه از Canvas دوبعدی پشتیبانی نمی‌کند.');drawBackground();drawHeader();drawMainPriceBoard();drawGoldChart();drawSidePanel();drawContactsAndFooter();drawNewsTicker();updateConnectionStatus();}catch(error){latestError=error?.message||'خطای نمایش تابلو';const status=$('boardStatus');if(status)status.textContent='تابلو بارگذاری شد، اما خطای نمایش رخ داد: '+latestError;const dot=$('liveDot');if(dot)dot.classList.add('error');console.error('[Farzin Board render]',error);}}
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
      latestPayload={...previousPayload,...data,updated_at:data.updated_at||previousPayload.updated_at||null,market_open:data.market_open??previousPayload.market_open??null,history:data.history||previousPayload.history||null,prices:livePrices,sideRates,assets:assetPrices};
      if(data.history)historyPayload=data.history;
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
document.addEventListener('mousemove',()=>{$('boardControls').classList.remove('hidden');clearTimeout(controlHideTimer);controlHideTimer=setTimeout(()=>$('boardControls').classList.add('hidden'),5000);});
document.fonts?.ready?.then(render);logo.onload=()=>{logoReady=true;render();};logo.onerror=()=>{};logo.src='/farzin-logo.png';
resizeCanvas();window.__farzinBoardBooted=true;if(window.__farzinBoardBootTimer)clearTimeout(window.__farzinBoardBootTimer);refreshNews(true).finally(scheduleNews);refreshAll();
if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(animateTicker);else setTimeout(()=>animateTicker(Date.now()),33);
setInterval(refreshLiveHeader,1000);
window.addEventListener('online',()=>{clearTimeout(refreshTimer);refreshAll();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearTimeout(refreshTimer);refreshAll();}});
controlHideTimer=setTimeout(()=>$('boardControls').classList.add('hidden'),5000);
function scheduleRefresh(delayMs){clearTimeout(refreshTimer);const seconds=Math.max(20,Math.min(300,Number(settings.boardConfig?.refreshSeconds)||30));refreshTimer=setTimeout(()=>refreshAll(),Number.isFinite(delayMs)?delayMs:seconds*1000);}
