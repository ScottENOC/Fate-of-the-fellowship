'use strict';

// ── SYMBOLS ─────────────────────────────────────────────────────────────────
const SYM = {
  friendship:  { key:'friendship',  icon:'♥', name:'Friendship',  color:'#e060a8' },
  valor:       { key:'valor',       icon:'⚔', name:'Valor',       color:'#909090' },
  stealth:     { key:'stealth',     icon:'★', name:'Stealth',     color:'#50a850' },
  resistance:  { key:'resistance',  icon:'◎', name:'Resistance',  color:'#e08020' },
};

// ── REGIONS (for Nazgûl movement) ───────────────────────────────────────────
const REGIONS = {
  eriador:          { name:'Eriador' },
  rhudaur:          { name:'Rhudaur' },
  enedwaith:        { name:'Enedwaith' },
  'misty-mountains':{ name:'Misty Mountains' },
  rohan:            { name:'Rohan' },
  rhovanion:        { name:'Rhovanion' },
  gondor:           { name:'Gondor' },
  mordor:           { name:'Mordor' },
  haradwaith:       { name:'Haradwaith' },
};

const REGION_ADJ = {
  eriador:           ['rhudaur','enedwaith'],
  rhudaur:           ['eriador','misty-mountains','rhovanion'],
  enedwaith:         ['eriador','rohan'],
  'misty-mountains': ['rhudaur','rohan'],
  rohan:             ['enedwaith','misty-mountains','gondor','rhovanion'],
  rhovanion:         ['rhudaur','rohan','gondor','mordor'],
  gondor:            ['misty-mountains','rohan','rhovanion','mordor','haradwaith'],
  mordor:            ['gondor','rhovanion','haradwaith'],
  haradwaith:        ['gondor','mordor'],
};

// ── LOCATIONS ────────────────────────────────────────────────────────────────
// x,y = % of map.jpg (2230×2260, cropped from original page y=560–2820).
// Estimates — user can adjust.
// musterType: 'dwarven'|'elven'|'rohirrim'|'gondor'|null
// startShadow: initial shadow troops placed during setup
// capturable: can be captured with Capture action to become a haven
const LOCS = {
  'grey-havens':    { name:'Grey Havens',    x: 8.28, y:30.28, region:'eriador',       isHaven:true,  musterType:'elven',    startShadow:0, capturable:false },
  'ered-luin':      { name:'Ered Luin',      x: 8, y:24, region:'eriador',           isHaven:false, musterType:'dwarven',  startShadow:0, capturable:false },
  'the-shire':      { name:'The Shire',      x:14.28, y:27.28, region:'eriador',       isHaven:true,  musterType:null,       startShadow:0, capturable:false },
  'bree':           { name:'Bree',           x:21.28, y:30, region:'eriador',           isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'sarn-ford':      { name:'Sarn Ford',      x:17, y:36, region:'eriador',           isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'weather-hills':  { name:'Weather Hills',  x:27, y:28, region:'rhudaur',           isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'tharbad':        { name:'Tharbad',        x:28, y:36, region:'enedwaith',         isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'dunland':        { name:'Dunland',        x:33, y:40, region:'enedwaith',         isHaven:false, musterType:null,       startShadow:1, capturable:false },
  'rivendell':      { name:'Rivendell',      x:39, y:23, region:'rhudaur',           isHaven:true,  musterType:'elven',    startShadow:0, capturable:false },
  'hollin':         { name:'Hollin',         x:38, y:32, region:'misty-mountains',   isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'moria':          { name:'Moria',          x:46.44, y:32.56, region:'misty-mountains', isHaven:false, musterType:null,    startShadow:2, capturable:true  },
  'lorien':         { name:'Lórien',         x:47, y:39, region:'rohan',             isHaven:true,  musterType:'elven',    startShadow:0, capturable:false },
  'dol-guldur':     { name:'Dol Guldur',     x:57.24, y:38.72, region:'rhovanion',   isHaven:false, musterType:null,       startShadow:1, capturable:true  },
  'southern-mirkwood':{ name:'Southern Mirkwood', x:64.8, y:35.36, region:'rhovanion', isHaven:false, musterType:null, startShadow:0, capturable:false },
  'brown-lands':    { name:'Brown Lands',    x:64.24, y:44.32, region:'rhovanion',    isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'dagorlad':       { name:'Dagorlad',       x:68.44, y:48.52, region:'rhovanion',     isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'emyn-muil':      { name:'Emyn Muil',      x:58.64, y:47.68, region:'gondor',       isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'carrock':        { name:'Carrock',         x:49.56, y:22.96, region:'rhovanion',   isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'gladden-fields': { name:'Gladden Fields',  x:50.64, y:32, region:'rhovanion',     isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'woodland-realm': { name:'Woodland Realm', x:57.28, y:20.28, region:'rhovanion',         isHaven:true,  musterType:'elven',    startShadow:0, capturable:false },
  'old-forest-road':{ name:'Old Forest Road',x:60.08, y:24.76, region:'rhovanion',   isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'erebor':         { name:'Erebor',         x:66.36, y:20.72, region:'rhovanion',   isHaven:true,  musterType:'dwarven',  startShadow:0, capturable:false },
  'lake-town':      { name:'Lake Town',      x:68.32, y:25.76, region:'rhovanion',   isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'iron-hills':     { name:'Iron Hills',     x:75.6, y:22.68, region:'rhovanion',    isHaven:false, musterType:'dwarven',  startShadow:0, capturable:false },
  'dorwinion':      { name:'Dorwinion',      x:77.36, y:33.96, region:'rhovanion',     isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'rhun':           { name:'Rhûn',           x:91, y:42.6, region:'rhovanion',       isHaven:false, musterType:null,       startShadow:3, capturable:false },
  'isengard':       { name:'Isengard',       x:39, y:43, region:'rohan',             isHaven:false, musterType:null,       startShadow:1, capturable:true  },
  'fords-of-isen':  { name:'Fords of Isen', x:33.28, y:50.28, region:'rohan',       isHaven:false, musterType:'rohirrim', startShadow:0, capturable:false },
  'druwaith-lair':  { name:'Drúwaith Iaur', x:25.72, y:49.48, region:'rohan',       isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'helms-deep':     { name:"Helm's Deep",    x:40.4, y:52.32, region:'rohan',        isHaven:true,  musterType:'rohirrim', startShadow:0, capturable:false },
  'fangorn':        { name:'Fangorn',        x:43.56, y:43.56, region:'rohan',       isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'edoras':         { name:'Edoras',         x:46, y:53.84, region:'rohan',          isHaven:false, musterType:'rohirrim', startShadow:0, capturable:false },
  'pinnath-gelin':  { name:'Pinnath Gelin',  x:25.44, y:62.64, region:'gondor',      isHaven:false, musterType:'gondor',   startShadow:0, capturable:false },
  'erech':          { name:'Erech',          x:40.56, y:58.44, region:'gondor',      isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'eastemnet':      { name:'Eastemnet',      x:50.4, y:48.28, region:'rohan',        isHaven:false, musterType:'rohirrim', startShadow:0, capturable:false },
  'druadan-forest': { name:'Drúadan Forest', x:52.88, y:59.12, region:'gondor',      isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'minas-tirith':   { name:'Minas Tirith',   x:56.52, y:60.8, region:'gondor',       isHaven:true,  musterType:'gondor',   startShadow:0, capturable:false },
  'north-ithilien': { name:'North Ithilien', x:60.66, y:53.96, region:'gondor',      isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'osgiliath':      { name:'Osgiliath',      x:62.68, y:60.24, region:'gondor',      isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'lamedon':        { name:'Lamedon',        x:48.6, y:63.76, region:'gondor',       isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'dol-amroth':     { name:'Dol Amroth',     x:41.56, y:68.12, region:'gondor',      isHaven:false, musterType:'gondor',   startShadow:0, capturable:false },
  'pelargir':       { name:'Pelargir',       x:56.2, y:67, region:'gondor',         isHaven:false, musterType:'gondor',   startShadow:0, capturable:false },
  'south-ithilien': { name:'South Ithilien', x:62.92, y:66.44, region:'gondor',      isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'minas-morgul':   { name:'Minas Morgul',   x:70.48, y:65.04, region:'mordor',       isHaven:false, musterType:null,       startShadow:2, capturable:false },
  'udun':           { name:'Udûn',           x:67.44, y:54.4, region:'mordor',        isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'barad-dur':      { name:'Barad-dûr',      x:76.96, y:54.68, region:'mordor',      isHaven:false, musterType:null,       startShadow:2, capturable:false },
  'mount-doom':     { name:'Mount Doom',     x:71.4, y:58.4, region:'mordor',        isHaven:false, musterType:null,       startShadow:0, capturable:false },
  'plateau-of-gorgoroth':{ name:'Plateau of Gorgoroth', x:79.64, y:60.76, region:'mordor', isHaven:false, musterType:null, startShadow:0, capturable:false },
  'nurn':           { name:'Nûrn',           x:89.0, y:62.0, region:'mordor',        isHaven:false, musterType:null,       startShadow:3, capturable:false },
  'near-harad':     { name:'Near Harad',     x:70.0, y:87.28, region:'haradwaith',  isHaven:false, musterType:null,       startShadow:2, capturable:false },
  'umbar':          { name:'Umbar',          x:60.08, y:88.68, region:'haradwaith',   isHaven:false, musterType:null,       startShadow:1, capturable:true  },
  'harondor':       { name:'Harondor',       x:64.44, y:79.04, region:'haradwaith',  isHaven:false, musterType:null,       startShadow:0, capturable:false },
};

// ── CONNECTIONS ──────────────────────────────────────────────────────────────
// type: 'normal'|'special'   cost: array of symbol keys (for special paths)
const CONNECTIONS = [
  // ── BATTLE LINE SEGMENTS (render as colored lines) ────────────────────────
  // Grey – Eriador
  { a:'dunland',       b:'tharbad',           type:'normal' },
  { a:'tharbad',       b:'sarn-ford',         type:'normal' },
  { a:'sarn-ford',     b:'bree',              type:'normal' },
  { a:'bree',          b:'the-shire',         type:'normal' },
  { a:'the-shire',     b:'ered-luin',         type:'normal' },
  { a:'ered-luin',     b:'grey-havens',       type:'normal' },
  // Yellow – Rivendell
  { a:'isengard',      b:'fords-of-isen',     type:'normal' },
  { a:'fords-of-isen', b:'dunland',           type:'normal' },
  { a:'dunland',       b:'hollin',            type:'normal' },
  { a:'hollin',        b:'tharbad',           type:'normal' },
  { a:'tharbad',       b:'bree',              type:'normal' },
  { a:'bree',          b:'weather-hills',     type:'normal' },
  { a:'weather-hills', b:'rivendell',         type:'normal' },
  { a:'hollin',        b:'moria',             type:'special', cost:['friendship'] },
  { a:'hollin',        b:'weather-hills',     type:'normal' },
  // Orange – Helm's Deep
  { a:'dunland',       b:'druwaith-lair',     type:'normal' },
  { a:'druwaith-lair', b:'fords-of-isen',     type:'normal' },
  { a:'fords-of-isen', b:'helms-deep',        type:'normal' },
  { a:'umbar',         b:'harondor',          type:'normal' },
  { a:'harondor',      b:'pelargir',          type:'normal' },
  { a:'pelargir',      b:'lamedon',           type:'normal' },
  { a:'lamedon',       b:'erech',             type:'normal' },
  { a:'erech',         b:'pinnath-gelin',     type:'normal' },
  { a:'pinnath-gelin', b:'druwaith-lair',     type:'normal' },
  { a:'near-harad',    b:'harondor',          type:'normal' },
  // Pink – Grey Havens
  { a:'pelargir',      b:'dol-amroth',        type:'normal' },
  { a:'dol-amroth',    b:'grey-havens',       type:'special', cost:['friendship','friendship'] },
  { a:'helms-deep',    b:'edoras',            type:'normal' },
  { a:'edoras',        b:'druadan-forest',    type:'normal' },
  { a:'druadan-forest',b:'minas-tirith',      type:'normal' },
  { a:'minas-tirith',  b:'osgiliath',         type:'normal' },
  { a:'osgiliath',     b:'south-ithilien',    type:'normal' },
  { a:'south-ithilien',b:'pelargir',          type:'normal' },
  // Purple – Helm's Deep
  { a:'umbar',         b:'pelargir',          type:'normal' },
  { a:'minas-tirith',  b:'edoras',            type:'normal' },
  { a:'harondor',      b:'south-ithilien',    type:'normal' },
  { a:'nurn',          b:'plateau-of-gorgoroth', type:'normal' },
  { a:'plateau-of-gorgoroth', b:'minas-morgul',  type:'special', cost:['stealth'] },
  { a:'minas-morgul',  b:'south-ithilien',    type:'special', cost:['stealth','stealth'] },
  // Teal – Erebor
  { a:'osgiliath',     b:'north-ithilien',    type:'normal' },
  { a:'north-ithilien',b:'dagorlad',          type:'normal' },
  { a:'dagorlad',      b:'emyn-muil',         type:'normal' },
  { a:'emyn-muil',     b:'brown-lands',       type:'normal' },
  { a:'brown-lands',   b:'dol-guldur',        type:'normal' },
  { a:'dol-guldur',    b:'southern-mirkwood', type:'normal' },
  { a:'southern-mirkwood', b:'old-forest-road', type:'normal' },
  { a:'old-forest-road',b:'woodland-realm',   type:'normal' },
  { a:'woodland-realm',b:'erebor',            type:'normal' },
  { a:'plateau-of-gorgoroth', b:'barad-dur',  type:'normal' },
  { a:'barad-dur',     b:'udun',              type:'special', cost:['stealth'] },
  { a:'udun',          b:'north-ithilien',    type:'special', cost:['stealth','stealth','stealth','stealth'] },
  { a:'moria',         b:'gladden-fields',    type:'normal' },
  { a:'gladden-fields',b:'carrock',           type:'normal' },
  { a:'carrock',       b:'old-forest-road',   type:'normal' },
  // Yellow – Minas Tirith
  { a:'plateau-of-gorgoroth', b:'mount-doom', type:'special', cost:['stealth','stealth'] },
  { a:'mount-doom',    b:'udun',              type:'special', cost:['stealth','stealth','stealth'] },
  { a:'dagorlad',      b:'rhun',              type:'normal' },
  { a:'gladden-fields',b:'dol-guldur',        type:'normal' },
  { a:'southern-mirkwood', b:'dagorlad',      type:'normal' },
  // Green4 – Anduin
  { a:'gladden-fields',b:'lorien',            type:'normal' },
  { a:'lorien',        b:'fangorn',           type:'normal' },
  { a:'fangorn',       b:'eastemnet',         type:'normal' },
  { a:'eastemnet',     b:'helms-deep',        type:'normal' },
  // Pink-c / Orange-e/f – Rhovanion
  { a:'rhun',          b:'dorwinion',         type:'normal' },
  { a:'dorwinion',     b:'lake-town',         type:'normal' },
  { a:'lake-town',     b:'iron-hills',        type:'normal' },
  { a:'iron-hills',    b:'erebor',            type:'normal' },
  { a:'dorwinion',     b:'southern-mirkwood', type:'normal' },
  { a:'old-forest-road',b:'lake-town',        type:'normal' },
  { a:'lake-town',     b:'erebor',            type:'normal' },

  // ── WHITE LINES (player traversal) ───────────────────────────────────────
  { a:'grey-havens',   b:'the-shire',         type:'normal' },
  { a:'the-shire',     b:'sarn-ford',         type:'normal' },
  { a:'hollin',        b:'rivendell',         type:'normal' },
  { a:'hollin',        b:'gladden-fields',    type:'special', cost:['resistance'] },
  { a:'rivendell',     b:'carrock',           type:'special', cost:['stealth'] },
  { a:'woodland-realm',b:'lake-town',         type:'normal' },
  { a:'iron-hills',    b:'dorwinion',         type:'normal' },
  { a:'dorwinion',     b:'dagorlad',          type:'normal' },
  { a:'dagorlad',      b:'brown-lands',       type:'normal' },
  { a:'dol-amroth',    b:'lamedon',           type:'normal' },
  { a:'erech',         b:'edoras',            type:'special', cost:['stealth'] },
  { a:'edoras',        b:'eastemnet',         type:'normal' },
  { a:'eastemnet',     b:'emyn-muil',         type:'normal' },
  { a:'emyn-muil',     b:'north-ithilien',    type:'special', cost:['resistance'] },
  { a:'emyn-muil',     b:'lorien',            type:'special', cost:['friendship'] },
  { a:'lorien',        b:'dol-guldur',        type:'normal' },
  { a:'minas-morgul',  b:'udun',              type:'normal' },
  { a:'mount-doom',    b:'barad-dur',         type:'normal' },
];

// ── BATTLE LINES ─────────────────────────────────────────────────────────────
// Shadow armies ONLY move along these routes, always advancing toward the last loc (friendly haven).
// Player characters can travel along battle line connections in either direction (no extra cost).
// Some battle line connections also appear in CONNECTIONS as 'special' (e.g. dol-amroth→grey-havens)
// meaning players must pay a symbol cost to traverse them — but shadow forces still advance freely.
// locs ordered: shadow start → ... → friendly haven
const BATTLE_LINES = [
  // GREY/PURPLE – Eriador Line
  { id:'grey',     color:'#7030a0', name:'Eriador Line',     locs:['dunland','tharbad','sarn-ford','bree','the-shire','ered-luin','grey-havens'] },

  // YELLOW – Rivendell Lines (2 routes)
  { id:'yellow',   color:'#c8b800', name:'Rivendell Line',   locs:['isengard','fords-of-isen','dunland','hollin','tharbad','bree','weather-hills','rivendell'] },
  { id:'yellow-b', color:'#c8b800', name:'Rivendell Line',   locs:['moria','hollin','tharbad','bree','weather-hills','rivendell'] },

  // ORANGE – Helm's Deep Lines (4 routes)
  { id:'orange',   color:'#c07010', name:'Rohan Line',       locs:['dunland','druwaith-lair','fords-of-isen','helms-deep'] },
  { id:'orange-b', color:'#c07010', name:'Rohan Line',       locs:['isengard','fords-of-isen','helms-deep'] },
  { id:'orange-c', color:'#c07010', name:'Rohan Line',       locs:['umbar','harondor','pelargir','lamedon','erech','pinnath-gelin','druwaith-lair','fords-of-isen','helms-deep'] },
  { id:'orange-d', color:'#c07010', name:'Rohan Line',       locs:['near-harad','harondor','pelargir','lamedon','erech','pinnath-gelin','druwaith-lair','fords-of-isen','helms-deep'] },

  // PINK – Grey Havens Lines (2 routes)
  { id:'pink',     color:'#d060a0', name:'Coastal Line',     locs:['umbar','harondor','pelargir','dol-amroth','grey-havens'] },
  { id:'pink-b',   color:'#d060a0', name:'Coastal Line',     locs:['isengard','fords-of-isen','helms-deep','edoras','druadan-forest','minas-tirith','osgiliath','south-ithilien','pelargir','dol-amroth','grey-havens'] },

  // PURPLE – Helm's Deep Lines (3 routes)
  { id:'purple',   color:'#7030a0', name:'Gondor Line',      locs:['umbar','pelargir','south-ithilien','osgiliath','minas-tirith','edoras','helms-deep'] },
  { id:'purple-b', color:'#7030a0', name:'Gondor Line',      locs:['near-harad','harondor','south-ithilien','osgiliath','minas-tirith','edoras','helms-deep'] },
  { id:'purple-c', color:'#7030a0', name:'Gondor Line',      locs:['nurn','plateau-of-gorgoroth','minas-morgul','south-ithilien','osgiliath','minas-tirith','edoras','helms-deep'] },

  // TEAL – Erebor Lines (3 routes)
  { id:'teal',     color:'#208080', name:'Erebor Line',      locs:['near-harad','harondor','south-ithilien','osgiliath','north-ithilien','dagorlad','emyn-muil','brown-lands','dol-guldur','southern-mirkwood','old-forest-road','woodland-realm','erebor'] },
  { id:'teal-b',   color:'#208080', name:'Erebor Line',      locs:['nurn','plateau-of-gorgoroth','barad-dur','udun','north-ithilien','dagorlad','emyn-muil','brown-lands','dol-guldur','southern-mirkwood','old-forest-road','woodland-realm','erebor'] },
  { id:'teal-c',   color:'#208080', name:'Erebor Line',      locs:['moria','gladden-fields','carrock','old-forest-road','woodland-realm','erebor'] },

  // YELLOW – Minas Tirith Lines (3 routes)
  { id:'yellow-c', color:'#c8b800', name:'Mordor Line',      locs:['nurn','plateau-of-gorgoroth','mount-doom','udun','north-ithilien','osgiliath','minas-tirith'] },
  { id:'yellow-d', color:'#c8b800', name:'Mordor Line',      locs:['rhun','dagorlad','north-ithilien','osgiliath','minas-tirith'] },
  { id:'yellow-e', color:'#c8b800', name:'Mordor Line',      locs:['gladden-fields','dol-guldur','southern-mirkwood','dagorlad','north-ithilien','osgiliath','minas-tirith'] },

  // PINK – Rhovanion Line (ends at woodland-realm)
  { id:'pink-c',   color:'#d060a0', name:'Rhovanion Line',   locs:['rhun','dorwinion','lake-town','iron-hills','erebor','woodland-realm'] },

  // ORANGE – Rhovanion Lines (end at woodland-realm)
  { id:'orange-e', color:'#c07010', name:'Rhovanion Line',   locs:['rhun','dorwinion','southern-mirkwood','old-forest-road','lake-town','erebor','woodland-realm'] },
  { id:'orange-f', color:'#c07010', name:'Rhovanion Line',   locs:['lake-town','erebor','woodland-realm'] },

  // GREEN – Misty Mountains / Anduin Lines
  { id:'green',    color:'#3a8c3f', name:'Misty Mountains Line', locs:['moria','hollin','weather-hills','rivendell'] },
  { id:'green4',   color:'#3a8c3f', name:'Anduin Green Line',    locs:['dol-guldur','gladden-fields','lorien','fangorn','eastemnet','helms-deep'] },
];

// ── CHARACTERS ───────────────────────────────────────────────────────────────
const CHARS = {
  'frodo-sam':      { name:'Frodo & Sam',   start:'the-shire',    region:'eriador',  color:'#f5c500',
                      ability:'Travel: spend 1 ★ or roll a search at destination. Elrond\'s Support: when Frodo Prepares at a haven in the card\'s region, also gain 1 ♥. Sam\'s Aid: spend 1 ♥ to ignore that many Weary/Exposed results per search. Put on the Ring: before a search, ignore all shadow troops — but lose 1 hope and shift Eye to Frodo\'s region.' },
  'merry-pippin':   { name:'Merry & Pippin',start:'the-shire',    region:'eriador',  color:'#dde030',
                      ability:'Loyal Friend (action): gain 1 ♥ from supply. Distract (any time, not action): if <4 Nazgûl in their region, spend 1 ♥ to move up to 2 Nazgûl there. Give Us a Song (action): if at Frodo\'s location, spend 3 ♥ to gain 2 hope.' },
  'aragorn':        { name:'Aragorn',        start:'weather-hills',region:'rhudaur',  color:'#c04020',
                      ability:'Range of the North: when a search is rolled, may reroll 1 search die. Captain of the West: each Rout removes up to 2 shadow troops (instead of 1). Andúril (action): if ≥1 objective completed, remove 1 shadow troop from Aragorn\'s location.' },
  'arwen':          { name:'Arwen',          start:'rivendell',    region:'rhudaur',  color:'#30a060',
                      ability:'Evenstar: Mustering in an Elven location costs no ♥. Send Aid: when Arwen Prepares, may move 1 Elven troop from her location to a character in the card\'s region. Give Counsel: when using Fellowship at a Haven, the card given/taken need not match her region. Solo: when Arwen Prepares, the discarded card need not match her region.' },
  'gandalf':        { name:'Gandalf',        start:'tharbad',      region:'enedwaith',color:'#b8b8b8',
                      ability:'Mithrandir: when Gandalf Musters, add up to 2 troops instead of 1. Shadowfax: when Gandalf travels alone, may move 2 locations (not via special paths). Light and Flame: when a battle is rolled, spend ⚔ to change that many dice to any result.' },
  'legolas':        { name:'Legolas',        start:'woodland-realm',region:'rhovanion',color:'#60d090',
                      ability:'Walk Silently (action): gain 1 ★ from supply. Sure Shot (any time, not action): spend 1 ★ to remove 1 shadow troop from Legolas\'s location or adjacent, OR move 1 Nazgûl from Legolas\'s region to Mordor. Keen Sight: when Legolas Prepares, look at top shadow card (and see the back of the card beneath it).' },
  'gimli':          { name:'Gimli',          start:'erebor',       region:'rhovanion',color:'#686868',
                      ability:'Son of Glóin: Mustering in a Dwarf location costs no ♥. Dwarven Craft (action): gain 1 ⚔ from supply.' },
  'boromir':        { name:'Boromir',        start:'minas-tirith', region:'gondor',   color:'#1a3570',
                      ability:'Heir to the Steward: Mustering in a Gondor location costs no ♥. Hero of Gondor: capture costs 1 fewer ⚔. Tempted by Power: Boromir may not give Resistance during Fellowship, and other players may not take Resistance from Boromir.' },
  'eowyn':          { name:'Éowyn',          start:'edoras',       region:'rohan',    color:'#a06030',
                      ability:'Shieldmaiden of Rohan: Mustering in a Rohan location costs no ♥. No Living Man Am I: if Éowyn is present when a battle is rolled, Nazgûl die results kill a Nazgûl permanently (removed from game) instead of killing 2 friendly troops.' },
  'eomer':          { name:'Éomer',          start:'eastemnet',    region:'rohan',    color:'#6a3010',
                      ability:'Rider of Rohan: once per turn, Éomer may take 1 bonus Travel action. It must happen before or after his normal actions — once another character acts, the bonus is forfeited.' },
  'galadriel':      { name:'Galadriel',      start:'lorien',       region:'rohan',    color:'#0d5030',
                      ability:'Lady of Light (any time, not action): while at a haven, spend 1 ★ to draw a random unused event card into hand. Mirror of Galadriel (action): look at top 4 player deck cards and return them in any order. Nenya: if Galadriel + ≥1 Elven troop are present when a battle is rolled, may reroll 1 battle die.' },
  'faramir':        { name:'Faramir',        start:'minas-tirith', region:'gondor',   color:'#3a5faa',
                      ability:'Ambush: when Faramir travels with ≥1 friendly troop at his origin, he may make a bonus attack at his destination — roll first, then spend ★ to convert that many dice to Rout. Stealthy: when Faramir travels a special path, spend 1 fewer symbol. Wisdom of the Eldar (action): if at a haven, take a ◎ region card matching Faramir\'s region from the player discard pile.' },
  'gollum':         { name:'Gollum',         start:'moria',        region:'misty-mountains', color:'#909070',
                      ability:'Restrictions: Gollum cannot muster, attack, capture, or bring friendly troops when he travels (he may bring other characters normally). Corruption: whenever Gollum, Frodo & Sam, or friendly troops enter or are added to a location, lose 1 hope if all three are present there at that moment. Guide (passive): if Gollum is present when a search is rolled, roll 3 fewer dice (apply before capping at 7). Slinker (action, once per turn): take any stealth card from the player discard pile into hand. Cunning: Gollum may use the Prepare action even when not at a haven; when he does, you may move 1 shadow troop at his location to an adjacent location (no battle roll).' },
};

// ── REGION CARDS (player deck) ───────────────────────────────────────────────
function makeRegionCards() {
  const cards = [];
  const syms = ['friendship','valor','stealth','resistance'];
  // Each entry: [location, symbol]
  const entries = [
    ['grey-havens','friendship'],['grey-havens','stealth'],
    ['ered-luin','friendship'],['ered-luin','valor'],
    ['the-shire','stealth'],['the-shire','friendship'],
    ['bree','stealth'],
    ['weather-hills','stealth'],['weather-hills','valor'],
    ['tharbad','stealth'],['tharbad','resistance'],
    ['dunland','resistance'],
    ['rivendell','friendship'],['rivendell','resistance'],
    ['hollin','stealth'],['hollin','friendship'],
    ['moria','resistance'],['moria','stealth'],
    ['lorien','friendship'],['lorien','resistance'],
    ['dol-guldur','resistance'],['dol-guldur','stealth'],
    ['woodland-realm','friendship'],['woodland-realm','stealth'],
    ['erebor','friendship'],['erebor','valor'],
    ['iron-hills','valor'],['iron-hills','friendship'],
    ['rhun','resistance'],
    ['isengard','stealth'],
    ['helms-deep','valor'],['helms-deep','stealth'],
    ['fangorn','valor'],
    ['edoras','friendship'],['edoras','valor'],
    ['eastemnet','friendship'],['eastemnet','resistance'],
    ['minas-tirith','valor'],['minas-tirith','friendship'],
    ['dol-amroth','valor'],
    ['pelargir','valor'],
    ['minas-morgul','resistance'],
    ['barad-dur','resistance'],
    ['mount-doom','resistance'],
    ['nurn','resistance'],
    ['near-harad','stealth'],
    ['umbar','resistance'],
  ];
  entries.forEach((e,i) => cards.push({ id:`rc${i}`, type:'region', location:e[0], symbol:e[1],
    name: LOCS[e[0]].name, display:`${LOCS[e[0]].name} (${SYM[e[1]].icon})` }));
  return cards;
}

// ── EVENT CARDS ──────────────────────────────────────────────────────────────
const EVENT_CARDS = [
  { id:'ev0',  type:'event', name:'The Eagles Are Coming!',  display:'The Eagles Are Coming!',
    text:'Move 1 character to any location. If Frodo is moved, move the 7 closest Nazgûl directly to his region, shift the Eye there, and roll a search.',
    effect:'eagle' },
  { id:'ev1',  type:'event', name:'Gifts from the Elves',   display:'Gifts from the Elves',
    text:'1 player gains 1 token of any symbol type.',
    effect:'gifts-elves' },
  { id:'ev2',  type:'event', name:'Elven Cloaks and Rope',  display:'Elven Cloaks and Rope',
    text:'Select a character. That character may travel alone up to 2 times this turn and does not roll searches when doing so.',
    effect:'elven-cloaks' },
  { id:'ev3',  type:'event', name:'Gwaihir Brings News',    display:'Gwaihir Brings News',
    text:'Select a location adjacent to friendly troops. Move 1 or more of those troops to that location (they may not use special paths). Optionally roll a battle there; if you do, move the Eye to that location. (Do not offer the battle roll if no shadow troops are present.)',
    effect:'gwaihir' },
  { id:'ev4',  type:'event', name:'Lembas',                 display:'Lembas',
    text:'The current player takes 2 extra actions this turn. Choose which character receives them (if your first character is already done, the second receives them automatically).',
    effect:'lembas' },
  // TODO: verify exact wording against rulebook
  { id:'ev5',  type:'event', name:'The Last March of the Ents', display:'The Last March of the Ents',
    text:'Spawn up to 3 Elven troops in Fangorn Forest from the supply (as many as are available). Those troops, and any player characters at Fangorn Forest, may then be moved to Isengard. You may then fight a battle at Isengard.',
    effect:'ents-march' },
  // TODO: 8 more event cards unknown — game has 14 total
];

// ── SKIES DARKEN CARDS ───────────────────────────────────────────────────────
const SKIES_DARKEN = [
  { id:'sd0', type:'skies-darken', name:'Shadow Grows',
    text:'Increase the threat rate marker 1 space on the threat rate track.',
    effect:'shadow-grows' },
  { id:'sd1', type:'skies-darken', name:'I See You!',
    text:'If the Eye of Sauron is in Frodo\'s region, lose 2 hope. Otherwise, shift the Eye to Frodo\'s region.',
    effect:'i-see-you' },
  { id:'sd2', type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'minas-morgul' },
  { id:'sd3', type:'skies-darken', name:'The Danger Intensifies',
    text:'Shuffle the shadow discard pile and place it face-down on top of the shadow deck.',
    effect:'danger-intensifies' },
  { id:'sd4', type:'skies-darken', name:'Shadow Grows',
    text:'Increase the threat rate marker 1 space on the threat rate track.',
    effect:'shadow-grows' },
  { id:'sd5', type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'rhun' },
  // TODO: verify all 7 of these stronghold cards against the physical rulebook
  { id:'sd6',  type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'isengard' },
  { id:'sd7',  type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'udun' },
  { id:'sd8',  type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'minas-morgul' },
  { id:'sd9',  type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'barad-dur' },
  { id:'sd10', type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'dol-guldur' },
  { id:'sd11', type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'moria' },
  { id:'sd12', type:'skies-darken', name:'Under Cover of Darkness',
    text:'Add 3 shadow troops to the location indicated on this card.',
    effect:'under-cover', location:'umbar' },
];

// ── OBJECTIVES ───────────────────────────────────────────────────────────────
const OBJECTIVES = [
  {
    id: 'destroy-ring',
    name: 'Destroy the One Ring',
    required: true,
    requiredChars: ['frodo-sam'],
    setup: null,
    setupTroops: 0,
    completeIf: 'All other objectives done. Frodo at Mount Doom. Spend 5 symbols, then roll (1 die per Nazgûl/shadow troop at Mt Doom + per missing hope, max 7).',
    whenCompleted: 'Sauron is defeated — players win!',
  },
  {
    id: 'blessing-elves',
    name: 'Attain the Blessing of the Elves',
    required: false,
    requiresChar: null,
    setup: 'Place 3 Elven troops on this card. They cannot be used until this objective is completed.',
    setupTroops: 3, setupTroopType: 'elven',
    completeIf: 'Action: a character in Rivendell spends 3 ♥ while at least 1 other character is also present.',
    whenCompleted: 'Troops return to supply. Each player with a character at Rivendell gains 1 ◎. Gain 1 hope.',
  },
  {
    id: 'frecas-heirs',
    name: "Freca's Heirs",
    required: false,
    requiresChar: null,
    setup: null,
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Action (Dunland): spend 3 ⚔ or 3 ♥ to make Dunland a haven. Then: Dunland must be a haven AND have ≥2 Rohirrim troops.',
    whenCompleted: 'Add 1 Rohirrim to Dunland. If shadow forces later overrun Dunland: lose 3 hope and remove the haven token.',
  },
  {
    id: 'boromirs-honor',
    name: "Boromir's Honor",
    required: false,
    requiresChar: 'boromir',
    setup: 'Boromir must be assigned during setup.',
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Automatic: Boromir and ≥1 other character are present when the last friendly troop at their location is removed in battle.',
    whenCompleted: 'Remove up to 2 shadow troops from Boromir\'s location. Boromir is removed from the board. When the next objective completes, draw a random unassigned character to replace him (no replacement in 7-player games).',
  },
  {
    id: 'theodens-mind',
    name: "Théoden's Mind",
    required: false,
    requiresChar: null,
    setup: 'Place 4 Rohirrim troops on this card. They cannot be used until this objective is completed.',
    setupTroops: 4, setupTroopType: 'rohirrim',
    completeIf: 'Action: a character in Edoras spends 2 ♥ and 1 ◎ while ≥1 other character is also in Edoras.',
    whenCompleted: 'Reserved troops return to supply. Add up to 2 Rohirrim to Edoras. Gain 1 hope.',
  },
  {
    id: 'saruman-staff',
    name: 'Saruman, Your Staff Is Broken',
    required: false,
    requiredChars: null,
    setup: null,
    setupTroops: 0,
    completeIf: 'Action (any character, any location): when Isengard is a captured haven AND every Rohan location is free of shadow troops and shadow strongholds.',
    whenCompleted: 'Current player gains 1 ◎ (Resistance).',
  },
  {
    id: 'challenge-sauron',
    name: 'Challenge Sauron',
    required: false,
    requiredChars: null,
    setup: null,
    setupTroops: 0,
    completeIf: 'Action (any character in North Ithilien): at least 3 Gondor, 2 Elven, and 2 Dwarven troops present at North Ithilien.',
    whenCompleted: 'Shift the Eye to North Ithilien\'s region. Move every shadow troop in Mordor to Udûn.',
  },
  {
    id: 'hobbits-pledge',
    name: 'Hobbits Pledge Their Loyalty',
    required: false,
    requiresChar: 'merry-pippin',
    setup: 'This card has 4 categories: Elf (Grey Havens/Rivendell/Lórien/Woodland Realm), Rohan (Helm\'s Deep), Dwarf (Erebor), Gondor (Minas Tirith/Dol Amroth).',
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Action (Merry & Pippin): at a qualifying haven, discard 1 region card matching that haven\'s region to place a ♥ on that category. When 2 different categories have ♥, complete.',
    whenCompleted: 'Gain 1 hope. Merry & Pippin each gain 1 ♥.',
  },
  {
    id: 'shieldmaiden',
    name: 'Shieldmaiden No Longer',
    required: false,
    requiresChar: 'eowyn',
    setup: null,
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Passive: while incomplete, Éowyn may spend 2 ⚔ during a battle to change 1 die result to Nazgûl. Auto-complete: 2 Nazgûl slain by Éowyn AND Rohan is free of all shadow troops and strongholds.',
    whenCompleted: 'Gain 1 hope. (Éowyn\'s spend-valor battle ability becomes unavailable.)',
  },
  {
    id: 'confront-balrog',
    name: 'Confront the Balrog',
    required: false,
    requiresChar: 'gandalf',
    setup: null,
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Action (Gandalf in Moria): roll 3 battle dice. Lose hope: 1 per ☠, 2 per ⚔, 3 per 🗡. Spend ◎ to ignore 1 die; spend ⚔ to reduce hope loss by 1. On resolve: Gandalf is removed from the board.',
    whenCompleted: 'When the next Skies Darken card is drawn: Gandalf the White spawns in Lórien and gains Light and Flame (if present when a battle is rolled, spend 1 ⚔ to set any number of dice to any result).',
  },
  {
    id: 'infiltrate-minas-morgul',
    name: 'Infiltrate Minas Morgul',
    required: false,
    requiresChar: null,
    setup: 'Place 1 additional shadow troop in Minas Morgul.',
    setupTroops: 0, setupTroopType: null,
    setupShadowLoc: 'minas-morgul',
    completeIf: 'Capture Minas Morgul: spend 3 ⚔ (Valor) as normal, OR 3 ★ (Stealth) as an alternative when this objective is active. Complete when Minas Morgul is a captured haven.',
    whenCompleted: 'Current player gains 2 ★. Look at the top 2 shadow cards; remove 0, 1, or both from the game; return kept cards to top in any order.',
  },
  {
    id: 'that-makes-six',
    name: 'That Makes Six',
    required: false,
    requiresChar: 'legolas',
    setup: 'Legolas must be assigned.',
    setupTroops: 0, setupTroopType: null,
    heldTroops: 0,
    completeIf: 'When Legolas uses Sure Shot to remove a shadow troop, he may place it on this card instead of returning it to supply. Complete when 6 shadow troops are on this card.',
    whenCompleted: 'Return the 6 held troops to supply. Gain 1 hope.',
  },
  {
    id: 'oathbreakers-duty',
    name: 'Oathbreakers Fulfill Their Duty',
    required: false,
    requiresChar: 'aragorn',
    setup: 'Aragorn must be assigned.',
    setupTroops: 0, setupTroopType: null,
    aragornCalledOaths: false,
    completeIf: 'Special (once per game, costs 1 action): Aragorn travels Edoras → Erech without spending Stealth. When he does: +2 shadow troops to Pelargir, all Umbar shadow troops move to Pelargir, add up to 3 Gondor troops to Erech. Complete when this has been done AND all Gondor locations are free of shadow troops and strongholds.',
    whenCompleted: 'Gain 1 hope.',
  },
  {
    id: 'unseat-denethor',
    name: 'Unseat Denethor',
    required: false,
    requiresChar: null,
    setup: 'Place 4 Gondor troops from the supply onto this card. They cannot be used until the objective is completed.',
    setupTroops: 4, setupTroopType: 'gondor',
    completeIf: 'Action: any character in Minas Tirith (with ≥1 other character present) spends 2 ★ + 1 ♥ + 1 ⚔.',
    whenCompleted: 'Return held Gondor troops to supply. Add up to 3 Gondor troops to Minas Tirith from supply. Gain 1 hope.',
  },
  {
    id: 'ride-with-eored',
    name: 'Ride with the Éored',
    required: false,
    requiresChar: 'eomer',
    setup: 'Éomer must be assigned.',
    setupTroops: 0, setupTroopType: null,
    slotsFilled: {},
    completeIf: 'When Éomer attacks with ≥1 Rohirrim troop present and removes ≥1 shadow troop, you may place that troop on this card\'s slot for the current region (Rohan, Misty Mountains, Mirkwood, Gondor, Rhovanion, Enedwaith, or Ithilien). Each slot holds 1 troop; complete when 4 different slots are filled.',
    whenCompleted: 'Return held shadow troops to supply. Gain 1 hope.',
  },
  {
    id: 'secure-osgiliath',
    name: 'Secure the Crossing of the Anduin',
    required: false,
    requiresChar: 'faramir',
    setup: 'Faramir must be assigned. Place 1 shadow troop in Osgiliath.',
    setupTroops: 0, setupTroopType: null,
    setupShadowLoc: 'osgiliath',
    completeIf: 'Action (Faramir in Osgiliath, ≥1 friendly troop present, no shadow troops): spend 3 ⚔, OR 2 ◎ + 1 ★. Osgiliath becomes a haven. Objective is only available while active.',
    whenCompleted: 'You may add 1 Gondor troop to Osgiliath. Warning: if shadow forces later drive out all friendly troops, the haven is lost and you lose 3 hope. It cannot be recaptured.',
  },
  {
    id: 'arwen-banner',
    name: 'Arwen Unfurls the Banner',
    required: false,
    requiresChar: 'arwen',
    setup: 'Arwen must be assigned.',
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Action (Arwen in Minas Tirith, which must be a haven): spend 1 ♥. At least 1 Gondor, 1 Rohirrim, 1 Elven, and 1 Dwarven troop must be present.',
    whenCompleted: 'Gain 1 hope.',
  },
  {
    id: 'lift-shadow-dwarven',
    name: 'Lift Shadow from Dwarven Lands',
    required: false,
    requiresChar: 'gimli',
    setup: 'Gimli must be assigned. Place 1 shadow troop in Ered Luin.',
    setupTroops: 0, setupTroopType: null,
    setupShadowLoc: 'ered-luin',
    completeIf: 'Auto-complete: Ered Luin has no shadow troops AND ≥4 Dwarven troops; AND Lake Town (Dale) has no shadow troops and is not a shadow stronghold.',
    whenCompleted: 'Gain 1 hope. Current player may gain 2 ⚔ (Valor) from supply.',
  },
  {
    id: 'avenge-balin',
    name: 'Avenge Balin',
    required: false,
    requiresChar: null,
    setup: null,
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Auto-complete: Moria is a captured haven AND has ≥2 Dwarven troops present.',
    whenCompleted: 'Move any number of Dwarven troops from other locations to Moria. If Moria then has ≥4 Dwarven troops, the current player may gain 2 ⚔ (Valor) from the supply.',
  },
  {
    id: 'bring-light-mirkwood',
    name: 'Bring Light to Mirkwood',
    required: false,
    requiresChar: null,
    setup: 'Place 1 shadow troop in Old Forest Road and 1 in Southern Mirkwood.',
    setupTroops: 0, setupTroopType: null,
    setupShadowLocs: { 'old-forest-road': 1, 'southern-mirkwood': 1 },
    completeIf: 'Auto-complete: every Mirkwood location (Woodland Realm, Old Forest Road, Southern Mirkwood) has ≥1 Elven troop AND no shadow troops.',
    whenCompleted: 'Gain 1 hope. Select a Mirkwood location; move any number of Elven troops from the other Mirkwood locations there.',
  },
  {
    id: 'shelobs-lair',
    name: "Shelob's Lair",
    required: false,
    requiresChar: 'frodo-sam',
    setup: 'Gollum must be assigned. In a multiplayer game, the Frodo & Sam player may not also control Gollum.',
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Action (Frodo & Sam in Minas Morgul): roll 3 battle dice. Lose hope: ⚔ Exchange=2, ☠ Overrun=1, 🗡 Nazgûl=3. Also lose 1 hope per Resistance card or token the Gollum player has (solo: per Resistance card in Frodo\'s hand). Spend ⚔ to ignore 1 die; spend ♥ to reduce 1 hope loss.',
    whenCompleted: 'If Frodo & Sam lost 0 hope from this, they gain 1 bonus action this turn.',
  },
  {
    id: 'lay-bare-pits',
    name: 'Lay Bare the Pits',
    required: false,
    requiresChar: 'galadriel',
    setup: 'Galadriel must be assigned. Place 1 additional shadow troop in Dol Guldur.',
    setupTroops: 0, setupTroopType: null,
    setupShadowLoc: 'dol-guldur',
    completeIf: 'Galadriel captures Dol Guldur (3 ⚔, OR 2 ◎ + 1 ⚔ as alternatives for this objective). THEN: Dol Guldur is a haven AND has ≥3 Elven troops present.',
    whenCompleted: 'If Galadriel is in Dol Guldur: gain 1 additional hope (beyond the 2 from capturing).',
  },
  {
    id: 'subdue-umbar',
    name: 'Subdue Umbar',
    required: false,
    requiresChar: null,
    setup: null,
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Auto-complete: EITHER Umbar is a captured haven; OR every Haradwaith location (Umbar, Near Harad, Harondor) has ≥1 friendly troop AND no shadow troops.',
    whenCompleted: 'Move any number of friendly troops from Haradwaith (Umbar, Near Harad, Harondor) to Pelargir.',
  },
  {
    id: 'rangers-eriador',
    name: 'Rangers Secure Eriador',
    required: false,
    requiresChar: null,
    setup: null,
    setupTroops: 0, setupTroopType: null,
    completeIf: 'Auto-complete: Eriador is free of shadow troops and shadow strongholds, AND at least 1 friendly troop is present in every Eriador location.',
    whenCompleted: 'Gain 1 hope. Move any number of friendly troops in Eriador to Tharbad or Weather Hills.',
  },
];

// ── SHADOW DECK ──────────────────────────────────────────────────────────────
// Each card: advance specified battle lines, spawn 1 troop at spawnLoc, trigger nazgulOrder.
// nazgulOrder: 'search' = move closer + roll search if already in Frodo's region
//              'move-closest' = move the Nazgûl closest to Frodo from outside his region
//              'deploy-recall' = deploy from Mordor to Eye region; recall if Eye=Mordor
const SHADOW_CARDS_BASE = [
  { id:'sw1', type:'shadow', name:'Moria & Erebor',
    battleLines:['green','blue'],       spawnLoc:'moria',     nazgulOrder:'search' },
  { id:'sw2', type:'shadow', name:'Dol Guldur & Minas Tirith',
    battleLines:['purple','red'],       spawnLoc:'dol-guldur', nazgulOrder:'move-closest' },
  { id:'sw3', type:'shadow', name:'Dunland & Grey Havens',
    battleLines:['yellow','grey'],      spawnLoc:'dunland',   nazgulOrder:'search' },
  { id:'sw4', type:'shadow', name:'Dol Guldur & Erebor',
    battleLines:['purple','blue'],      spawnLoc:'dol-guldur', nazgulOrder:'move-closest' },
  { id:'sw5', type:'shadow', name:'Rhûn & Woodland Realm',
    battleLines:['blue','teal-c'],      spawnLoc:'rhun',      nazgulOrder:'deploy-recall' },
  { id:'sw6', type:'shadow', name:'Moria & Rivendell',
    battleLines:['green'],             spawnLoc:'moria',     nazgulOrder:'deploy-recall' },
  { id:'sw7', type:'shadow', name:'Nûrn & Minas Tirith',
    battleLines:['red'],               spawnLoc:'nurn',      nazgulOrder:'move-closest' },
  { id:'sw8', type:'shadow', name:"Nûrn & Helm's Deep",
    battleLines:['red','orange'],      spawnLoc:'nurn',      nazgulOrder:'search' },
  { id:'sw9', type:'shadow', name:"Umbar & Helm's Deep",
    battleLines:['pink','orange'],     spawnLoc:'umbar',     nazgulOrder:'deploy-recall' },
];

function makeShadowDeck() {
  // Two copies → 18 cards: 9 drawn during setup (troops only), 9 remain for gameplay
  return shuffle([
    ...SHADOW_CARDS_BASE.map(c => ({...c, id: c.id+'a'})),
    ...SHADOW_CARDS_BASE.map(c => ({...c, id: c.id+'b'})),
  ]);
}

// ── SHADOW LIEUTENANTS ───────────────────────────────────────────────────────
// Each lieutenant added at even legendary+ thresholds (2+, 4+, 6+, 8+, 10+)
const SHADOW_LIEUTENANTS = [
  {
    id: 'witch-king',
    name: 'Witch-king of Angmar',
    spawnNote: 'Secretly replaces one of the 9 Nazgûl at game start.',
    ability: 'Hidden: players do not know which Nazgûl is the Witch-king. Reveals when combat involves a player character in his region. Nullifies all combat modifiers (character abilities, Valor, Resistance) — exception: Éowyn\'s Nazgûl-kill ability still works. When multiple Nazgûl move, randomly select who moves (Witch-king vs. regular).',
  },
  {
    id: 'saruman-lt',
    name: 'Saruman',
    spawnLoc: 'isengard',
    spawnNote: 'Spawns in Isengard at game start (in addition to normal troops).',
    ability: 'Does not move. While alive, 1 Rohirrim troop that would start in reserve is instead unavailable (returns when Saruman is killed). Taken as casualty last among shadow troops; if multiple lieutenants eligible, players choose.',
  },
  {
    id: 'lurtz',
    name: 'Lurtz',
    spawnLoc: 'isengard',
    spawnNote: 'Spawns in Isengard instead of a regular troop at game start.',
    ability: 'Only taken as casualty when all other shadow troops at location are dead. If Lurtz is in combat: player characters can be casualties, but only after all friendly troops are dead. Players choose which character dies (Frodo cannot be chosen unless he is the only character; if Frodo would die, he instead is forced to use his ring-bearing ability).',
  },
  {
    id: 'mouth-of-sauron',
    name: 'Mouth of Sauron',
    spawnLoc: 'barad-dur',
    spawnNote: 'Spawns at Barad-dûr at game start. Stays within Mordor-region locations (players track manually).',
    ability: 'Dark Emissary: Once per shadow draw phase, players must collectively spend 1 stealth OR discard 1 card from hand. He does not leave Mordor — players must pursue him there to end the tribute.',
  },
  {
    id: 'gothmog',
    name: 'Gothmog',
    spawnLoc: 'nurn',
    spawnNote: 'Spawns at Nûrn at game start.',
    ability: 'Iron Discipline: In any battle where shadow troops outnumber friendly troops at the start, friendly troops suffer +1 extra casualty after all dice are resolved. Commander\'s Reinforcement: Whenever a shadow card spawns a troop at a Mordor-region location, spawn 1 additional troop there.',
  },
];

// ── FREE PEOPLES LIEUTENANTS ──────────────────────────────────────────────────
// Unlocked via legacy boons. Act each round (2 actions) before player 1.
const FREE_PEOPLES_LIEUTENANTS = [
  {
    id: 'haldir',
    name: 'Haldir of Lórien',
    troopType: 'elven',
    spawnLoc: 'helms-deep',
    startTroops: 2,
    maxTroops: 3,
    allowedLocs: ['helms-deep', 'fords-of-isen'],
    spawnTrigger: 'shadow-at',  // activates when shadow first reaches any allowedLoc
    color: '#5ab85a',
    passiveName: "Lórien's Arrow",
    passiveDesc: "When Haldir attacks, he may target shadow troops at his current location OR at any other location in his allowed range (Helm's Deep / Fords of Isen).",
  },
  {
    id: 'cirdan',
    name: 'Círdan the Shipwright',
    troopType: 'elven',
    spawnLoc: 'grey-havens',
    startTroops: 2,
    maxTroops: 3,
    allowedLocs: ['grey-havens'],
    spawnTrigger: null,  // activates immediately at game start via boon
    color: '#4a90d0',
    passiveName: 'Ancient Ships',
    passiveDesc: 'Once per round, a character at Grey Havens or Pelargir may move up to 2 friendly troops to the other coastal location at no action cost.',
  },
  {
    id: 'dain',
    name: 'Dáin Ironfoot',
    troopType: 'dwarven',
    spawnLoc: 'erebor',
    startTroops: 2,
    maxTroops: 3,
    allowedLocs: ['erebor', 'lake-town'],
    spawnTrigger: null,
    color: '#b07840',
    passiveName: "Ironfoot's Stand",
    passiveDesc: "While Dáin is active, dwarven troops at Erebor or Lake Town require 2 shadow casualties to remove 1 (shadow must land two hits on the same troop).",
  },
];

// ── UTILS ────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
