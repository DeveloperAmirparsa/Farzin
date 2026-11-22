(function (root) {
  'use strict';
  // Curated TGJU symbol catalogue. Symbols are the profile/widget identifiers;
  // the live feed may expose only a subset at any given time.
  const groups = [
    { id:'gold', label:'طلا و آبشده', icon:'gold', items:[
      ['gram18','طلای ۱۸ عیار','gram18','تومان',10],['gram24','طلای ۲۴ عیار','gram24','تومان',10],['gram18_740','طلای ۱۸ عیار ۷۴۰','geram18_740','تومان',10],['secondhand','طلای دست دوم','geram18_700','تومان',10],['mazaneh','مظنه مثقال','mesghal','تومان',10],['abshodeh','آبشده نقدی','abshodeh','تومان',10],['abshodeh_wholesale','آبشده بنکداری','abshodeh_b','تومان',10],['ounce','انس جهانی طلا','ons','دلار',1]
    ]},
    { id:'coins', label:'سکه و حباب', icon:'coin', items:[
      ['coin_full','سکه امامی','sekee','تومان',10],['coin_old','سکه بهار آزادی','sekeb','تومان',10],['coin_half','نیم سکه','nim','تومان',10],['coin_quarter','ربع سکه','rob','تومان',10],['coin_gerami','سکه گرمی','gerami','تومان',10],['bubble_emami','حباب سکه امامی','sekeb_bubble','تومان',10],['bubble_bahar','حباب سکه بهار آزادی','sekeb_bahar_bubble','تومان',10],['bubble_half','حباب نیم سکه','nim_bubble','تومان',10],['bubble_quarter','حباب ربع سکه','rob_bubble','تومان',10],['bubble_gerami','حباب سکه گرمی','gerami_bubble','تومان',10]
    ]},
    { id:'silver', label:'نقره و فلزات گران‌بها', icon:'silver', items:[
      ['silver_999','نقره ۹۹۹','silver_999','تومان / گرم',10],['silver_925','نقره ۹۲۵','silver_925','تومان / گرم',10],['silver_ounce','انس نقره','silver','دلار',1],['platinum','انس پلاتین','platinum','دلار',1],['palladium','انس پالادیوم','palladium','دلار',1]
    ]},
    { id:'base-metals', label:'فلزات پایه', icon:'metal', items:[
      ['aluminum','آلومینیوم','basemetal-aluminum','دلار / تن',1],['lead','سرب','basemetal-lead','دلار / تن',1],['zinc','روی','basemetal-zinc','دلار / تن',1],['nickel','نیکل','basemetal-nickel','دلار / تن',1],['cobalt','کبالت','basemetal-cobalt','دلار / تن',1],['tin','قلع','basemetal-tin','دلار / تن',1],['copper_london','مس لندن','basemetal-copper-london','دلار / تن',1],['copper_us','مس آمریکا','basemetal-copper-us','دلار',1]
    ]},
    { id:'currencies', label:'ارزهای آزاد ایران', icon:'currency', items:[
      ['usd','دلار آمریکا','price_dollar_rl','تومان',10],['eur','یورو','price_eur','تومان',10],['gbp','پوند انگلیس','price_gbp','تومان',10],['aed','درهم امارات','price_aed','تومان',10],['try','لیر ترکیه','price_try','تومان',10],['cad','دلار کانادا','price_cad','تومان',10],['chf','فرانک سوئیس','price_chf','تومان',10],['cny','یوان چین','price_cny','تومان',10],['jpy','ین ژاپن','price_jpy','تومان',10],['iqd','دینار عراق','price_iqd','تومان',10],['rub','روبل روسیه','price_rub','تومان',10],['sar','ریال عربستان','price_sar','تومان',10],['kwd','دینار کویت','price_kwd','تومان',10],['afn','افغانی','price_afn','تومان',10],['inr','روپیه هند','price_inr','تومان',10],['azn','منات آذربایجان','price_azn','تومان',10],['aud','دلار استرالیا','price_aud','تومان',10],['nzd','دلار نیوزیلند','price_nzd','تومان',10],['sgd','دلار سنگاپور','price_sgd','تومان',10],['sek','کرون سوئد','price_sek','تومان',10],['nok','کرون نروژ','price_nok','تومان',10],['dkk','کرون دانمارک','price_dkk','تومان',10],['omr','ریال عمان','price_omr','تومان',10],['bhd','دینار بحرین','price_bhd','تومان',10],['qar','ریال قطر','price_qar','تومان',10],['krw','وون کره جنوبی','price_krw','تومان',10],['pkr','روپیه پاکستان','price_pkr','تومان',10],['thb','بات تایلند','price_thb','تومان',10],['myr','رینگیت مالزی','price_myr','تومان',10]
    ]},
    { id:'crypto', label:'ارزهای دیجیتال', icon:'crypto', items:[
      ['bitcoin','بیت‌کوین','crypto-bitcoin','دلار',1],['ethereum','اتریوم','crypto-ethereum','دلار',1],['tether','تتر','crypto-tether','دلار',1],['tether_toman','تتر به تومان','crypto-tether-toman','تومان',1],['ripple','ریپل','crypto-ripple','دلار',1],['bnb','بایننس کوین','crypto-binance-coin','دلار',1],['solana','سولانا','crypto-solana','دلار',1],['cardano','کاردانو','crypto-cardano','دلار',1],['dogecoin','دوج‌کوین','crypto-dogecoin','دلار',1],['tron','ترون','crypto-tron','دلار',1],['litecoin','لایت‌کوین','crypto-litecoin','دلار',1],['bitcoin_cash','بیت‌کوین کش','crypto-bitcoin-cash','دلار',1],['stellar','استلار','crypto-stellar','دلار',1],['monero','مونرو','crypto-monero','دلار',1],['dash','دش','crypto-dash','دلار',1],['avalanche','آوالانچ','crypto-avalanche','دلار',1],['polkadot','پولکادات','crypto-polkadot','دلار',1],['chainlink','چین‌لینک','crypto-chainlink','دلار',1],['shiba','شیبا اینو','crypto-shiba-inu','دلار',1],['toncoin','تون‌کوین','crypto-toncoin','دلار',1],['usdc','یو‌اس‌دی‌کوین','crypto-usd-coin','دلار',1],['dai','دای','crypto-dai','دلار',1],['aptos','آپتوس','crypto-aptos','دلار',1],['sui','سویی','crypto-sui','دلار',1],['near','نیر','crypto-near','دلار',1],['arbitrum','آربیتروم','crypto-arbitrum','دلار',1],['optimism','آپتیمیسم','crypto-optimism','دلار',1],['eos','ای‌اواس','crypto-eos','دلار',1],['nem','نم','crypto-nem','دلار',1],['qtum','کوانتوم','crypto-qtum','دلار',1],['vechain','وی‌چین','crypto-vechain','دلار',1],['ontology','آنتولوژی','crypto-ontology','دلار',1],['omisego','اومیسگو','crypto-omisego','دلار',1],['bytecoin','بایت‌کوین','crypto-bytecoin','دلار',1],['icon','آیکون','crypto-icon','دلار',1],['zcash','زی‌کش','crypto-zcash','دلار',1],['zilliqa','زیلیکا','crypto-zilliqa','دلار',1],['aeternity','ایترنیتی','crypto-aeternity','دلار',1],['decred','دکرد','crypto-decred','دلار',1],['siacoin','سیاکوین','crypto-siacoin','دلار',1],['populous','پاپیولس','crypto-populous','دلار',1]
    ]},
    { id:'energy', label:'نفت و انرژی', icon:'oil', items:[
      ['brent','نفت برنت','energy-brent-oil','دلار / بشکه',1],['wti','نفت خام WTI','energy-crude-oil-wti','دلار / بشکه',1],['opec','نفت اوپک','energy-opec-oil','دلار / بشکه',1],['fuel_oil','نفت کوره','energy-fuel-oil','دلار / تن',1],['natural_gas','گاز طبیعی','energy-natural-gas','دلار / MMBtu',1],['gasoline','بنزین','energy-gasoline','دلار',1],['diesel','گازوئیل','energy-gasoil','دلار / تن',1]
    ]},
    { id:'commodities', label:'کالاهای جهانی', icon:'commodity', items:[
      ['cotton','پنبه','commodity-cotton','دلار',1],['barley','جو','commodity-barley','دلار',1],['rice','برنج','commodity-rice','دلار',1],['corn','ذرت','commodity-corn','دلار',1],['coffee','قهوه','commodity-coffee','دلار',1],['wheat','گندم آمریکا','commodity-wheat-us','دلار',1],['cocoa','کاکائو','commodity-cocoa-us','دلار',1],['sugar','شکر','commodity-sugar-us','دلار',1],['soybean','سویا','commodity-soybean','دلار',1]
    ]},
    { id:'forex', label:'جفت‌ارزهای جهانی', icon:'forex', items:[
      ['eurusd','یورو / دلار','eur-usd','نسبت',1],['gbpusd','پوند / دلار','gbp-usd','نسبت',1],['usdjpy','دلار / ین','usd-jpy','نسبت',1],['usdchf','دلار / فرانک','usd-chf','نسبت',1],['audusd','دلار استرالیا / دلار','aud-usd','نسبت',1],['usdcad','دلار / دلار کانادا','usd-cad','نسبت',1],['nzdusd','دلار نیوزیلند / دلار','nzd-usd','نسبت',1],['usdtry','دلار / لیر','usd-try','نسبت',1],['usdcny','دلار / یوان','usd-cny','نسبت',1]
    ]},
    { id:'markets', label:'شاخص‌ها، سهام و صندوق‌ها', icon:'stock', items:[
      ['tse_index','شاخص کل بورس','tse-index','واحد',1],['equal_index','شاخص هم‌وزن','equal-weighted-index','واحد',1],['otc_index','شاخص فرابورس','otc-index','واحد',1],['dow_jones','داوجونز','global-dow-jones','واحد',1],['sp500','اس‌اندپی ۵۰۰','global-sp-500','واحد',1],['nasdaq','نزدک','global-nasdaq','واحد',1],['dax','دکس آلمان','global-dax','واحد',1],['nikkei','نیکی ۲۲۵','global-nikkei-225','واحد',1]
    ]},
    { id:'funds-bonds', label:'صندوق‌ها و اوراق', icon:'fund', items:[
      ['gold_fund','صندوق طلا','fund-gold','واحد',1],['etf','صندوق قابل معامله','etf-market','واحد',1],['bond','اوراق بدهی','bond-market','واحد',1]
    ]},
    { id:'country-currencies', label:'ارز کشورهای مختلف', icon:'currency', items:[
      ['usd_country','دلار آمریکا (بازار جهانی)','currency-us','واحد',1],['gbp_country','پوند بریتانیا','currency-gb','واحد',1],['eur_country','یورو اروپا','currency-eu','واحد',1],['try_country','لیر ترکیه','currency-tr','واحد',1],['rub_country','روبل روسیه','currency-ru','واحد',1],['inr_country','روپیه هند','currency-in','واحد',1],['cad_country','دلار کانادا','currency-ca','واحد',1],['aud_country','دلار استرالیا','currency-au','واحد',1]
    ]}
  ];
  const specificIcon = (symbol, fallback) => {
    const map = {
      'ons':'ounce','gold_global':'ounce',
      'crypto-bitcoin':'bitcoin','crypto-ethereum':'ethereum','crypto-tether':'tether','crypto-tether-toman':'tether',
      'crypto-ripple':'ripple','crypto-solana':'solana','crypto-binance-coin':'bnb','crypto-cardano':'cardano',
      'crypto-dogecoin':'dogecoin','crypto-tron':'tron',
      'price_dollar_rl':'usd','price_eur':'eur','price_gbp':'gbp','price_aed':'aed','price_try':'try',
      'price_cad':'cad','price_chf':'chf','price_cny':'cny','price_jpy':'jpy','price_iqd':'iqd',
      'price_rub':'rub','price_omr':'omr','price_sar':'sar','price_kwd':'kwd','price_aud':'aud'
    };
    return map[symbol] || fallback;
  };
  const items = groups.flatMap(group => group.items.map(([id,label,symbol,unit,divisor]) => ({id,label,symbol,unit,divisor,category:group.id,categoryLabel:group.label,icon:specificIcon(symbol,group.icon)})));
  root.FARZIN_ASSET_CATALOG = { groups, items, iconTypes:['auto','gold','ounce','coin','silver','currency','crypto','bitcoin','ethereum','tether','ripple','solana','bnb','cardano','dogecoin','tron','usd','eur','gbp','aed','try','cad','chf','cny','jpy','iqd','rub','omr','sar','kwd','aud','oil','metal','commodity','forex','stock','fund','bond','generic'] };
})(window);
