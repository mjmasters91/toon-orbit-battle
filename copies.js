/* Card copies and rarity. A copy is a definition plus cosmetic fields.
   Gold does not change rules or scoring. A future pack opener can push
   {id, gold, uid} records through makeCopy and saveCollection. */
(function (root) {
  let seq = 1;
  function makeCopy(id, opts) {
    opts = opts || {};
    const def = root.TOB_CARDS.CARDS[id];
    if (!def) return null;
    const copy = Object.assign({}, def);
    copy.gold = !!opts.gold;
    copy.uid = opts.uid || ('c' + (seq++));
    return copy;
  }
  function stampGold(copies, n) {
    const order = copies.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    const count = Math.max(0, Math.min(n || 0, copies.length));
    for (let k = 0; k < count; k++) copies[order[k]].gold = true;
    return copies;
  }
  function loadCollection() {
    try { return JSON.parse(localStorage.getItem('tob_collection') || 'null'); }
    catch (e) { return null; }
  }
  function saveCollection(data) {
    try { localStorage.setItem('tob_collection', JSON.stringify(data)); }
    catch (e) { /* storage unavailable */ }
  }
  root.TOB_COPIES = {makeCopy, stampGold, loadCollection, saveCollection};
})(this);
