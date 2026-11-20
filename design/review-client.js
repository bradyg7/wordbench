(() => {
  const D = JSON.parse(document.getElementById('data').textContent);
  const slides = [...document.querySelectorAll('.slide')];
  const KEY = 'review:' + D.folder + ':round' + D.round;
  let notes = {};
  try { notes = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) {} };
  const $ = id => document.getElementById(id);
  let cur = 0;
  const hasNote = k => !!(notes[k] || '').trim();

  const show = i => {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, j) => s.classList.toggle('on', j === cur));
    const s = slides[cur];
    s.scrollTop = 0;
    $('count').textContent = cur === 0 ? 'Title' : 'Row ' + s.dataset.row + ' (' + cur + ' of ' + (slides.length - 1) + ')';
    $('bar').firstChild.style.width = (slides.length > 1 ? cur / (slides.length - 1) * 100 : 100) + '%';
    try { history.replaceState(null, '', '#' + (s.dataset.row || 'title')); } catch (e) {}
    $('grid').classList.remove('on');
  };
  const typing = () => { const a = document.activeElement; return a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT'); };

  document.querySelectorAll('textarea[data-k]').forEach(t => {
    t.value = notes[t.dataset.k] || '';
    t.addEventListener('input', () => { notes[t.dataset.k] = t.value; save(); });
  });

  const buildGrid = () => {
    let h = '', g = null;
    slides.forEach((s, i) => {
      if (!s.dataset.row) return;
      if (s.dataset.group !== g) { if (g !== null) h += '</div>'; g = s.dataset.group; h += '<h3></h3><div class="cells">'; }
      h += '<button class="cell' + (hasNote(s.dataset.row) ? ' has' : '') + (i === cur ? ' cur' : '') + '" data-i="' + i + '"><b></b><span></span></button>';
    });
    $('grid').innerHTML = h + '</div>';
    const heads = $('grid').querySelectorAll('h3'); let hi = -1, last = null;
    slides.forEach((s, i) => { if (!s.dataset.row) return; if (s.dataset.group !== last) { last = s.dataset.group; hi++; heads[hi].textContent = last || 'Rows'; } });
    $('grid').querySelectorAll('.cell').forEach(b => {
      const s = slides[+b.dataset.i];
      b.firstChild.textContent = s.dataset.row; b.lastChild.textContent = s.dataset.label;
      b.onclick = () => show(+b.dataset.i);
    });
  };
  const grid = () => { if ($('grid').classList.contains('on')) $('grid').classList.remove('on'); else { buildGrid(); $('grid').classList.add('on'); } };

  const notesMd = () => {
    const out = ['Notes on ' + D.title + ' (round ' + D.round + ')', ''];
    slides.forEach(s => { const k = s.dataset.row; if (k && hasNote(k)) out.push('Row ' + k + ' (' + s.dataset.where + ' / ' + s.dataset.action + '): ' + notes[k].trim().replace(/\n+/g, ' ')); });
    if (hasNote('general')) out.push('General: ' + notes.general.trim().replace(/\n+/g, ' '));
    return out.join('\n') + '\n';
  };
  const msg = t => { $('msg').textContent = t; setTimeout(() => $('msg').textContent = '', 3000); };
  $('copy').onclick = async () => {
    const t = notesMd();
    try { await navigator.clipboard.writeText(t); msg('Copied'); } catch (e) { prompt('Copy these notes:', t); }
  };
  $('dl').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([notesMd()], { type: 'text/markdown' }));
    a.download = D.folder + '-round' + D.round + '-notes.md'; a.click();
  };
  $('prev').onclick = () => show(cur - 1); $('next').onclick = () => show(cur + 1); $('gbtn').onclick = grid;
  $('start').onclick = () => show(1);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if ($('zoom').classList.contains('on')) $('zoom').classList.remove('on'); else if (typing()) document.activeElement.blur(); else $('grid').classList.remove('on'); return; }
    if (typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); show(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(cur - 1); }
    else if (e.key === 'g' || e.key === 'G') grid();
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

  const h = (location.hash || '').slice(1);
  const at = slides.findIndex(s => s.dataset.row === h);
  show(at > 0 ? at : 0);
})();
