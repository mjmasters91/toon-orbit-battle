/* Toon Orbit Battle — original card set. All characters, names and art are original. */
(function (root) {
  // Power schema (interpreted by engine.js):
  //  {type:'boost', op:'add'|'mul', n, who, filter?, cond?, each?}
  //    who: 'self' | 'all' (every live card in play, both boards, incl. self if it matches)
  //         'allOther' | 'neighbors' (own touching slots) | 'opposite' (card facing it)
  //         'neighborsOrOpposite'
  //    cond: {kind:'nextTo'|'inPlay', filter}   each: {where:'inPlay'|'neighbors', filter}
  //  {type:'recolor', color, who:'neighbors'}
  //  filter: {color, feature, notFeature, char, group}
  const C = [];
  const add = (o) => C.push(o);
  // ---------- GALAXY GANG ----------
  add({id:'zoomer', name:'Captain Zoomer', char:'Zoomer', group:'Galaxy Gang', pts:10, color:'green', features:['Male','Hero'], power:'No Power', powers:[],
       art:{head:'round', skin:'#ffd9b3', hair:'#ffcc00', acc:'helmet', eyes:'big', mouth:'grin'}});
  add({id:'zoomer_jet', name:'Zoomer Jetpack', char:'Zoomer', group:'Galaxy Gang', pts:4, color:'yellow', features:['Male','Hero'], power:'+3 to each neighboring Hero',
       powers:[{type:'boost',op:'add',n:3,who:'neighbors',filter:{feature:'Hero'}}], art:{head:'round', skin:'#ffd9b3', hair:'#ffcc00', acc:'jetpack', eyes:'big', mouth:'open'}});
  add({id:'nell', name:'Nova Nell', char:'Nell', group:'Galaxy Gang', pts:8, color:'yellow', features:['Female','Hero'], power:'No Power', powers:[],
       art:{head:'round', skin:'#c98b5a', hair:'#ff4fa3', acc:'pigtails', eyes:'lash', mouth:'smile'}});
  add({id:'bleep', name:'Bleep-O', char:'Bleep', group:'Galaxy Gang', pts:1, color:'silver', features:['Prop'], power:'+3 to any Galaxy Gang member',
       powers:[{type:'boost',op:'add',n:3,who:'allOther',filter:{group:'Galaxy Gang'}}], art:{head:'square', skin:'#cfd8e3', acc:'antenna', eyes:'robot', mouth:'grill'}});
  add({id:'gravitron', name:'Prof. Gravitron', char:'Gravitron', group:'Galaxy Gang', pts:7, color:'purple', features:['Male','Villain'], power:'-5 to opposing card, if it is a Hero',
       powers:[{type:'boost',op:'add',n:-5,who:'opposite',filter:{feature:'Hero'}}], art:{head:'egg', skin:'#9be37a', acc:'brain', eyes:'angry', mouth:'frown'}});
  add({id:'astropup', name:'Astro Pup', char:'Astro Pup', group:'Galaxy Gang', pts:3, color:'blue', features:['Animal'], power:'x3 if next to any Zoomer',
       powers:[{type:'boost',op:'mul',n:3,who:'self',cond:{kind:'nextTo',filter:{char:'Zoomer'}}}], art:{head:'dog', skin:'#d9a066', acc:'bubble', eyes:'big', mouth:'tongue'}});
  add({id:'starhopper', name:'The Starhopper', char:'Starhopper', group:'Galaxy Gang', pts:8, color:'black', features:['Vehicle'], power:'No Power', powers:[],
       art:{kind:'rocket'}});
  add({id:'lunara', name:'Queen Lunara', char:'Lunara', group:'Galaxy Gang', pts:2, color:'silver', features:['Female','Villain'], power:'+10 if next to Prof. Gravitron',
       powers:[{type:'boost',op:'add',n:10,who:'self',cond:{kind:'nextTo',filter:{char:'Gravitron'}}}], art:{head:'tall', skin:'#b9b2ff', hair:'#3a2a7a', acc:'crown', eyes:'lash', mouth:'smirk'}});
  add({id:'cometkid', name:'Comet Kid', char:'Comet Kid', group:'Galaxy Gang', pts:5, color:'red', features:['Male','Hero'], power:'+1 for each other Hero in play',
       powers:[{type:'boost',op:'add',n:1,who:'self',each:{where:'inPlay',filter:{feature:'Hero'}}}], art:{head:'round', skin:'#ffe0c2', hair:'#ff5a1f', acc:'flamehair', eyes:'big', mouth:'grin'}});
  // ---------- SPOOKY HOLLOW ----------
  add({id:'gloop', name:'Gloop', char:'Gloop', group:'Spooky Hollow', pts:9, color:'black', features:['Monster'], power:'No Power', powers:[],
       art:{head:'blob', skin:'#7be05a', eyes:'one', mouth:'open'}});
  add({id:'fangly', name:'Count Fangly', char:'Fangly', group:'Spooky Hollow', pts:7, color:'purple', features:['Male','Villain','Monster'], power:'+5 if Batwing Bertha is in play',
       powers:[{type:'boost',op:'add',n:5,who:'self',cond:{kind:'inPlay',filter:{char:'Bertha'}}}], art:{head:'tall', skin:'#e6e6f0', hair:'#111', acc:'cape', eyes:'angry', mouth:'fangs'}});
  add({id:'bertha', name:'Batwing Bertha', char:'Bertha', group:'Spooky Hollow', pts:4, color:'red', features:['Female','Monster','Animal'], power:'+2 for each Monster in play',
       powers:[{type:'boost',op:'add',n:2,who:'self',each:{where:'inPlay',filter:{feature:'Monster'}}}], art:{head:'round', skin:'#6b4a8c', acc:'batwings', eyes:'lash', mouth:'fangs'}});
  add({id:'wisp', name:'Wanda Wisp', char:'Wanda', group:'Spooky Hollow', pts:5, color:'blue', features:['Female','Monster'], power:'+4 for each neighboring Purple card',
       powers:[{type:'boost',op:'add',n:4,who:'self',each:{where:'neighbors',filter:{color:'purple'}}}], art:{head:'ghost', skin:'#eaf6ff', eyes:'lash', mouth:'o'}});
  add({id:'manor', name:'Hollow Manor', char:'Hollow Manor', group:'Spooky Hollow', pts:2, color:'silver', features:['Place'], power:'+3 to all Monster cards',
       powers:[{type:'boost',op:'add',n:3,who:'all',filter:{feature:'Monster'}}], art:{kind:'house'}});
  add({id:'bonesy', name:'Bonesy', char:'Bonesy', group:'Spooky Hollow', pts:6, color:'green', features:['Male','Monster'], power:'No Power', powers:[],
       art:{head:'skull', skin:'#f4f1e6', eyes:'hollow', mouth:'teeth'}});
  add({id:'timid', name:'Timid Tim', char:'Tim', group:'Spooky Hollow', pts:7, color:'orange', features:['Male'], power:'-2 to all Monster cards',
       powers:[{type:'boost',op:'add',n:-2,who:'all',filter:{feature:'Monster'}}], art:{head:'round', skin:'#ffd9b3', hair:'#6b3d1f', acc:'sweat', eyes:'scared', mouth:'wobble'}});
  add({id:'pumpkin', name:'Pumpkin Pete', char:'Pete', group:'Spooky Hollow', pts:3, color:'orange', features:['Male','Villain'], power:'x2 if next to Hollow Manor',
       powers:[{type:'boost',op:'mul',n:2,who:'self',cond:{kind:'nextTo',filter:{char:'Hollow Manor'}}}], art:{head:'pumpkin', skin:'#ff8a00', eyes:'tri', mouth:'jack'}});
  // ---------- BARNYARD BONKERS ----------
  add({id:'hank', name:'Hank the Hog', char:'Hank', group:'Barnyard Bonkers', pts:10, color:'red', features:['Male','Animal'], power:'No Power', powers:[],
       art:{head:'pig', skin:'#ffaec9', eyes:'dot', mouth:'grin'}});
  add({id:'hank_mud', name:'Hank Mudbath', char:'Hank', group:'Barnyard Bonkers', pts:5, color:'blue', features:['Male','Animal'], power:'+5 to each neighboring Animal',
       powers:[{type:'boost',op:'add',n:5,who:'neighbors',filter:{feature:'Animal'}}], art:{head:'pig', skin:'#c98b6a', acc:'mud', eyes:'happy', mouth:'smile'}});
  add({id:'clara', name:'Clucky Clara', char:'Clara', group:'Barnyard Bonkers', pts:1, color:'yellow', features:['Female','Animal'], power:'+3 to all Yellow cards',
       powers:[{type:'boost',op:'add',n:3,who:'all',filter:{color:'yellow'}}], art:{head:'chick', skin:'#fff3a8', eyes:'lash', mouth:'beak'}});
  add({id:'moomax', name:'Moo-Moo Max', char:'Max', group:'Barnyard Bonkers', pts:8, color:'green', features:['Male','Animal'], power:'No Power', powers:[],
       art:{head:'cow', skin:'#ffffff', eyes:'dot', mouth:'snout'}});
  add({id:'fritz', name:'Farmer Fritz', char:'Fritz', group:'Barnyard Bonkers', pts:2, color:'silver', features:['Male'], power:'+2 to all Green cards',
       powers:[{type:'boost',op:'add',n:2,who:'all',filter:{color:'green'}}], art:{head:'round', skin:'#ffd9b3', hair:'#c0392b', acc:'strawhat', eyes:'dot', mouth:'smile'}});
  add({id:'tractor', name:'Rusty the Tractor', char:'Rusty', group:'Barnyard Bonkers', pts:4, color:'orange', features:['Vehicle','Prop'], power:'+10 if next to Farmer Fritz',
       powers:[{type:'boost',op:'add',n:10,who:'self',cond:{kind:'nextTo',filter:{char:'Fritz'}}}], art:{kind:'tractor'}});
  add({id:'quack', name:'Sir Quacksalot', char:'Quacksalot', group:'Barnyard Bonkers', pts:7, color:'blue', features:['Male','Animal','Hero'], power:'No Power', powers:[],
       art:{head:'duck', skin:'#fffbe6', acc:'knight', eyes:'big', mouth:'beak'}});
  add({id:'weasel', name:'Slick Weasel', char:'Weasel', group:'Barnyard Bonkers', pts:6, color:'purple', features:['Male','Villain','Animal'], power:'-3 to each neighboring or opposite Animal',
       powers:[{type:'boost',op:'add',n:-3,who:'neighborsOrOpposite',filter:{feature:'Animal'}}], art:{head:'weasel', skin:'#a0703c', eyes:'angry', mouth:'smirk'}});
  add({id:'granny', name:'Granny Goose', char:'Granny', group:'Barnyard Bonkers', pts:3, color:'green', features:['Female','Animal'], power:'+1 to all Female cards',
       powers:[{type:'boost',op:'add',n:1,who:'all',filter:{feature:'Female'}}], art:{head:'duck', skin:'#ffffff', acc:'glasses', eyes:'dot', mouth:'beak'}});
  // ---------- SPROUT SQUAD ----------
  add({id:'pip', name:'Pip Sprout', char:'Pip', group:'Sprout Squad', pts:9, color:'green', features:['Male','Hero'], power:'No Power', powers:[],
       art:{head:'round', skin:'#bdf07a', acc:'leaf', eyes:'big', mouth:'grin'}});
  add({id:'pip_armor', name:'Pip in Bark Armor', char:'Pip', group:'Sprout Squad', pts:4, color:'purple', features:['Male','Hero'], power:'+2 to all Hero cards',
       powers:[{type:'boost',op:'add',n:2,who:'all',filter:{feature:'Hero'}}], art:{head:'round', skin:'#bdf07a', acc:'armor', eyes:'angry', mouth:'grin'}});
  add({id:'daisy', name:'Daisy Dynamo', char:'Daisy', group:'Sprout Squad', pts:6, color:'orange', features:['Female','Hero'], power:'+6 to all other Sprout Squad members',
       powers:[{type:'boost',op:'add',n:6,who:'allOther',filter:{group:'Sprout Squad'}}], art:{head:'flower', skin:'#ffe08a', hair:'#ffffff', eyes:'lash', mouth:'grin'}});
  add({id:'thorn', name:'Baron Thorn', char:'Thorn', group:'Sprout Squad', pts:8, color:'black', features:['Male','Villain'], power:'No Power', powers:[],
       art:{head:'tall', skin:'#3f7a3a', acc:'spikes', eyes:'angry', mouth:'frown'}});
  add({id:'weedwhack', name:'Weedwhacker 3000', char:'Weedwhacker', group:'Sprout Squad', pts:1, color:'orange', features:['Villain','Prop'], power:'-2 to all Green cards',
       powers:[{type:'boost',op:'add',n:-2,who:'all',filter:{color:'green'}}], art:{head:'square', skin:'#ff6b3d', acc:'saw', eyes:'robot', mouth:'grill'}});
  add({id:'treehouse', name:'Treehouse HQ', char:'Treehouse HQ', group:'Sprout Squad', pts:5, color:'purple', features:['Place'], power:'+2 to any Sprout Squad member',
       powers:[{type:'boost',op:'add',n:2,who:'allOther',filter:{group:'Sprout Squad'}}], art:{kind:'tree'}});
  add({id:'bud', name:'Bud Buddy', char:'Bud', group:'Sprout Squad', pts:5, color:'red', features:['Male','Hero'], power:'Treats neighboring cards as Red',
       powers:[{type:'recolor',color:'red',who:'neighbors'}], art:{head:'round', skin:'#ff9a9a', acc:'bud', eyes:'big', mouth:'smile'}});
  add({id:'mossy', name:'Mossy', char:'Mossy', group:'Sprout Squad', pts:4, color:'yellow', features:['Animal'], power:'x2 to any Pip',
       powers:[{type:'boost',op:'mul',n:2,who:'all',filter:{char:'Pip'}}], art:{head:'blob', skin:'#8fcf5a', acc:'snail', eyes:'stalk', mouth:'smile'}});
  add({id:'petal', name:'Petal Pop', char:'Petal', group:'Sprout Squad', pts:10, color:'blue', features:['Female','Hero'], power:'No Power', powers:[],
       art:{head:'flower', skin:'#ffd1e8', hair:'#5ab0ff', eyes:'lash', mouth:'smile'}});
  // ---------- TOONVILLE ----------
  add({id:'mayor', name:'Mayor Bigsby', char:'Bigsby', group:'Toonville', pts:9, color:'black', features:['Male'], power:'No Power', powers:[],
       art:{head:'wide', skin:'#ffd9b3', acc:'tophat', eyes:'dot', mouth:'mustache'}});
  add({id:'dj', name:'DJ Zigzag', char:'Zigzag', group:'Toonville', pts:1, color:'silver', features:['Male'], power:'+2 to all Blue cards',
       powers:[{type:'boost',op:'add',n:2,who:'all',filter:{color:'blue'}}], art:{head:'round', skin:'#8d5a3b', acc:'headphones', eyes:'shades', mouth:'grin'}});
  add({id:'rosie', name:'Robo-Rosie', char:'Rosie', group:'Toonville', pts:5, color:'red', features:['Female','Prop'], power:'+2 for each other Prop card in play',
       powers:[{type:'boost',op:'add',n:2,who:'self',each:{where:'inPlay',filter:{feature:'Prop'}}}], art:{head:'square', skin:'#ff9ecb', acc:'bow', eyes:'robot', mouth:'smile'}});
  add({id:'sneak', name:'Sneak Peek', char:'Sneak', group:'Toonville', pts:5, color:'yellow', features:['Male','Villain'], power:'-1 to all Male cards',
       powers:[{type:'boost',op:'add',n:-1,who:'all',filter:{feature:'Male'}}], art:{head:'round', skin:'#d8c3ff', acc:'mask', eyes:'shifty', mouth:'smirk'}});
  add({id:'mel', name:'Megaphone Mel', char:'Mel', group:'Toonville', pts:2, color:'red', features:['Female'], power:'+3 to all Purple cards',
       powers:[{type:'boost',op:'add',n:3,who:'all',filter:{color:'purple'}}], art:{head:'round', skin:'#ffd9b3', hair:'#7a2bd6', acc:'megaphone', eyes:'lash', mouth:'open'}});
  add({id:'zap', name:'Zap Zapper', char:'Zap', group:'Toonville', pts:6, color:'red', features:['Male','Hero'], power:'+4 if next to Nova Nell',
       powers:[{type:'boost',op:'add',n:4,who:'self',cond:{kind:'nextTo',filter:{char:'Nell'}}}], art:{head:'round', skin:'#ffe0c2', hair:'#ffd400', acc:'bolt', eyes:'big', mouth:'grin'}});
  add({id:'blaze', name:'Blaze Ballerina', char:'Blaze', group:'Toonville', pts:10, color:'orange', features:['Female'], power:'No Power', powers:[],
       art:{head:'round', skin:'#c98b5a', hair:'#ff3d00', acc:'bun', eyes:'lash', mouth:'smile'}});

  const CARDS = {}; C.forEach(c => CARDS[c.id] = c);
  const DECKS = {
    galaxy:  {name:'Galaxy Blast',   cards:['zoomer','nell','bleep','gravitron','astropup','starhopper','lunara','cometkid','zap','dj','petal','quack']},
    spooky:  {name:'Spooky Hollow',  cards:['gloop','fangly','bertha','wisp','manor','bonesy','pumpkin','mel','sneak','thorn','mayor','timid']},
    barnyard:{name:'Barnyard Bonkers',cards:['hank','clara','moomax','fritz','tractor','quack','weasel','granny','mossy','hank_mud','rosie','blaze']},
    sprout:  {name:'Sprout Squad',   cards:['pip','daisy','treehouse','bud','mossy','weedwhack','petal','pip_armor','thorn','mayor','rosie','zap']},
  };
  const COLORS = {red:'#e8312f', orange:'#ff8a00', yellow:'#ffd400', green:'#2fb84a', blue:'#2a7fff', purple:'#9b3fd6', black:'#232323', silver:'#b8c2cc'};
  const api = {CARDS, CARD_LIST:C, DECKS, COLORS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TOB_CARDS = api;
})(this);
