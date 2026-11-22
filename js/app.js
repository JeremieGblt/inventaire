(function(){
  'use strict';

  // ==========================================================
  // Données : { fiches: [ {id, name, date, rows:[{id,name,qty,price}]} ] }
  // qty / price sont gardés tels que saisis ("2,5") et convertis au calcul.
  // ==========================================================
  const STORE_KEY = 'inventaire_v1';
  let data = { fiches: [] };
  let activeId = null;
  let memoryOnly = false;

  const $ = (id) => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };

  function load(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if (raw){ const d = JSON.parse(raw); if (d && Array.isArray(d.fiches)) data = d; }
    }catch(e){ memoryOnly = true; }
  }
  let saveTimer = null;
  function setSaved(ok){
    const el = $('savedState');
    el.textContent = ok ? 'Enregistré ✓' : 'Enregistrement…';
    el.classList.toggle('pending', !ok);
  }
  function saveSoon(){
    setSaved(false);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }
  function saveNow(){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(data)); setSaved(true); }
    catch(e){ memoryOnly = true; el_err(); }
  }
  function el_err(){ const el = $('savedState'); el.textContent = '⚠ Non enregistré (stockage indisponible)'; el.classList.add('pending'); }

  // ---------- Calculs ----------
  const num = (s) => {
    const n = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  };
  const round2 = (n) => Math.round(n * 100) / 100;
  const lineTotal = (r) => round2(num(r.qty) * num(r.price));
  const fmtEur = (n) => n.toLocaleString('fr-FR', { style:'currency', currency:'EUR' });
  const fmtQty = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  const ficheTotal = (f) => round2(f.rows.reduce((s, r) => s + lineTotal(r), 0));
  const ficheQty = (f) => f.rows.reduce((s, r) => s + num(r.qty), 0);
  const filledRows = (f) => f.rows.filter(r => (r.name || '').trim() || num(r.qty) || num(r.price));

  function esc(s){ const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML.replace(/"/g, '&quot;'); }
  function toast(msg, err){
    const t = $('toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const frDate = (iso) => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const getFiche = () => data.fiches.find(f => f.id === activeId);
  const newRow = () => ({ id: uid(), name: '', qty: '', price: '' });

  // ==========================================================
  // Accueil
  // ==========================================================
  function renderHome(){
    const list = $('ficheList');
    const sorted = data.fiches.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!sorted.length){
      list.innerHTML = '<div class="empty">Aucune fiche pour l\'instant.<br>Crée ta première fiche d\'inventaire.</div>';
    } else {
      list.innerHTML = sorted.map(f => `
        <div class="fiche-card" data-open="${f.id}">
          <div>
            <div class="name">${esc(f.name || 'Sans titre')}</div>
            <div class="meta">${frDate(f.date)} · ${filledRows(f).length} ligne${filledRows(f).length > 1 ? 's' : ''}</div>
          </div>
          <div class="amt">${fmtEur(ficheTotal(f))}</div>
        </div>`).join('');
    }
    const total = round2(data.fiches.reduce((s, f) => s + ficheTotal(f), 0));
    $('grandTotal').innerHTML = `<span>${data.fiches.length} fiche${data.fiches.length > 1 ? 's' : ''} · total général</span><strong>${fmtEur(total)}</strong>`;
    $('grandTotal').style.display = data.fiches.length ? '' : 'none';
  }

  function showHome(){
    activeId = null;
    $('viewFiche').style.display = 'none';
    $('viewHome').style.display = '';
    $('totalsBar').style.display = 'none';
    $('menu').style.display = 'none';
    renderHome();
    window.scrollTo(0, 0);
  }

  function createFiche(){
    const f = { id: uid(), name: '', date: today(), rows: [newRow(), newRow(), newRow()] };
    data.fiches.push(f);
    saveNow();
    openFiche(f.id, true);
  }

  // ==========================================================
  // Fiche
  // ==========================================================
  function openFiche(id, focusName){
    activeId = id;
    const f = getFiche(); if (!f) return showHome();
    $('viewHome').style.display = 'none';
    $('viewFiche').style.display = '';
    $('totalsBar').style.display = '';
    $('ficheName').value = f.name || '';
    $('ficheDate').value = f.date || today();
    setSaved(true);
    renderRows();
    updateTotals();
    window.scrollTo(0, 0);
    if (focusName) $('ficheName').focus();
  }

  function rowHtml(r){
    const t = lineTotal(r);
    return `<div class="trow" data-row="${r.id}">
      <input class="c-name" type="text" data-f="name" value="${esc(r.name)}" placeholder="Article" autocomplete="off" enterkeyhint="next">
      <input class="num" type="text" inputmode="decimal" data-f="qty" value="${esc(r.qty)}" placeholder="0" autocomplete="off" enterkeyhint="next">
      <input class="num" type="text" inputmode="decimal" data-f="price" value="${esc(r.price)}" placeholder="0,00" autocomplete="off" enterkeyhint="next">
      <span class="line-total ${t ? '' : 'zero'}">${t ? fmtEur(t) : '—'}</span>
      <button class="del" type="button" data-del="${r.id}" aria-label="Supprimer la ligne">✕</button>
    </div>`;
  }
  function renderRows(){
    const f = getFiche();
    $('rows').innerHTML = f.rows.map(rowHtml).join('');
  }
  function updateTotals(){
    const f = getFiche(); if (!f) return;
    const n = filledRows(f).length;
    $('tLines').textContent = n + ' ligne' + (n > 1 ? 's' : '');
    const q = ficheQty(f);
    $('tQty').textContent = fmtQty(q) + ' article' + (q > 1 ? 's' : '');
    $('tTotal').textContent = fmtEur(ficheTotal(f));
  }

  function addRow(focus){
    const f = getFiche(); const r = newRow();
    f.rows.push(r);
    $('rows').insertAdjacentHTML('beforeend', rowHtml(r));
    saveSoon(); updateTotals();
    if (focus){ const el = $('rows').querySelector(`[data-row="${r.id}"] [data-f="name"]`); if (el) el.focus(); }
  }

  // Saisie dans une cellule : mise à jour du modèle + totaux, sans recréer le tableau (garde le focus)
  $('rows').addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-f]'); if (!inp) return;
    const rowEl = inp.closest('[data-row]');
    const f = getFiche(); const r = f.rows.find(x => x.id === rowEl.dataset.row); if (!r) return;
    r[inp.dataset.f] = inp.value;
    const t = lineTotal(r);
    const cell = rowEl.querySelector('.line-total');
    cell.textContent = t ? fmtEur(t) : '—';
    cell.classList.toggle('zero', !t);
    updateTotals(); saveSoon();
  });
  $('rows').addEventListener('focusin', (e) => {
    const inp = e.target.closest('input.num'); if (inp) setTimeout(() => inp.select(), 0);
  });
  // Entrée : cellule suivante ; en bout de ligne -> ligne suivante (créée si besoin)
  $('rows').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest('input[data-f]'); if (!inp) return;
    e.preventDefault();
    const order = ['name', 'qty', 'price'];
    const i = order.indexOf(inp.dataset.f);
    const rowEl = inp.closest('[data-row]');
    if (i < 2){ rowEl.querySelector(`[data-f="${order[i+1]}"]`).focus(); return; }
    let next = rowEl.nextElementSibling;
    if (!next){ addRow(true); return; }
    next.querySelector('[data-f="name"]').focus();
  });
  $('rows').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]'); if (!del) return;
    const f = getFiche();
    f.rows = f.rows.filter(r => r.id !== del.dataset.del);
    if (!f.rows.length) f.rows.push(newRow());
    renderRows(); updateTotals(); saveSoon();
  });
  $('addRowBtn').addEventListener('click', () => addRow(true));
  $('ficheName').addEventListener('input', () => { getFiche().name = $('ficheName').value; saveSoon(); });
  $('ficheDate').addEventListener('input', () => { getFiche().date = $('ficheDate').value; saveSoon(); });

  // ---------- Navigation ----------
  $('newFicheBtn').addEventListener('click', createFiche);
  $('backBtn').addEventListener('click', () => { saveNow(); showHome(); });
  $('ficheList').addEventListener('click', (e) => {
    const c = e.target.closest('[data-open]'); if (c) openFiche(c.dataset.open);
  });

  // ---------- Menu ⋯ ----------
  $('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); const m = $('menu'); m.style.display = m.style.display === 'none' ? '' : 'none'; });
  document.addEventListener('click', () => { $('menu').style.display = 'none'; });
  $('menu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const f = getFiche(); if (!f) return;
    const act = b.dataset.act;
    if (act === 'csv') exportCSV(f);
    else if (act === 'xlsx') exportXLSX(f);
    else if (act === 'print') printFiche(f);
    else if (act === 'dup'){
      const copy = JSON.parse(JSON.stringify(f));
      copy.id = uid(); copy.name = (f.name || 'Sans titre') + ' (copie)'; copy.date = today();
      copy.rows.forEach(r => r.id = uid());
      data.fiches.push(copy); saveNow(); openFiche(copy.id); toast('Fiche dupliquée');
    }
    else if (act === 'clear'){
      if (confirm('Vider toutes les lignes de cette fiche ?')){ f.rows = [newRow(), newRow(), newRow()]; renderRows(); updateTotals(); saveSoon(); }
    }
    else if (act === 'del'){
      if (confirm(`Supprimer définitivement la fiche « ${f.name || 'Sans titre'} » ?`)){
        data.fiches = data.fiches.filter(x => x.id !== f.id); saveNow(); showHome(); toast('Fiche supprimée');
      }
    }
  });

  // ==========================================================
  // Exports
  // ==========================================================
  const slug = (s) => (s || 'inventaire').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'inventaire';
  const fileBase = (f) => `inventaire_${slug(f.name)}_${f.date || today()}`;
  function download(blob, name){
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvCell = (v) => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const frNum = (n) => String(n).replace('.', ',');

  function exportCSV(f){
    const rows = filledRows(f);
    const lines = [['Désignation', 'Quantité', 'Prix unitaire', 'Total'].join(';')];
    rows.forEach(r => lines.push([csvCell(r.name), frNum(num(r.qty)), frNum(num(r.price).toFixed(2)), frNum(lineTotal(r).toFixed(2))].join(';')));
    lines.push(['TOTAL', frNum(ficheQty(f)), '', frNum(ficheTotal(f).toFixed(2))].join(';'));
    download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileBase(f) + '.csv');
    toast('CSV exporté');
  }

  function exportXLSX(f){
    if (typeof XLSX === 'undefined'){ toast('Export Excel indisponible hors ligne', true); return; }
    const rows = filledRows(f);
    const aoa = [['Désignation', 'Quantité', 'Prix unitaire', 'Total']];
    rows.forEach((r, i) => aoa.push([r.name || '', num(r.qty), num(r.price), { t:'n', f:`B${i+2}*C${i+2}`, v: lineTotal(r) }]));
    const last = rows.length + 1;
    aoa.push(['TOTAL', { t:'n', f: rows.length ? `SUM(B2:B${last})` : '0', v: ficheQty(f) }, '', { t:'n', f: rows.length ? `SUM(D2:D${last})` : '0', v: ficheTotal(f) }]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 38 }, { wch: 10 }, { wch: 13 }, { wch: 13 }];
    for (let r = 2; r <= rows.length + 2; r++){
      ['C', 'D'].forEach(c => { const cell = ws[c + r]; if (cell && cell.t === 'n') cell.z = '#,##0.00 "€"'; });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (f.name || 'Inventaire').replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31));
    XLSX.writeFile(wb, fileBase(f) + '.xlsx');
    toast('Excel exporté');
  }

  function printFiche(f){
    const rows = filledRows(f);
    $('printArea').innerHTML = `
      <h1>${esc(f.name || 'Inventaire')}</h1>
      <div class="pd">Inventaire du ${frDate(f.date)}</div>
      <table>
        <thead><tr><th>Désignation</th><th class="r">Quantité</th><th class="r">Prix unitaire</th><th class="r">Total</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td><td class="r">${fmtQty(num(r.qty))}</td><td class="r">${fmtEur(num(r.price))}</td><td class="r">${fmtEur(lineTotal(r))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>TOTAL</td><td class="r">${fmtQty(ficheQty(f))}</td><td></td><td class="r">${fmtEur(ficheTotal(f))}</td></tr></tfoot>
      </table>`;
    window.print();
  }

  // ==========================================================
  // Sauvegarde / restauration
  // ==========================================================
  $('backupBtn').addEventListener('click', () => {
    download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `inventaire_sauvegarde_${today()}.json`);
    toast('Sauvegarde téléchargée');
  });
  $('restoreBtn').addEventListener('click', () => $('restoreInput').click());
  $('restoreInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try{
      const d = JSON.parse(await file.text());
      if (!d || !Array.isArray(d.fiches)) throw new Error('format');
      if (!confirm(`Restaurer ${d.fiches.length} fiche(s) ? Elles seront AJOUTÉES aux fiches actuelles.`)) return;
      const ids = new Set(data.fiches.map(f => f.id));
      d.fiches.forEach(f => { if (ids.has(f.id)) f.id = uid(); data.fiches.push(f); });
      saveNow(); renderHome(); toast('Sauvegarde restaurée');
    }catch(err){ toast('Fichier invalide', true); }
  });

  // Enregistrement immédiat si on quitte/masque la page avant la fin du délai
  const flush = () => { if (saveTimer){ clearTimeout(saveTimer); saveTimer = null; saveNow(); } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // ==========================================================
  load();
  if (memoryOnly) toast('Stockage indisponible : les données ne seront pas conservées', true);
  showHome();

  if ('serviceWorker' in navigator){
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
