/* Named pairs, crews, and a light retune so the 252-card pool meshes.
   Ids are unchanged. Bonuses are applied by engine.js. */
(function (root) {
  const PAIRS = [
    {id:'oath', name:'Oath of Flame', a:'Dragons', b:'Knights', bonus:3},
    {id:'stormschool', name:'Storm School', a:'Wizards', b:'Elementals', bonus:3},
    {id:'tide', name:'Tide Pact', a:'Pirates', b:'Sea Creatures', bonus:3},
    {id:'orbit', name:'Orbit Factory', a:'Robots', b:'Space Aliens', bonus:3},
    {id:'doublehaunt', name:'Double Haunt', a:'Ghosts', b:'Undead', bonus:3},
    {id:'nightburrow', name:'Night Burrow', a:'Ninjas', b:'Critters', bonus:3},
    {id:'sugarwing', name:'Sugarwing', a:'Candy Folk', b:'Fairies', bonus:3},
    {id:'fossil', name:'Fossil Storm', a:'Dinos', b:'Elementals', bonus:3},
    {id:'startreaty', name:'Star Treaty', a:'Galaxy', b:'Space Aliens', bonus:3},
    {id:'spookypact', name:'Spooky Pact', a:'Spooks', b:'Ghosts', bonus:3},
    {id:'fuzzy', name:'Fuzzy Farm', a:'Barnyard', b:'Critters', bonus:3},
    {id:'garden', name:'Garden Pact', a:'Sprouts', b:'Fairies', bonus:3},
    {id:'premiere', name:'Sweet Premiere', a:'Toons', b:'Candy Folk', bonus:3},
  ];
  const SETS = [
    {id:'pirate', name:'Pirate Crew', bonus:6, ids:['redbeard', 'polly']},
    {id:'bridge', name:'Bridge Crew', bonus:8, ids:['zoomer', 'nell', 'starhopper']},
    {id:'mud', name:'Mud Buddies', bonus:6, ids:['hank', 'fritz']},
    {id:'sproutpals', name:'Sprout Pals', bonus:8, ids:['pip', 'daisy', 'petal']},
    {id:'parade', name:'Town Parade', bonus:8, ids:['mayor', 'mel', 'blaze']},
    {id:'roast', name:'Dragon Roast', bonus:6, ids:['ember', 'glimmer']},
    {id:'glade', name:'Moonlit Glade', bonus:8, ids:['twinkle', 'dewdrop', 'glowbug']},
    {id:'guard', name:'Royal Guard', bonus:6, ids:['sirbumble', 'dame_dash']},
    {id:'spell', name:'Spell Team', bonus:6, ids:['fizzwick', 'madame_m']},
    {id:'gear', name:'Gear Pair', bonus:6, ids:['boltz', 'sprocket']},
    {id:'boobuddies', name:'Boo Buddies', bonus:6, ids:['boobee', 'wailina']},
    {id:'shadow', name:'Shadow Step', bonus:6, ids:['kitsu', 'shuriko']},
    {id:'burrow', name:'Burrow Buds', bonus:6, ids:['nutsy', 'bunbun']},
    {id:'reef', name:'Reef Pals', bonus:6, ids:['inkwell', 'starla']},
    {id:'saucer', name:'Saucer Pair', bonus:6, ids:['zorp', 'glorbina']},
    {id:'storm', name:'Storm Twins', bonus:6, ids:['blazey', 'splashy']},
    {id:'tomb', name:'Tomb Duo', bonus:6, ids:['mumbles', 'pharoh']},
    {id:'sweet', name:'Sweet Shop', bonus:8, ids:['gummo', 'lolli', 'mint']},
    {id:'stomp', name:'Dino Stomp', bonus:6, ids:['rexie', 'tricera']},
    {id:'spacewalk', name:'Space Walk', bonus:6, ids:['zoomer', 'zorp']},
    {id:'booclub', name:'Boo Club', bonus:6, ids:['bonesy', 'boobee']},
    {id:'farm', name:'Farm Friends', bonus:6, ids:['hank', 'nutsy']},
    {id:'gardenshow', name:'Garden Show', bonus:6, ids:['petal', 'twinkle']},
    {id:'candyprem', name:'Candy Premiere', bonus:6, ids:['blaze', 'lolli']},
    {id:'robotpal', name:'Robot Pal', bonus:6, ids:['bleep', 'boltz']},
    {id:'fang', name:'Fang Club', bonus:6, ids:['fangly', 'bertha']},
  ];

  const ARCH = {
    zoomer:'Galaxy', zoomer_jet:'Galaxy', nell:'Galaxy', bleep:'Galaxy', gravitron:'Galaxy', astropup:'Galaxy', starhopper:'Galaxy', lunara:'Galaxy', cometkid:'Galaxy',
    gloop:'Spooks', fangly:'Spooks', bertha:'Spooks', wisp:'Spooks', manor:'Spooks', bonesy:'Spooks', timid:'Spooks', pumpkin:'Spooks',
    hank:'Barnyard', hank_mud:'Barnyard', clara:'Barnyard', moomax:'Barnyard', fritz:'Barnyard', tractor:'Barnyard', quack:'Barnyard', weasel:'Barnyard', granny:'Barnyard',
    pip:'Sprouts', pip_armor:'Sprouts', daisy:'Sprouts', thorn:'Sprouts', weedwhack:'Sprouts', treehouse:'Sprouts', bud:'Sprouts', mossy:'Sprouts', petal:'Sprouts',
    mayor:'Toons', dj:'Toons', rosie:'Toons', sneak:'Toons', mel:'Toons', zap:'Toons', blaze:'Toons',
  };

  const apiCards = root.TOB_CARDS;
  Object.keys(ARCH).forEach(id => { if (apiCards.CARDS[id]) apiCards.CARDS[id].archetype = ARCH[id]; });

  function tune(id, power, powers, extra) {
    const c = apiCards.CARDS[id];
    if (!c) return;
    c.power = power;
    c.powers = powers;
    if (extra) Object.assign(c, extra);
  }
  // Enablers, all-in, rivalry, and the diverse captain. Printed points stay put.
  tune('glorbina', '+2 for each other Saucer Squad card in play. Counts as any archetype.', [
    {type:'boost', op:'add', n:2, who:'self', each:{where:'inPlay', filter:{group:'Saucer Squad'}}},
    {type:'tag', who:'self', all:true},
  ], {wild: true});
  tune('madame_m', '+3 to all other Spellbound Academy members. Neighbors count as Wizards.', [
    {type:'boost', op:'add', n:3, who:'allOther', filter:{group:'Spellbound Academy'}},
    {type:'tag', who:'neighbors', archetype:'Wizards'},
  ]);
  tune('bud', 'Treats neighboring cards as Red. Neighbors count as Fairies.', [
    {type:'recolor', color:'red', who:'neighbors'},
    {type:'tag', who:'neighbors', archetype:'Fairies'},
  ]);
  tune('bleep', '+3 to any Galaxy Gang member. Neighbors count as Robots.', [
    {type:'boost', op:'add', n:3, who:'allOther', filter:{group:'Galaxy Gang'}},
    {type:'tag', who:'neighbors', archetype:'Robots'},
  ]);
  tune('mayor', '+1 for each different archetype on your side (max 4).', [
    {type:'boost', op:'add', n:1, who:'self', each:{distinct:'archetype', where:'ownSide'}},
  ]);
  tune('shieldwall', '+3 to other Knights, and +5 more if every face-up card on your side is a Knight.', [
    {type:'boost', op:'add', n:3, who:'allOther', filter:{group:'Brave Brigade'}},
    {type:'boost', op:'add', n:5, who:'self', cond:{kind:'pure'}},
  ]);
  tune('polly', 'No Power', []);
  tune('mossfang', '+4 if the card opposite you is a Knight.', [
    {type:'boost', op:'add', n:4, who:'self', cond:{kind:'opposite', filter:{archetype:'Knights'}}},
  ]);
  tune('nightowl', '+4 if the card opposite you is a Robot.', [
    {type:'boost', op:'add', n:4, who:'self', cond:{kind:'opposite', filter:{archetype:'Robots'}}},
  ]);
  tune('cosmo_crys', '+4 if the card opposite you is a Ghost.', [
    {type:'boost', op:'add', n:4, who:'self', cond:{kind:'opposite', filter:{archetype:'Ghosts'}}},
  ]);
  tune('peglegpete', '+4 if the card opposite you is a Sea Creature.', [
    {type:'boost', op:'add', n:4, who:'self', cond:{kind:'opposite', filter:{archetype:'Sea Creatures'}}},
  ]);
  tune('nebulina', '+4 if the card opposite you is Galaxy.', [
    {type:'boost', op:'add', n:4, who:'self', cond:{kind:'opposite', filter:{archetype:'Galaxy'}}},
  ]);
  tune('banshee', '+4 if the card opposite you is a Fairy.', [
    {type:'boost', op:'add', n:4, who:'self', cond:{kind:'opposite', filter:{archetype:'Fairies'}}},
  ]);

  const book = {pairs: PAIRS, sets: SETS};
  function cardInCombo(card) {
    if (!card) return false;
    if (SETS.some(s => s.ids.includes(card.id))) return true;
    return (card.powers || []).some(p => p.type === 'tag' || (p.each && p.each.distinct) || (p.cond && (p.cond.kind === 'pure' || p.cond.kind === 'opposite')));
  }
  function blurbs(card) {
    const lines = [];
    SETS.filter(s => s.ids.includes(card.id)).forEach(s => {
      const names = s.ids.filter(id => id !== card.id).map(id => (apiCards.CARDS[id] && apiCards.CARDS[id].name) || id);
      lines.push(`${s.name}: face-up with ${names.join(' + ')} (+${s.bonus})`);
    });
    if (card.archetype) {
      PAIRS.filter(p => p.a === card.archetype || p.b === card.archetype).forEach(p => {
        const other = p.a === card.archetype ? p.b : p.a;
        lines.push(`${p.name}: also field a ${other} (+${p.bonus})`);
      });
    }
    return lines;
  }

  tune('daisy', '+2 to all other Sprout Squad members.', [
    {type:'boost', op:'add', n:2, who:'allOther', filter:{group:'Sprout Squad'}},
  ]);

  function rebuildAiDecks() {
    const list = apiCards.CARD_LIST;
    const by = {};
    list.forEach(c => { if (!c.archetype) return; (by[c.archetype] = by[c.archetype] || []).push(c); });
    Object.keys(apiCards.DECKS).forEach(k => { if (apiCards.DECKS[k].ai) delete apiCards.DECKS[k]; });
    Object.keys(by).forEach(arch => {
      const ids = [];
      const push = id => {
        const c = apiCards.CARDS[id];
        if (!c || ids.length >= 12 || ids.includes(id)) return;
        if (ids.some(have => apiCards.CARDS[have].char === c.char)) return;
        ids.push(id);
      };
      const crews = SETS.map(s => ({s, n: s.ids.filter(id => apiCards.CARDS[id] && apiCards.CARDS[id].archetype === arch).length}))
        .filter(x => x.n > 0)
        .sort((a, b) => b.n - a.n || b.s.ids.length - a.s.ids.length);
      if (crews[0]) crews[0].s.ids.forEach(push);
      const pair = PAIRS.find(p => p.a === arch || p.b === arch);
      const partner = pair ? (pair.a === arch ? pair.b : pair.a) : null;
      by[arch].slice().sort((a, b) => (b.powers.length - a.powers.length) || (a.pts - b.pts)).forEach(c => { if (ids.length < 9) push(c.id); });
      if (partner && by[partner]) by[partner].filter(c => c.powers.length || cardInCombo(c)).forEach(c => { if (ids.length < 12) push(c.id); });
      by[arch].forEach(c => push(c.id));
      const key = 'ai' + arch.toLowerCase().replace(/[^a-z0-9]/g, '');
      apiCards.DECKS[key] = {name: arch + ' Combo', cards: ids.slice(0, 12), ai: true};
    });
  }
  rebuildAiDecks();

  const api = {pairs: PAIRS, sets: SETS, blurbs, cardInCombo};
  root.TOB_COMBOS = api;
})(this);
