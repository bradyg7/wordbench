(() => {
  const D = JSON.parse(document.getElementById('data').textContent);
  const all = [...document.querySelectorAll('.slide')];
  let slides = all, rowSlides = [], showAppr = false;
  const isAppr = s => s.dataset.approved === '1';
  const KEY = 'review:' + D.folder + ':round' + D.round;
  // Stored: notes[row] = comment (as before); notes._r[row] = rating 1-4; notes._c[row] = ["Category|Chip", ...].
  let notes = {};
  try { notes = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { notes = {}; }
  notes._r = notes._r || {}; notes._c = notes._c || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) {} };
  const $ = id => document.getElementById(id);
  const RATINGS = [null, 'Perfect', 'Satisfactory', 'Not great', 'Horrible'];
  const GOOD = { Good: ['Clean', 'Clear', 'Feels like Notion', 'Right for study'] };
  const CATS = {
    Look: ['Cramped', 'Misaligned', 'Colors off', 'Type off', 'Not like the app', 'Too busy'],
    Behavior: ['Wrong result', 'Missing state', 'Keyboard or focus', 'Too many steps', 'Surprising'],
    Words: ['Wrong word', 'Unclear label', 'Not in the Library map'],
    'Fit for study': ['Not needed', 'Conflicts with another row', 'Gets in the way of reading'],
    Drawing: ['Frame unclear', 'Needs before and after', 'Wrong or missing data'],
  };
  let cur = 0;
  const refilter = () => {
    slides = all.filter(s => !isAppr(s) || showAppr);
    rowSlides = slides.filter(s => s.dataset.row);
    const n = all.filter(isAppr).length;
    $('appr').textContent = n + ' rows approved, ' + (all.filter(s => s.dataset.row).length - n) + ' to review';
    $('showappr').setAttribute('aria-pressed', String(showAppr));
    $('showappr').textContent = showAppr ? 'Hide approved' : 'Show approved';
  };
  refilter();
  const msgEl = () => $('msg');
  const comment = k => (typeof notes[k] === 'string' ? notes[k] : '').trim();
  const chips = k => notes._c[k] || [];
  const touched = k => !!comment(k) || chips(k).length > 0;
  const msg = t => { $('msg').textContent = t; setTimeout(() => $('msg').textContent = '', 3000); };

  const tally = () => {
    const n = [0, 0, 0, 0, 0];
    rowSlides.forEach(s => n[notes._r[s.dataset.row] || 0]++);
    $('tally').innerHTML = [1, 2, 3, 4].map(i => '<span>' + n[i] + ' ' + RATINGS[i] + '</span>').join('') + '<span>' + n[0] + ' unrated</span>';
  };

  const renderSlide = (s, openChips) => {
    const k = s.dataset.row, r = notes._r[k] || 0;
    const rate = s.querySelector('.rate');
    rate.innerHTML = '';
    for (let v = 1; v <= 4; v++) {
      const b = document.createElement('button');
      b.dataset.v = v; b.setAttribute('aria-pressed', String(r === v));
      b.innerHTML = RATINGS[v] + ' <kbd>' + v + '</kbd>'; b.disabled = isAppr(s);
      b.onclick = () => setRating(v);
      rate.appendChild(b);
    }
    const box = s.querySelector('.chips');
    box.innerHTML = '';
    const groups = (r === 1 || r === 2 ? Object.assign({}, GOOD, CATS) : CATS);
    Object.keys(groups).forEach(cat => {
      const h = document.createElement('div'); h.className = 'cat'; h.textContent = cat; box.appendChild(h);
      const row = document.createElement('div'); row.className = 'row';
      groups[cat].forEach(c => {
        const id = cat + '|' + c, b = document.createElement('button');
        b.className = 'chip'; b.textContent = c; b.setAttribute('aria-pressed', String(chips(k).includes(id)));
        b.onclick = () => {
          const l = chips(k).slice(), i = l.indexOf(id);
          if (i >= 0) l.splice(i, 1); else l.push(id);
          notes._c[k] = l; save(); b.setAttribute('aria-pressed', String(i < 0));
          s.querySelector('.chipbox summary').textContent = 'Reasons' + (l.length ? ' (' + l.length + ')' : '');
        };
        row.appendChild(b);
      });
      box.appendChild(row);
    });
    if (openChips !== undefined) s.querySelector('.chipbox').open = openChips;
    s.querySelector('.chipbox summary').textContent = 'Reasons' + (chips(k).length ? ' (' + chips(k).length + ')' : '');
  };
  const setRating = v => {
    const s = slides[cur], k = s.dataset.row; if (!k || isAppr(s)) return;
    if (notes._r[k] === v) delete notes._r[k]; else notes._r[k] = v;
    save(); renderSlide(s, notes._r[k] >= 3); tally();
  };

  const show = i => {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    const s = slides[cur];
    all.forEach(x => x.classList.toggle('on', x === s));
    s.scrollTop = 0;
    $('count').textContent = cur === 0 ? 'Title' : 'Row ' + s.dataset.row + ' (' + cur + ' of ' + (slides.length - 1) + ')';
    $('bar').firstChild.style.width = (slides.length > 1 ? cur / (slides.length - 1) * 100 : 100) + '%';
    try { history.replaceState(null, '', '#' + (s.dataset.row ? 'row-' + s.dataset.row : 'title')); } catch (e) {}
    $('grid').classList.remove('on');
  };
  const typing = () => { const a = document.activeElement; return a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT'); };
  const nextUnrated = () => {
    for (let d = 1; d <= slides.length; d++) {
      const i = (cur + d) % slides.length, s = slides[i];
      if (s.dataset.row && !notes._r[s.dataset.row]) { show(i); return; }
    }
    msg('Every row is rated');
  };

  document.querySelectorAll('textarea[data-k]').forEach(t => {
    t.value = typeof notes[t.dataset.k] === 'string' ? notes[t.dataset.k] : '';
    t.addEventListener('input', () => { notes[t.dataset.k] = t.value; save(); });
  });
  all.filter(s => s.dataset.row).forEach(s => renderSlide(s, notes._r[s.dataset.row] >= 3));

  const buildGrid = () => {
    let h = '', g = null;
    slides.forEach((s, i) => {
      if (!s.dataset.row) return;
      if (s.dataset.group !== g) { if (g !== null) h += '</div>'; g = s.dataset.group; h += '<h3></h3><div class="cells">'; }
      const k = s.dataset.row;
      h += '<button class="cell' + (isAppr(s) ? ' appr' : notes._r[k] ? ' r' + notes._r[k] : '') + (touched(k) ? ' has' : '') + (i === cur ? ' cur' : '') + '" data-i="' + i + '"><b></b><span></span></button>';
    });
    $('grid').innerHTML = h + '</div>';
    const heads = $('grid').querySelectorAll('h3'); let hi = -1, last = null;
    slides.forEach(s => { if (!s.dataset.row) return; if (s.dataset.group !== last) { last = s.dataset.group; hi++; heads[hi].textContent = last || 'Rows'; } });
    $('grid').querySelectorAll('.cell').forEach(b => {
      const s = slides[+b.dataset.i];
      b.firstChild.textContent = s.dataset.row; b.lastChild.textContent = s.dataset.label;
      b.title = notes._r[s.dataset.row] ? RATINGS[notes._r[s.dataset.row]] : 'Unrated';
      b.onclick = () => show(+b.dataset.i);
    });
  };
  const grid = () => { if ($('grid').classList.contains('on')) $('grid').classList.remove('on'); else { buildGrid(); $('grid').classList.add('on'); } };

  const rowInfo = s => {
    const k = s.dataset.row;
    return { row: isNaN(+k) ? k : +k, id: s.dataset.ids, where: s.dataset.where, action: s.dataset.action,
      rating: RATINGS[notes._r[k]] || null,
      reasons: chips(k).map(x => { const p = x.split('|'); return { category: p[0], chip: p[1] }; }),
      comment: comment(k) };
  };
  const notesMd = () => {
    const out = ['# Notes on ' + D.title + ' (round ' + D.round + ')', ''];
    for (const v of [4, 3, 2, 1, 0]) {
      const lines = [];
      rowSlides.forEach(s => {
        const k = s.dataset.row;
        if ((notes._r[k] || 0) !== v || (v === 0 && !touched(k))) return;
        const r = rowInfo(s);
        const parts = ['Row ' + k + ' (' + s.dataset.where + ' / ' + s.dataset.action + ')'];
        if (r.rating) parts.push(r.rating);
        if (r.reasons.length) parts.push(r.reasons.map(x => x.chip).join(', '));
        if (r.comment) parts.push(r.comment.replace(/\n+/g, ' '));
        lines.push('- ' + parts.join(' — '));
      });
      if (lines.length) out.push('## ' + (v ? RATINGS[v] : 'Unrated, with notes'), '', ...lines, '');
    }
    if (comment('general')) out.push('## General', '', comment('general').replace(/\n+/g, ' '), '');
    return out.join('\n');
  };
  const notesJson = () => JSON.stringify({ folder: D.folder, round: Number(D.round) || D.round, rows: rowSlides.map(rowInfo).filter(r => r.rating || r.reasons.length || r.comment), general: comment('general') }, null, 2);
  const download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
  };
  $('copy').onclick = async () => {
    const t = notesMd();
    try { await navigator.clipboard.writeText(t); msg('Copied'); } catch (e) { prompt('Copy these notes:', t); }
  };
  $('dl').onclick = () => download(D.folder + '-round' + D.round + '-notes.md', notesMd(), 'text/markdown');
  $('dlj').onclick = () => download('review-' + D.folder + '-round' + D.round + '.json', notesJson(), 'application/json');
  window.__review = { notesJson, notesMd };
  $('prev').onclick = () => show(cur - 1); $('next').onclick = () => show(cur + 1); $('gbtn').onclick = grid;
  $('showappr').onclick = () => { showAppr = !showAppr; const s = slides[cur]; refilter(); tally(); const i = slides.indexOf(s); show(i < 0 ? 0 : i); };
  $('start').onclick = () => show(1); $('nextun').onclick = nextUnrated;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if ($('zoom').classList.contains('on')) $('zoom').classList.remove('on'); else if (typing()) document.activeElement.blur(); else $('grid').classList.remove('on'); return; }
    if (typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); show(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(cur - 1); }
    else if (e.key === 'g' || e.key === 'G') grid();
    else if (e.key === 'n' || e.key === 'N') nextUnrated();
    else if (e.key >= '1' && e.key <= '4') setRating(+e.key);
    else if (e.key === 'Home') show(0); else if (e.key === 'End') show(slides.length - 1);
  });
  let sx = null, sy = null;
  $('stage').addEventListener('touchstart', e => { if (typing()) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  $('stage').addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) show(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });
  document.querySelectorAll('.frames img').forEach(im => im.onclick = () => { $('zoom').firstChild.src = im.src; $('zoom').classList.add('on'); });
  $('zoom').onclick = () => $('zoom').classList.remove('on');

  tally();
  const h = (location.hash || '').slice(1).replace(/^row-?/i, '');
  const at = slides.findIndex(s => s.dataset.row === h);
  show(at > 0 ? at : 0);
})();
