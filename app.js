// ---- Persistence helpers ----
const STORAGE_KEY = 'taskflow:v1';
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; } }

// ---- Default state ----
const defaultState = {
  lists: ['backlog', 'inprogress', 'done'],
  cards: {}
};
let state = load() || defaultState;

// ---- Seed demo cards if empty ----
function seedDemo() {
  if (Object.keys(state.cards).length > 0) return; // already has cards

  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  state.cards = {
    'c-1': {
      id: 'c-1',
      title: 'Design homepage',
      desc: 'Create a modern landing page layout.',
      labels: ['design', 'ui'],
      due: tomorrow.toISOString().split('T')[0],
      list: 'backlog'
    },
    'c-2': {
      id: 'c-2',
      title: 'Fix login bug',
      desc: 'Resolve user session issue on Safari.',
      labels: ['bug', 'urgent'],
      due: yesterday.toISOString().split('T')[0],
      list: 'inprogress'
    },
    'c-3': {
      id: 'c-3',
      title: 'Write documentation',
      desc: 'Add setup steps to README.md',
      labels: ['docs'],
      due: '',
      list: 'done'
    }
  };

  save();
}
seedDemo();

// ---- Filters ----
let filters = { search: '', label: '', overdue: false };

// ---- Dark Mode ----
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('theme');
const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
document.documentElement.classList.toggle('dark', isDark);
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
  themeBtn.setAttribute('aria-pressed', isDark);
  themeBtn.addEventListener('click', (e) => {
    const nowDark = document.documentElement.classList.toggle('dark');
    e.currentTarget.setAttribute('aria-pressed', nowDark);
    localStorage.setItem('theme', nowDark ? 'dark' : 'light');
  });
}

// ---- Render ----
function render() {
  state.lists.forEach(list => {
    const mount = document.querySelector(`#${list} .cards`);
    if (!mount) return;
    mount.innerHTML = '';

    Object.values(state.cards)
      .filter(card => card.list === list)
      .filter(applyFilters)
      .forEach(card => {
        const el = document.createElement('article');
        el.className = 'card';
        el.dataset.id = card.id;
        el.setAttribute('draggable', card.editing ? 'false' : 'true');

        if (card.editing) {
          el.innerHTML = `
            <form class="edit-form">
              <input type="text" name="title" value="${escapeHtml(card.title)}" required />
              <textarea name="desc" placeholder="Description...">${escapeHtml(card.desc || '')}</textarea>
              <input type="text" name="labels" value="${(card.labels||[]).join(', ')}" placeholder="Labels" />
              <input type="date" name="due" value="${card.due || ''}" />
              <div class="card-actions">
                <button type="submit">Save</button>
                <button type="button" class="cancel-edit">Cancel</button>
              </div>
            </form>
          `;
        } else {
          const labelsHtml = card.labels?.length
            ? `<div class="labels">${card.labels.map(l => `<span class="label-chip">${escapeHtml(l)}</span>`).join('')}</div>`
            : '';
          const dueHtml = card.due
            ? `<div class="meta"><span class="due ${isOverdue(card.due) ? 'overdue' : 'ok'}">${card.due}</span></div>`
            : '';

          el.innerHTML = `
            <h3 class="open-modal" data-id="${card.id}">${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.desc || '')}</p>
            ${labelsHtml}
            ${dueHtml}
            <div class="card-actions">
              <button class="move-left" data-id="${card.id}" title="Move left">←</button>
              <button class="move-right" data-id="${card.id}" title="Move right">→</button>
              <button class="edit" data-id="${card.id}" title="Edit">✏️</button>
              <button class="delete" data-id="${card.id}" title="Delete">🗑</button>
            </div>
          `;
        }

        mount.appendChild(el);
      });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function isOverdue(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  return dateStr < today;
}

function applyFilters(card) {
  if (filters.search && !card.title.toLowerCase().includes(filters.search)) return false;
  if (filters.label && !(card.labels||[]).some(l => l.toLowerCase().includes(filters.label))) return false;
  if (filters.overdue && (!card.due || !isOverdue(card.due))) return false;
  return true;
}

render();

// ---- Add card forms ----
document.querySelectorAll('.list').forEach(listEl => {
  const listId = listEl.id;
  const showBtn = listEl.querySelector('.show-form');
  const form = listEl.querySelector('.add-card-form');
  if (!showBtn || !form) return;

  const cancelBtn = form.querySelector('.cancel');
  showBtn.addEventListener('click', () => { showBtn.style.display = 'none'; form.classList.remove('hidden'); });
  cancelBtn.addEventListener('click', () => { form.reset(); form.classList.add('hidden'); showBtn.style.display = ''; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return;
    const labels = form.labels.value.split(',').map(s => s.trim()).filter(Boolean);
    const due = form.due.value;
    const id = `c-${Date.now()}`;
    state.cards[id] = { id, title, desc: '', labels, due, list: listId };
    save(); render();
    form.reset(); form.classList.add('hidden'); showBtn.style.display = '';
  });
});

// ---- Card actions ----
const order = ['backlog', 'inprogress', 'done'];
document.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.classList.contains('cancel-edit')) {
    const id = target.closest('.card')?.dataset.id;
    if (id && state.cards[id]) { state.cards[id].editing = false; render(); }
    return;
  }

  const id = target.dataset.id;
  if (!id) return;
  const card = state.cards[id];
  if (!card) return;
  const idx = order.indexOf(card.list);

  if (target.classList.contains('move-left')) { if (idx>0){ card.list=order[idx-1]; save(); render(); } return; }
  if (target.classList.contains('move-right')){ if (idx<order.length-1){ card.list=order[idx+1]; save(); render(); } return; }
  if (target.classList.contains('edit')) { card.editing = true; render(); return; }
  if (target.classList.contains('delete')) { if(confirm('Delete?')){ delete state.cards[id]; save(); render(); } return; }
});

// ---- Edit form submit ----
document.addEventListener('submit', (e) => {
  if (!(e.target instanceof HTMLFormElement)) return;
  if (!e.target.classList.contains('edit-form')) return;
  e.preventDefault();
  const id = e.target.closest('.card')?.dataset.id;
  const card = id? state.cards[id]:null;
  if (!card) return;
  card.title = e.target.title.value.trim();
  card.desc = e.target.desc.value.trim();
  card.labels = e.target.labels.value.split(',').map(s=>s.trim()).filter(Boolean);
  card.due = e.target.due.value;
  card.editing = false;
  save(); render();
});

// ---- Drag & Drop ----
let draggedId=null;
document.addEventListener('dragstart',(e)=>{ const card=e.target.closest('.card'); if(card){draggedId=card.dataset.id;} });
document.addEventListener('dragend',()=>{draggedId=null;});
document.querySelectorAll('.cards').forEach(listEl=>{
  listEl.addEventListener('dragover',(e)=>{e.preventDefault();listEl.classList.add('drag-over');});
  listEl.addEventListener('dragleave',()=>{listEl.classList.remove('drag-over');});
  listEl.addEventListener('drop',(e)=>{e.preventDefault();listEl.classList.remove('drag-over');if(draggedId){state.cards[draggedId].list=listEl.parentElement.id; save(); render();}});
});

// ---- Filters wiring ----
document.getElementById('searchInput').addEventListener('input',(e)=>{filters.search=e.target.value.toLowerCase(); render();});
document.getElementById('labelInput').addEventListener('input',(e)=>{filters.label=e.target.value.toLowerCase(); render();});
document.getElementById('overdueOnly').addEventListener('change',(e)=>{filters.overdue=e.target.checked; render();});

// ---- Export / Import ----
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'taskflow-board.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!imported.cards || !imported.lists) throw new Error('Invalid file');
      state = imported;
      save();
      render();
      alert('Board imported!');
    } catch {
      alert('Import failed: invalid JSON');
    }
  };
  reader.readAsText(file);
});

// ---- Modal logic ----
const modal = document.getElementById('modal');
const modalBody = modal.querySelector('.modal-body');
const closeBtn = modal.querySelector('.close-modal');

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('open-modal')) {
    const id = e.target.dataset.id;
    const card = state.cards[id];
    if (!card) return;

    modalBody.innerHTML = `
      <h2>${escapeHtml(card.title)}</h2>
      <p>${escapeHtml(card.desc || '')}</p>
      ${(card.labels||[]).map(l => `<span class="label-chip">${escapeHtml(l)}</span>`).join(' ')}
      ${card.due ? `<p><strong>Due:</strong> ${card.due} ${isOverdue(card.due) ? '(overdue)' : ''}</p>` : ''}
    `;
    modal.classList.remove('hidden');
  }

  if (e.target.classList.contains('close-modal')) {
    modal.classList.add('hidden');
  }
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});
