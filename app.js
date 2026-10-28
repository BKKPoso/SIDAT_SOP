'use strict';

/* ========== PENGATURAN (edit bagian ini saja) ========== */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxRRwSljjVR7TB8jflUmEYvtbfOElgn_RLW_xsqtDMCgx2-wONalYqZmqHlQpanEnNr/exec', // URL Web App Apps Script (berakhiran /exec)
  TITLE: 'SOP SIDAT POSO',                      // judul website
  NEW_DAYS: 14,                              // SOP dianggap "Baru" jika diubah dalam N hari terakhir
};
/* ======================================================= */

const CACHE_KEY = 'sop-index-v1';
const $ = (id) => document.getElementById(id);
const el = {
  title: $('siteTitle'), logo: $('siteLogo'), q: $('q'), updated: $('updated'), tree: $('tree'),
  crumbs: $('crumbs'), status: $('status'), subfolders: $('subfolders'), list: $('list'),
  side: $('sidebar'), toggleSide: $('toggleSide'), viewer: $('viewer'), vTitle: $('vTitle'),
  vFrame: $('vFrame'), vOpen: $('vOpen'), vDownload: $('vDownload'), vClose: $('vClose'), toast: $('toast'),
};

const S = { data: null, folders: {}, kids: {}, files: {}, fileMap: {}, totals: {}, rootId: null, folderId: null, query: '', open: new Set() };

/* ---------- Utilitas ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cmp = (a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
const fmtDate = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function hl(text, tokens) {
  if (!tokens.length) return esc(text);
  const re = new RegExp('(' + tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return text.split(re).map((p, i) => (i % 2 ? '<mark>' + esc(p) + '</mark>' : esc(p))).join('');
}

function kind(mime) {
  if (/image\//.test(mime)) return ['IMG', 'img'];
  if (mime === 'application/pdf') return ['PDF', 'pdf'];
  if (/sheet|excel/.test(mime)) return ['XLS', 'xls'];
  if (/presentation|powerpoint/.test(mime)) return ['PPT', 'ppt'];
  if (/word|document/.test(mime)) return ['DOC', 'doc'];
  return ['FILE', 'file'];
}

function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.toast.classList.remove('show'), 2000);
}

function setStatus(msg, isError) {
  el.status.textContent = msg || '';
  el.status.className = 'status' + (isError ? ' error' : '');
}

/* ---------- Olah data ---------- */
function pathOf(id) {
  const out = [];
  let cur = S.folders[id];
  while (cur) { out.unshift(cur); cur = cur.parentId ? S.folders[cur.parentId] : null; }
  return out;
}

function total(id) {
  if (S.totals[id] != null) return S.totals[id];
  let n = (S.files[id] || []).length;
  (S.kids[id] || []).forEach((k) => { n += total(k); });
  return (S.totals[id] = n);
}

function ingest(data) {
  S.data = data;
  S.rootId = data.rootId;
  S.folders = {}; S.kids = {}; S.files = {}; S.fileMap = {}; S.totals = {};

  // Logo adalah aset frontend lokal, bukan data dari Google Drive/API.
  // File logo harus berada di folder yang sama dengan index.html dan bernama SOP_LOGO.png.
  if (el.logo) {
    el.logo.src = './SOP_LOGO.png';
    el.logo.onerror = () => {
      el.logo.removeAttribute('src');
      el.logo.parentElement?.classList.add('logo-missing');
    };
  }

  data.folders.forEach((f) => {
    S.folders[f.id] = f;
    if (f.parentId) (S.kids[f.parentId] = S.kids[f.parentId] || []).push(f.id);
  });
  Object.keys(S.kids).forEach((k) => S.kids[k].sort((a, b) => cmp(S.folders[a].name, S.folders[b].name)));

  data.files.forEach((f) => {
    // Pengaman tambahan: bila file logo kebetulan ikut dikirim API, jangan tampilkan sebagai SOP.
    if (/^SOP_LOGO(?:\.[^.]+)?$/i.test(f.name)) return;
    f.title = f.name.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|odt|csv|png|jpe?g|webp|gif)$/i, '');
    f.where = pathOf(f.folderId).slice(1).map((x) => x.name).join(' / ');
    f.hay = norm(f.name + ' ' + f.where);
    f.isImage = /image\/(png|jpe?g|webp|gif|bmp|svg\+xml)/i.test(f.mimeType) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name);
    if (f.isImage) f.thumbUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(f.id) + '&sz=w700';
    S.fileMap[f.id] = f;
    (S.files[f.folderId] = S.files[f.folderId] || []).push(f);
  });
  Object.keys(S.files).forEach((k) => S.files[k].sort((a, b) => cmp(a.title, b.title)));

  if (!S.folders[S.folderId]) S.folderId = S.rootId;
  el.title.textContent = CONFIG.TITLE;
  document.title = CONFIG.TITLE;
  el.updated.textContent = 'Daftar diperbarui ' + new Date(data.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/* ---------- Tampilan ---------- */
function isNew(f) {
  return Date.now() - new Date(f.modified).getTime() < CONFIG.NEW_DAYS * 86400000;
}

function rowHtml(f, tokens, showWhere) {
  const [label, cls] = kind(f.mimeType);
  const visual = f.isImage
    ? `<div class="sop-thumb"><img src="${esc(f.thumbUrl)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
    : `<span class="type ${cls}" aria-hidden="true">${label}</span>`;
  return `<article class="row ${f.isImage ? 'row-image' : ''}">
    ${visual}
    <div class="info">
      <div class="menu-line"><span class="menu-number">SOP</span><span class="menu-dots"></span><span class="menu-tag">${f.isImage ? 'PNG' : label}</span></div>
      <h3>${hl(f.title, tokens)}${isNew(f) ? '<span class="badge-new">Baru</span>' : ''}</h3>
      <p class="sub">${showWhere && f.where ? `<span>${hl(f.where, tokens)}</span>` : ''}<span>Diubah ${fmtDate(f.modified)}</span></p>
    </div>
    <div class="actions">
      <button class="btn primary" type="button" data-act="view" data-id="${f.id}">Lihat</button>
      <a class="btn" href="${esc(f.downloadUrl)}" target="_blank" rel="noopener">Unduh</a>
      <button class="btn" type="button" data-act="copy" data-id="${f.id}">Salin tautan</button>
    </div>
  </article>`;
}


function treeBranch(parentId) {
  const ids = S.kids[parentId] || [];
  if (!ids.length) return '';
  return '<ul>' + ids.map((id) => {
    const f = S.folders[id];
    const has = (S.kids[id] || []).length > 0;
    const open = S.open.has(id);
    return `<li>
      <div class="node ${id === S.folderId && !S.query ? 'on' : ''}">
        ${has ? `<button class="tgl" type="button" data-toggle="${id}" aria-expanded="${open}" aria-label="${open ? 'Tutup' : 'Buka'} subfolder ${esc(f.name)}">${open ? '▾' : '▸'}</button>` : '<span class="tgl"></span>'}
        <button class="nm" type="button" data-folder="${id}">${esc(f.name)}</button>
        <span class="cnt">${total(id)}</span>
      </div>${has && open ? treeBranch(id) : ''}
    </li>`;
  }).join('') + '</ul>';
}

function renderTree() {
  const rootOn = S.folderId === S.rootId && !S.query;
  el.tree.innerHTML = `<div class="node ${rootOn ? 'on' : ''}">
      <span class="tgl"></span>
      <button class="nm" type="button" data-folder="${S.rootId}">Semua SOP</button>
      <span class="cnt">${total(S.rootId)}</span>
    </div>` + treeBranch(S.rootId);
}

function renderFolder() {
  const id = S.folderId;
  const path = pathOf(id);
  const label = (f) => (f.id === S.rootId ? 'Semua SOP' : f.name);

  el.crumbs.innerHTML = path.map((f, i) => (i === path.length - 1
    ? `<span aria-current="page">${esc(label(f))}</span>`
    : `<button class="link" type="button" data-folder="${f.id}">${esc(label(f))}</button>`)).join('<span class="sep">/</span>');

  const kids = S.kids[id] || [];
  el.subfolders.innerHTML = kids.map((k) => `<button class="fcard" type="button" data-folder="${k}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
      <span><span class="fn">${esc(S.folders[k].name)}</span><span class="fc">${total(k)} SOP</span></span>
    </button>`).join('');

  const files = S.files[id] || [];
  if (files.length) {
    setStatus(files.length + ' SOP di folder ini');
    el.list.innerHTML = files.map((f) => rowHtml(f, [], false)).join('');
  } else {
    setStatus('');
    el.list.innerHTML = `<div class="empty">${kids.length ? 'Belum ada SOP langsung di folder ini. Pilih salah satu subfolder di atas.' : 'Folder ini masih kosong.'}</div>`;
  }
}

function renderSearch(tokens) {
  const needles = tokens.map(norm);
  const hits = Object.values(S.fileMap).filter((f) => needles.every((n) => f.hay.includes(n)));
  const nameScore = (f) => needles.filter((n) => norm(f.title).includes(n)).length;
  hits.sort((a, b) => nameScore(b) - nameScore(a) || cmp(a.title, b.title));

  el.crumbs.innerHTML = `<span aria-current="page">Hasil pencarian</span>`;
  el.subfolders.innerHTML = '';
  setStatus(hits.length ? `${hits.length} SOP ditemukan untuk “${S.query.trim()}”` : '');
  el.list.innerHTML = hits.length
    ? hits.map((f) => rowHtml(f, tokens, true)).join('')
    : `<div class="empty">Tidak ada SOP yang cocok dengan “${esc(S.query.trim())}”. Coba kata kunci yang lebih singkat atau telusuri lewat folder.</div>`;
}

function render() {
  if (!S.data) return;
  const tokens = S.query.trim().split(/\s+/).filter(Boolean);
  renderTree();
  if (tokens.length) renderSearch(tokens); else renderFolder();
}

/* ---------- Navigasi ---------- */
function openPath(id) {
  pathOf(id).forEach((f) => S.open.add(f.id));
}

function goFolder(id, push) {
  S.folderId = S.folders[id] ? id : S.rootId;
  S.query = '';
  el.q.value = '';
  openPath(S.folderId);
  el.side.classList.remove('open');
  render();
  if (push) history.pushState(null, '', S.folderId === S.rootId ? location.pathname : '#' + S.folderId);
}

function readHash() {
  const id = location.hash.slice(1);
  S.folderId = S.folders[id] ? id : S.rootId;
  openPath(S.folderId);
}

/* ---------- Pratinjau & salin tautan ---------- */
function openViewer(f) {
  el.vTitle.textContent = f.title;
  el.vFrame.src = f.previewUrl;
  el.vOpen.href = f.openUrl;
  el.vDownload.href = f.downloadUrl;
  el.viewer.showModal();
}

async function copyLink(f) {
  try {
    await navigator.clipboard.writeText(f.openUrl);
    toast('Tautan disalin');
  } catch (e) {
    window.prompt('Salin tautan ini:', f.openUrl);
  }
}

/* ---------- Event ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-folder],[data-toggle],[data-act]');
  if (!t) return;
  if (t.dataset.toggle) {
    const id = t.dataset.toggle;
    if (S.open.has(id)) S.open.delete(id); else S.open.add(id);
    renderTree();
  } else if (t.dataset.folder) {
    goFolder(t.dataset.folder, true);
  } else if (t.dataset.act === 'view') {
    openViewer(S.fileMap[t.dataset.id]);
  } else if (t.dataset.act === 'copy') {
    copyLink(S.fileMap[t.dataset.id]);
  }
});

el.q.addEventListener('input', () => { S.query = el.q.value; render(); });
el.toggleSide.addEventListener('click', () => el.side.classList.toggle('open'));
el.vClose.addEventListener('click', () => el.viewer.close());
el.viewer.addEventListener('click', (e) => { if (e.target === el.viewer) el.viewer.close(); });
el.viewer.addEventListener('close', () => { el.vFrame.src = 'about:blank'; });
window.addEventListener('popstate', () => { if (S.data) { readHash(); S.query = ''; el.q.value = ''; render(); } });

/* ---------- Muat data ---------- */
async function load() {
  el.title.textContent = CONFIG.TITLE;
  document.title = CONFIG.TITLE;

  if (!CONFIG.API_URL || CONFIG.API_URL.indexOf('GANTI') === 0) {
    setStatus('URL Web App belum diisi. Buka app.js, lalu isi CONFIG.API_URL.', true);
    return;
  }

  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { /* abaikan */ }
  if (cached && cached.folders && cached.files) {
    ingest(cached); readHash(); render();           // tampilkan data lama dulu agar terasa cepat
  } else {
    setStatus('Memuat daftar SOP…');
  }

  try {
    const res = await fetch(CONFIG.API_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const first = !S.data;
    ingest(data);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* abaikan */ }
    if (first) readHash();
    render();
  } catch (err) {
    if (!S.data) setStatus('Daftar SOP gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.', true);
  }
}

load();
