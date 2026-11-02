/* Sanity check for combo scoring. Run: node tools/combo-balance.js */
const fs = require('fs');
const vm = require('vm');
const sandbox = {console};
vm.createContext(sandbox);
['cards.js', 'cards-set2.js', 'combos.js', 'engine.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, {filename: f});
});
const {CARDS, CARD_LIST, DECKS} = sandbox.TOB_CARDS;
const E = sandbox.TOB_ENGINE;
const book = sandbox.TOB_COMBOS;
let failed = 0;
const eq = (name, got, want) => {
  if (got !== want) { failed++; console.log('FAIL', name, 'got', got, 'want', want); }
};
const board = (ids, opp) => {
  const fill = ids.concat([null, null, null, null, null, null, null]).slice(0, 7);
  const o = (opp || []).concat([null, null, null, null, null, null, null]).slice(0, 7);
  const shown = {p: fill.map(Boolean), o: o.map(Boolean)};
  return E.evaluate({p: fill.map(id => id && CARDS[id]), o: o.map(id => id && CARDS[id])}, shown, {goals: ['black', 'black'], penalty: {p: 0, o: 0}});
};

eq('pool', CARD_LIST.length, 252);
eq('unique', new Set(CARD_LIST.map(c => c.id)).size, 252);
const missing = book.sets.flatMap(s => s.ids).filter(id => !CARDS[id]);
eq('crew ids', missing.length, 0);
eq('ai decks', Object.values(DECKS).filter(d => d.ai).length, new Set(CARD_LIST.map(c => c.archetype)).size);

const crew = board(['redbeard', 'polly']);
eq('pirate value', crew.cells.p[1].value, 3 + 6);
eq('pirate name', crew.combos.some(c => c.name === 'Pirate Crew'), true);

const pair = board(['ember', 'sirbumble']);
eq('oath', pair.combos.some(c => c.name === 'Oath of Flame'), true);
eq('oath total', pair.score.p, 10 + 10 + 3);

const wild = board(['glorbina', 'ember']);
eq('wild fills knights', wild.combos.some(c => c.name === 'Oath of Flame'), true);
eq('wild alone no', board(['glorbina']).combos.length, 0);

const tagged = board(['madame_m', 'blazey', 'splashy']);
eq('tag makes wizard', tagged.combos.some(c => c.name === 'Storm School'), true);

const pure = board(['shieldwall', 'sirbumble', 'dame_dash', 'axel']);
eq('pure knights', pure.cells.p[0].value >= 2 + 5, true);
const mixed = board(['shieldwall', 'ember']);
eq('pure broken', mixed.score.p, 2 + 10 + 3);

const div = board(['mayor', 'ember', 'twinkle', 'boltz']);
eq('diverse cap', div.cells.p[0].add, 4);

const rival = board(['mossfang'], ['sirbumble']);
eq('rivalry', rival.cells.p[0].value, 8 + 4);
eq('no rivalry', board(['mossfang'], ['ember']).cells.p[0].value, 8);

const old = board(['zoomer']);
eq('old id', old.cells.p[0].card.id, 'zoomer');
eq('archetype stamped', CARDS.zoomer.archetype, 'Galaxy');

// Intended packages: first 4 cards of each AI deck, face up, no color bonus.
const solos = Object.values(DECKS).filter(d => d.ai).map(d => {
  const ev = board(d.cards.slice(0, 4));
  return {name: d.name, score: ev.score.p, combos: ev.combos.map(c => c.name).join(', ')};
});
solos.sort((a, b) => b.score - a.score);
const scores = solos.map(s => s.score);
const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
const spread = Math.max(...scores) - Math.min(...scores);
console.log('solo high', solos.slice(0, 3));
console.log('solo low', solos.slice(-3));
console.log('solo avg', avg.toFixed(1), 'spread', spread);
if (spread > 22) { failed++; console.log('FAIL spread', spread); }

// Random 4-card snaps. A deck that always draws its best four is not how games go.
function mulberry(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function draw4(cards, rand) {
  const bag = cards.slice();
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
  return bag.slice(0, 4);
}
const aiDecks = Object.values(DECKS).filter(d => d.ai);
const wins = {}, played = {};
aiDecks.forEach(d => { wins[d.name] = 0; played[d.name] = 0; });
let worst = null, games = 0;
const rand = mulberry(7);
for (let t = 0; t < 24; t++) {
  for (let i = 0; i < aiDecks.length; i++) for (let j = i + 1; j < aiDecks.length; j++) {
    const ev = board(draw4(aiDecks[i].cards, rand), draw4(aiDecks[j].cards, rand));
    games++;
    played[aiDecks[i].name]++; played[aiDecks[j].name]++;
    if (ev.score.p !== ev.score.o) wins[ev.score.p > ev.score.o ? aiDecks[i].name : aiDecks[j].name]++;
    const margin = Math.abs(ev.score.p - ev.score.o);
    if (!worst || margin > worst.margin) worst = {margin, a: aiDecks[i].name, b: aiDecks[j].name};
  }
}
const rates = Object.keys(wins).map(n => ({n, rate: wins[n] / played[n]})).sort((a, b) => b.rate - a.rate);
console.log('best rates', rates.slice(0, 4));
console.log('worst margin', worst, 'games', games);
if (rates[0].rate > 0.68) { failed++; console.log('FAIL win rate', rates[0]); }
if (worst.margin > 45) { failed++; console.log('FAIL margin', worst); }

console.log(failed ? 'FAILED ' + failed : 'OK');
process.exit(failed ? 1 : 0);
