/* Original procedural SVG character art for Toon Orbit Battle. */
(function (root) {
  const O = 'stroke="#111" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
  function eyes(t, y = 44) {
    switch (t) {
      case 'big': return `<ellipse cx="40" cy="${y}" rx="7" ry="9" fill="#fff" ${O}/><ellipse cx="60" cy="${y}" rx="7" ry="9" fill="#fff" ${O}/><circle cx="42" cy="${y+1}" r="3.5" fill="#111"/><circle cx="62" cy="${y+1}" r="3.5" fill="#111"/>`;
      case 'lash': return eyes('big', y) + `<path d="M33 ${y-8} l-4 -4 M37 ${y-10} l-2 -5 M67 ${y-8} l4 -4 M63 ${y-10} l2 -5" ${O}/>`;
      case 'angry': return `<ellipse cx="40" cy="${y}" rx="6" ry="6" fill="#fff" ${O}/><ellipse cx="60" cy="${y}" rx="6" ry="6" fill="#fff" ${O}/><circle cx="41" cy="${y+1}" r="3" fill="#111"/><circle cx="59" cy="${y+1}" r="3" fill="#111"/><path d="M31 ${y-10} L47 ${y-5} M69 ${y-10} L53 ${y-5}" ${O} stroke-width="4"/>`;
      case 'robot': return `<rect x="31" y="${y-7}" width="15" height="12" rx="2" fill="#7ff" ${O}/><rect x="54" y="${y-7}" width="15" height="12" rx="2" fill="#7ff" ${O}/><circle cx="38" cy="${y-1}" r="2.5" fill="#111"/><circle cx="61" cy="${y-1}" r="2.5" fill="#111"/>`;
      case 'one': return `<ellipse cx="50" cy="${y-2}" rx="12" ry="12" fill="#fff" ${O}/><circle cx="52" cy="${y}" r="5" fill="#111"/>`;
      case 'hollow': return `<ellipse cx="40" cy="${y}" rx="7" ry="8" fill="#111"/><ellipse cx="60" cy="${y}" rx="7" ry="8" fill="#111"/><circle cx="40" cy="${y}" r="2" fill="#f33"/><circle cx="60" cy="${y}" r="2" fill="#f33"/>`;
      case 'scared': return `<ellipse cx="40" cy="${y}" rx="8" ry="10" fill="#fff" ${O}/><ellipse cx="60" cy="${y}" rx="8" ry="10" fill="#fff" ${O}/><circle cx="40" cy="${y}" r="2" fill="#111"/><circle cx="60" cy="${y}" r="2" fill="#111"/>`;
      case 'tri': return `<path d="M33 ${y+4} L40 ${y-6} L47 ${y+4}Z M53 ${y+4} L60 ${y-6} L67 ${y+4}Z" fill="#ffe14d" ${O}/>`;
      case 'shades': return `<path d="M29 ${y-5} H71 V${y-2} Q69 ${y+7} 59 ${y+5} Q53 ${y+3} 51 ${y-2} H49 Q47 ${y+3} 41 ${y+5} Q31 ${y+7} 29 ${y-2}Z" fill="#111"/>`;
      case 'shifty': return `<path d="M32 ${y} Q40 ${y-6} 48 ${y} Q40 ${y+3} 32 ${y}Z M52 ${y} Q60 ${y-6} 68 ${y} Q60 ${y+3} 52 ${y}Z" fill="#fff" ${O}/><circle cx="45" cy="${y-1}" r="2.5" fill="#111"/><circle cx="65" cy="${y-1}" r="2.5" fill="#111"/>`;
      case 'happy': return `<path d="M33 ${y} Q40 ${y-8} 47 ${y} M53 ${y} Q60 ${y-8} 67 ${y}" fill="none" ${O}/>`;
      case 'stalk': return `<path d="M42 ${y} L38 ${y-16} M58 ${y} L62 ${y-16}" ${O}/><circle cx="38" cy="${y-18}" r="5" fill="#fff" ${O}/><circle cx="62" cy="${y-18}" r="5" fill="#fff" ${O}/><circle cx="38" cy="${y-18}" r="2" fill="#111"/><circle cx="62" cy="${y-18}" r="2" fill="#111"/>`;
      default: return `<circle cx="40" cy="${y}" r="4" fill="#111"/><circle cx="60" cy="${y}" r="4" fill="#111"/>`;
    }
  }
  function mouth(t, y = 64) {
    switch (t) {
      case 'grin': return `<path d="M36 ${y-2} Q50 ${y+12} 64 ${y-2} Z" fill="#fff" ${O}/>`;
      case 'open': return `<ellipse cx="50" cy="${y+2}" rx="8" ry="6" fill="#8b1a1a" ${O}/>`;
      case 'frown': return `<path d="M38 ${y+5} Q50 ${y-5} 62 ${y+5}" fill="none" ${O}/>`;
      case 'smirk': return `<path d="M40 ${y+2} Q54 ${y+6} 62 ${y-3}" fill="none" ${O}/>`;
      case 'fangs': return `<path d="M38 ${y} Q50 ${y+6} 62 ${y}" fill="none" ${O}/><path d="M42 ${y+1} l2 6 l2 -5 M54 ${y+1} l2 5 l2 -6" fill="#fff" ${O}/>`;
      case 'tongue': return `<path d="M38 ${y-2} Q50 ${y+8} 62 ${y-2}" fill="none" ${O}/><path d="M48 ${y+2} q4 12 8 0" fill="#ff6b8a" ${O}/>`;
      case 'o': return `<ellipse cx="50" cy="${y}" rx="4" ry="5" fill="#333" ${O}/>`;
      case 'teeth': return `<rect x="38" y="${y-3}" width="24" height="8" fill="#fff" ${O}/><path d="M44 ${y-3}v8 M50 ${y-3}v8 M56 ${y-3}v8" ${O} stroke-width="1.5"/>`;
      case 'wobble': return `<path d="M38 ${y} q3 -4 6 0 t6 0 t6 0 t6 0" fill="none" ${O}/>`;
      case 'jack': return `<path d="M34 ${y-4} L40 ${y+2} L45 ${y-2} L50 ${y+4} L55 ${y-2} L60 ${y+2} L66 ${y-4} Q50 ${y+14} 34 ${y-4}Z" fill="#ffe14d" ${O}/>`;
      case 'beak': return `<path d="M42 ${y-6} L58 ${y-6} L50 ${y+4}Z" fill="#ff9d1c" ${O}/>`;
      case 'snout': return `<ellipse cx="50" cy="${y+2}" rx="14" ry="8" fill="#ffb3c7" ${O}/><circle cx="45" cy="${y+2}" r="2" fill="#111"/><circle cx="55" cy="${y+2}" r="2" fill="#111"/>`;
      case 'grill': return `<rect x="38" y="${y-3}" width="24" height="8" rx="2" fill="#555" ${O}/><path d="M44 ${y-3}v8 M50 ${y-3}v8 M56 ${y-3}v8" stroke="#ccc" stroke-width="1.5"/>`;
      case 'mustache': return `<path d="M36 ${y-3} Q43 ${y-9} 50 ${y-3} Q57 ${y-9} 64 ${y-3} Q57 ${y+3} 50 ${y-1} Q43 ${y+3} 36 ${y-3}Z" fill="#5a3a1a" ${O}/>`;
      default: return `<path d="M38 ${y-2} Q50 ${y+8} 62 ${y-2}" fill="none" ${O}/>`;
    }
  }
  function head(a) {
    const s = a.skin || '#fc9';
    switch (a.head) {
      case 'square': return `<rect x="24" y="24" width="52" height="54" rx="6" fill="${s}" ${O}/>`;
      case 'egg': return `<ellipse cx="50" cy="48" rx="26" ry="32" fill="${s}" ${O}/>`;
      case 'tall': return `<path d="M30 30 Q50 10 70 30 L66 76 Q50 86 34 76Z" fill="${s}" ${O}/>`;
      case 'blob': return `<path d="M22 78 Q16 40 36 26 Q50 14 64 26 Q86 40 78 78 Q70 72 64 80 Q56 72 50 80 Q42 72 36 80 Q28 72 22 78Z" fill="${s}" ${O}/>`;
      case 'ghost': return `<path d="M24 86 L24 44 Q24 18 50 18 Q76 18 76 44 L76 86 L68 78 L60 86 L50 78 L40 86 L32 78Z" fill="${s}" ${O}/>`;
      case 'skull': return `<path d="M26 50 Q26 22 50 22 Q74 22 74 50 Q74 62 66 66 L64 78 L36 78 L34 66 Q26 62 26 50Z" fill="${s}" ${O}/>`;
      case 'pumpkin': return `<path d="M50 22 l4 -8" ${O} stroke="#2a7a1a" stroke-width="5"/><ellipse cx="38" cy="52" rx="18" ry="28" fill="${s}" ${O}/><ellipse cx="62" cy="52" rx="18" ry="28" fill="${s}" ${O}/><ellipse cx="50" cy="52" rx="16" ry="29" fill="${s}" ${O}/>`;
      case 'pig': return `<path d="M28 30 L24 16 L40 24Z M72 30 L76 16 L60 24Z" fill="${s}" ${O}/><ellipse cx="50" cy="52" rx="30" ry="28" fill="${s}" ${O}/>`;
      case 'cow': return `<path d="M24 32 Q12 26 14 20 Q24 22 32 30Z M76 32 Q88 26 86 20 Q76 22 68 30Z" fill="#f2e6c8" ${O}/><ellipse cx="50" cy="50" rx="27" ry="30" fill="${s}" ${O}/><path d="M30 34 q8 -6 14 2 q-4 10 -14 6Z M62 56 q10 -4 12 6 q-8 6 -12 -6Z" fill="#111"/>`;
      case 'dog': return `<path d="M24 30 Q10 50 22 64 Q30 50 32 36Z M76 30 Q90 50 78 64 Q70 50 68 36Z" fill="#8a5a2b" ${O}/><circle cx="50" cy="50" r="27" fill="${s}" ${O}/><ellipse cx="50" cy="58" rx="6" ry="4" fill="#111"/>`;
      case 'chick': return `<path d="M44 22 q6 -12 10 0 q6 -8 6 4" fill="#ff4040" ${O}/><circle cx="50" cy="52" r="28" fill="${s}" ${O}/>`;
      case 'duck': return `<circle cx="50" cy="50" r="28" fill="${s}" ${O}/>`;
      case 'weasel': return `<path d="M28 28 l-4 -10 l12 6Z M72 28 l4 -10 l-12 6Z" fill="${s}" ${O}/><path d="M24 40 Q50 18 76 40 L58 80 Q50 86 42 80Z" fill="${s}" ${O}/><circle cx="50" cy="78" r="4" fill="#111"/>`;
      case 'flower': return [0,60,120,180,240,300].map(r => `<ellipse cx="50" cy="20" rx="11" ry="15" fill="${a.hair||'#fff'}" ${O} transform="rotate(${r} 50 50)"/>`).join('') + `<circle cx="50" cy="50" r="24" fill="${s}" ${O}/>`;
      case 'wide': return `<ellipse cx="50" cy="54" rx="34" ry="26" fill="${s}" ${O}/>`;
      default: return `<circle cx="50" cy="50" r="28" fill="${s}" ${O}/>`;
    }
  }
  function back(a) {
    switch (a.acc) {
      case 'cape': return `<path d="M14 92 L30 40 L70 40 L86 92Z" fill="#8b0000" ${O}/>`;
      case 'batwings': return `<path d="M30 46 L4 30 L10 46 L2 56 L14 58 L12 70 L30 60Z M70 46 L96 30 L90 46 L98 56 L86 58 L88 70 L70 60Z" fill="#3a2350" ${O}/>`;
      case 'jetpack': return `<rect x="12" y="44" width="14" height="30" rx="5" fill="#bbb" ${O}/><rect x="74" y="44" width="14" height="30" rx="5" fill="#bbb" ${O}/><path d="M14 74 l5 16 l5 -16 M76 74 l5 16 l5 -16" fill="#ff8a00" ${O}/>`;
      case 'pigtails': return `<circle cx="20" cy="40" r="10" fill="${a.hair}" ${O}/><circle cx="80" cy="40" r="10" fill="${a.hair}" ${O}/>`;
      case 'bubble': return `<circle cx="50" cy="50" r="40" fill="#bdf" fill-opacity=".45" ${O}/>`;
      case 'snail': return `<circle cx="72" cy="58" r="20" fill="#d9a066" ${O}/><path d="M72 58 m-10 0 a10 10 0 1 1 10 10 a6 6 0 1 1 -6 -6" fill="none" ${O}/>`;
      case 'spikes': return `<path d="M30 30 L26 10 L40 24 L50 4 L60 24 L74 10 L70 30Z" fill="#2a5a26" ${O}/>`;
      default: return '';
    }
  }
  function front(a) {
    switch (a.acc) {
      case 'helmet': return `<path d="M20 50 Q20 14 50 14 Q80 14 80 50 L72 50 Q72 26 50 26 Q28 26 28 50Z" fill="#eee" ${O}/><circle cx="50" cy="18" r="5" fill="#f33" ${O}/>`;
      case 'antenna': return `<path d="M50 24 V8" ${O}/><circle cx="50" cy="7" r="5" fill="#f33" ${O}/>`;
      case 'brain': return `<path d="M28 34 Q26 14 44 16 Q50 8 58 16 Q76 14 72 34 Z" fill="#ff9ec4" ${O}/><path d="M40 22 q4 4 0 8 M54 20 q-4 5 2 9" fill="none" ${O} stroke-width="1.5"/>`;
      case 'crown': return `<path d="M32 26 L34 8 L42 18 L50 4 L58 18 L66 8 L68 26Z" fill="#ffd400" ${O}/>`;
      case 'flamehair': return `<path d="M24 40 Q20 16 34 22 Q36 4 50 16 Q62 2 66 22 Q82 14 76 40 Q64 26 50 30 Q36 26 24 40Z" fill="${a.hair}" ${O}/>`;
      case 'sweat': return `<path d="M78 30 q6 10 0 12 q-6 -2 0 -12Z" fill="#7cd3ff" ${O}/><path d="M28 30 Q30 18 50 20 Q70 18 72 30 Q60 24 50 26 Q40 24 28 30Z" fill="${a.hair}" ${O}/>`;
      case 'mud': return `<path d="M26 66 q8 -6 14 2 q6 -8 14 0 q8 -6 18 2 l-2 12 l-44 0Z" fill="#6b4226" ${O}/>`;
      case 'strawhat': return `<ellipse cx="50" cy="28" rx="36" ry="7" fill="#f2d16b" ${O}/><path d="M34 28 Q36 8 50 8 Q64 8 66 28Z" fill="#f2d16b" ${O}/><path d="M35 24 H65" stroke="#c0392b" stroke-width="4"/>`;
      case 'knight': return `<path d="M24 36 Q24 14 50 14 Q76 14 76 36Z" fill="#c9d1d9" ${O}/><path d="M50 14 q10 -10 16 -4" fill="none" stroke="#e8312f" stroke-width="5"/>`;
      case 'glasses': return `<circle cx="40" cy="44" r="9" fill="none" ${O}/><circle cx="60" cy="44" r="9" fill="none" ${O}/><path d="M49 44 h2" ${O}/>`;
      case 'leaf': return `<path d="M50 24 Q40 4 58 6 Q60 18 50 24Z" fill="#2fb84a" ${O}/>`;
      case 'armor': return `<path d="M22 46 Q22 14 50 14 Q78 14 78 46 L70 46 L68 30 L32 30 L30 46Z" fill="#8a5a2b" ${O}/><path d="M36 20 h8 M56 22 h8" ${O}/>`;
      case 'saw': return `<path d="M76 30 l10 -6 l2 6 l6 -2 l-2 8 l6 2 l-8 6Z" fill="#ccc" ${O}/>`;
      case 'bud': return `<path d="M50 24 Q42 12 50 4 Q58 12 50 24Z" fill="#e8312f" ${O}/><path d="M50 24 v-4" ${O}/>`;
      case 'tophat': return `<rect x="34" y="6" width="32" height="24" fill="#222" ${O}/><rect x="26" y="28" width="48" height="6" rx="2" fill="#222" ${O}/><rect x="34" y="22" width="32" height="5" fill="#e8312f"/>`;
      case 'headphones': return `<path d="M22 50 Q22 18 50 18 Q78 18 78 50" fill="none" ${O} stroke-width="5"/><rect x="14" y="42" width="12" height="20" rx="4" fill="#9b3fd6" ${O}/><rect x="74" y="42" width="12" height="20" rx="4" fill="#9b3fd6" ${O}/>`;
      case 'bow': return `<path d="M50 24 L36 14 L36 32Z M50 24 L64 14 L64 32Z" fill="#e8312f" ${O}/>`;
      case 'mask': return `<path d="M26 38 H74 V50 H26Z" fill="#222"/><ellipse cx="40" cy="44" rx="6" ry="4" fill="#fff"/><ellipse cx="60" cy="44" rx="6" ry="4" fill="#fff"/>`;
      case 'megaphone': return `<path d="M68 60 L90 46 L90 82 L68 68Z" fill="#ffd400" ${O}/><path d="M28 30 Q30 18 50 20 Q70 18 72 30 Q60 24 50 26 Q40 24 28 30Z" fill="${a.hair}" ${O}/>`;
      case 'bolt': return `<path d="M30 26 L70 26 L60 20 L68 14 L40 14Z" fill="${a.hair}" ${O}/><path d="M80 20 L72 36 L80 36 L72 52" fill="none" stroke="#ffd400" stroke-width="4"/>`;
      case 'bun': return `<circle cx="50" cy="16" r="10" fill="${a.hair}" ${O}/><path d="M24 44 Q24 22 50 22 Q76 22 76 44 Q62 30 50 32 Q38 30 24 44Z" fill="${a.hair}" ${O}/>`;
      default: return '';
    }
  }
  function object(kind) {
    switch (kind) {
      case 'rocket': return `<path d="M50 6 Q70 26 66 64 L34 64 Q30 26 50 6Z" fill="#e8312f" ${O}/><circle cx="50" cy="34" r="9" fill="#9df" ${O}/><path d="M34 50 L18 72 L34 66Z M66 50 L82 72 L66 66Z" fill="#ffd400" ${O}/><path d="M40 66 L50 94 L60 66Z" fill="#ff8a00" ${O}/>`;
      case 'house': return `<path d="M16 50 L50 16 L84 50Z" fill="#5b3d7a" ${O}/><rect x="24" y="50" width="52" height="40" fill="#8b7aa8" ${O}/><rect x="44" y="66" width="12" height="24" fill="#222" ${O}/><rect x="30" y="56" width="10" height="10" fill="#ffe14d" ${O}/><rect x="60" y="56" width="10" height="10" fill="#ffe14d" ${O}/><path d="M66 30 V14 H74 V38" fill="#5b3d7a" ${O}/><circle cx="80" cy="14" r="6" fill="#fff8b0"/>`;
      case 'tractor': return `<rect x="22" y="40" width="44" height="24" rx="4" fill="#ff8a00" ${O}/><rect x="50" y="22" width="22" height="22" fill="#9df" ${O}/><circle cx="30" cy="70" r="14" fill="#333" ${O}/><circle cx="30" cy="70" r="5" fill="#ffd400"/><circle cx="74" cy="72" r="10" fill="#333" ${O}/><circle cx="74" cy="72" r="4" fill="#ffd400"/><path d="M30 40 V24" ${O} stroke-width="5"/><circle cx="44" cy="52" r="3" fill="#111"/><circle cx="54" cy="52" r="3" fill="#111"/>`;
      case 'tree': return `<rect x="42" y="50" width="16" height="44" fill="#8a5a2b" ${O}/><circle cx="50" cy="36" r="30" fill="#2fb84a" ${O}/><rect x="30" y="38" width="40" height="22" fill="#c98b5a" ${O}/><path d="M28 40 L50 26 L72 40Z" fill="#e8312f" ${O}/><rect x="45" y="46" width="10" height="14" fill="#222"/>`;
    }
    return '';
  }
  function svg(card) {
    const a = card.art || {};
    const mythic = !!(card.mythic || String(card.id).indexOf('my_') === 0);
    const bg = mythic
      ? `<defs><radialGradient id="g_${card.id}" cx="50%" cy="38%" r="72%"><stop offset="0" stop-color="#fff4ff"/><stop offset="0.45" stop-color="#b9a0ff"/><stop offset="1" stop-color="#3a246e"/></radialGradient></defs><rect width="100" height="100" fill="url(#g_${card.id})"/>` +
        [0,1,2,3,4,5,6,7,8,9].map(i => `<circle cx="${12 + (i * 17) % 80}" cy="${10 + (i * 23) % 80}" r="${1.2 + (i % 3)}" fill="#fff" fill-opacity=".85"/>`).join('')
      : `<defs><radialGradient id="g_${card.id}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#ffd27a"/></radialGradient></defs><rect width="100" height="100" fill="url(#g_${card.id})"/>` +
        [0,1,2,3,4,5,6,7].map(i => `<path d="M50 50 L${50+80*Math.cos(i*Math.PI/4)} ${50+80*Math.sin(i*Math.PI/4)} L${50+80*Math.cos(i*Math.PI/4+0.3)} ${50+80*Math.sin(i*Math.PI/4+0.3)}Z" fill="#fff" fill-opacity=".35"/>`).join('');
    let body = a.kind ? object(a.kind) : back(a) + head(a) + eyes(a.eyes) + mouth(a.mouth) + front(a);
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${bg}${body}</svg>`;
  }
  function useSvg(img) {
    const id = img && img.getAttribute && img.getAttribute('data-id');
    const card = root.TOB_CARDS && root.TOB_CARDS.CARDS[id];
    if (!card) { if (img) img.remove(); return; }
    const cart = img.closest && img.closest('.cart');
    if (cart) cart.classList.add('ready');
    const holder = document.createElement('div');
    holder.innerHTML = svg(card);
    if (holder.firstChild) img.replaceWith(holder.firstChild);
  }
  root.TOB_ART = {svg, useSvg};
})(this);
