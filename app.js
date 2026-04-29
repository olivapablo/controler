/* ═══════════════════════════════════════════════
   EDUTRACK – APP.JS
   PWA de gestión académica docente
   ═══════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────
const CONFIG = {
  START_DATE: new Date(2026, 2, 17), // 17 de marzo 2026 (mes 0-indexed)
  CLASS_DAYS: [2, 4],                // 2=Martes, 4=Jueves
  DB_NAME: 'EduTrackDB',
  DB_VERSION: 1,
  STORE_NAME: 'students',
};

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let state = {
  students: [],
  contents: [],
  currentStudentId: null,
  currentTab: 'asistencia',
  searchQuery: '',
  theme: 'auto',
  editingObsId: null,
  editingStudentId: null,
  topicLog: [],
};

// ──────────────────────────────────────────────
// DB (Firebase)
// ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyQ_cYuzoHQgnc2LErDw1fYX2fSuFfwVs9QW",
  authDomain: "data-estudiantes.firebaseapp.com",
  projectId: "data-estudiantes",
  storageBucket: "data-estudiantes.firebasestorage.app",
  messagingSenderId: "460618307194",
  appId: "1:460618307194:web:27ed7f257128f1b5e3cdc3"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

function initDB() {
  return Promise.resolve(); // Firebase inicializa de forma síncrona
}

async function dbGetAll() {
  try {
    const snapshot = await db.collection(CONFIG.STORE_NAME).get();
    const list = [];
    snapshot.forEach(doc => list.push(doc.data()));
    return list;
  } catch (err) {
    console.error("Error obteniendo datos de Firebase", err);
    return [];
  }
}

function dbPut(student) {
  return db.collection(CONFIG.STORE_NAME).doc(student.id).set(student);
}

function dbDelete(id) {
  return db.collection(CONFIG.STORE_NAME).doc(id).delete();
}

async function dbClear() {
  const snapshot = await db.collection(CONFIG.STORE_NAME).get();
  const batch = db.batch();
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  return batch.commit();
}

// Global Contents
async function dbGetContents() {
  try {
    const snapshot = await db.collection('contents').orderBy('createdAt', 'asc').get();
    const list = [];
    snapshot.forEach(doc => list.push(doc.data()));
    return list;
  } catch (err) {
    console.error("Error obteniendo contenidos", err);
    return [];
  }
}

function dbPutContent(content) {
  return db.collection('contents').doc(content.id).set(content);
}

function dbDeleteContent(id) {
  return db.collection('contents').doc(id).delete();
}

// Global Topics
async function dbGetTopics() {
  try {
    const snapshot = await db.collection('topics').orderBy('date', 'desc').get();
    const list = [];
    snapshot.forEach(doc => list.push(doc.data()));
    return list;
  } catch (err) {
    console.error("Error obteniendo libro de temas", err);
    return [];
  }
}

function dbPutTopic(topic) {
  return db.collection('topics').doc(topic.id).set(topic);
}

function dbDeleteTopic(id) {
  return db.collection('topics').doc(id).delete();
}

// ──────────────────────────────────────────────
// DATE & HOLIDAY UTILS
// ──────────────────────────────────────────────
const HOLIDAYS_2026 = {
  '2026-03-24': 'Feriado: Día de la Memoria',
  '2026-04-02': 'Feriado: Día del Veterano y Caídos en Malvinas',
  '2026-07-07': 'Receso Invernal',
  '2026-07-09': 'Feriado: Día de la Independencia',
  '2026-07-14': 'Receso Invernal',
  '2026-07-16': 'Receso Invernal',
  '2026-12-08': 'Feriado: Inmaculada Concepción de María'
};

function getClassDates() {
  const dates = [];
  const today = new Date();
  today.setHours(23, 59, 59, 0);
  const cur = new Date(CONFIG.START_DATE);
  cur.setHours(0, 0, 0, 0);
  while (cur <= today) {
    if (CONFIG.CLASS_DAYS.includes(cur.getDay())) {
      dates.push(cur.toISOString().split('T')[0]);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDate(isoString) {
  const d = new Date(isoString + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function getDayName(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  const day = d.getDay();
  return day === 2 ? 'Mar' : 'Jue';
}

// ──────────────────────────────────────────────
// STUDENT UTILS
// ──────────────────────────────────────────────
function createStudent(name, email = '', notes = '') {
  const dates = getClassDates();
  const attendance = {};
  dates.forEach(d => { attendance[d] = null; }); // null = sin marcar
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: name.trim(),
    email: email.trim(),
    notes: notes.trim(),
    attendance,
    grades: { practica: [], teorica: [] },
    observations: [],
    medico: { ficha: false, notas: '' },
    active: true,
    createdAt: new Date().toISOString(),
  };
}

function toggleDeactivated(containerId, isDeactivated) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const msg = container.querySelector('.deactivated-msg');
  const inner = container.querySelector('.tab-content-inner');
  if (msg && inner) {
    if (isDeactivated) {
      msg.classList.remove('hidden');
      inner.classList.add('hidden');
    } else {
      msg.classList.add('hidden');
      inner.classList.remove('hidden');
    }
  }
}

function getAttendanceStats(student) {
  const dates = getClassDates();
  let present = 0, absent = 0, pending = 0, total = 0;
  dates.forEach(d => {
    if (HOLIDAYS_2026[d]) return; // Skip holidays for stats

    total++;
    const val = student.attendance[d];
    if (val === true) present++;
    else if (val === false) absent++;
    else pending++;
  });
  const marked = present + absent;
  const pct = marked > 0 ? Math.round((present / marked) * 100) : 100;
  return { present, absent, pending, total, pct };
}

function getAverage(grades) {
  if (!grades || grades.length === 0) return null;
  const sum = grades.reduce((a, g) => a + g.value, 0);
  return (sum / grades.length).toFixed(1);
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAttendanceBadgeClass(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'orange';
  return 'red';
}

// Sync new class dates to existing students
function syncDatesToStudents() {
  const dates = getClassDates();
  state.students.forEach(s => {
    dates.forEach(d => {
      if (!(d in s.attendance)) s.attendance[d] = null;
    });
  });
}

// ──────────────────────────────────────────────
// THEME
// ──────────────────────────────────────────────
function applyTheme(theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const sunIcon = document.getElementById('icon-sun');
  const moonIcon = document.getElementById('icon-moon');
  if (isDark) { sunIcon.classList.remove('hidden'); moonIcon.classList.add('hidden'); }
  else { sunIcon.classList.add('hidden'); moonIcon.classList.remove('hidden'); }
  // Update meta theme-color
  document.querySelector('meta[name="theme-color"][media*="dark"]')
    ?.setAttribute('content', isDark ? '#0B1F3A' : '#FFFFFF');
  document.querySelector('meta[name="theme-color"][media*="light"]')
    ?.setAttribute('content', isDark ? '#0B1F3A' : '#FFFFFF');
}

function toggleTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const curr = document.documentElement.getAttribute('data-theme');
  if (curr === 'dark') { state.theme = 'light'; applyTheme('light'); }
  else { state.theme = 'dark'; applyTheme('dark'); }
  localStorage.setItem('edutrack-theme', state.theme);
}

// ──────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  requestAnimationFrame(() => { t.classList.add('show'); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 300);
  }, duration);
}

// ──────────────────────────────────────────────
// MODALS
// ──────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  m.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const m = document.getElementById(id);
  m.classList.add('hidden');
  document.body.style.overflow = '';
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.classList.add('hidden');
  });
  document.body.style.overflow = '';
}

// ──────────────────────────────────────────────
// CONFIRM DIALOG
// ──────────────────────────────────────────────
function showConfirm(title, msg, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  openModal('modal-confirm');
  const btnOk = document.getElementById('btn-confirm-ok');
  const btnCancel = document.getElementById('btn-confirm-cancel');
  const cleanup = () => { btnOk.replaceWith(btnOk.cloneNode(true)); closeModal('modal-confirm'); };
  document.getElementById('btn-confirm-cancel').onclick = cleanup;
  document.getElementById('btn-confirm-ok').onclick = () => { cleanup(); onOk(); };
}

// ──────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

function goHome() {
  state.currentStudentId = null;
  state.currentTab = 'asistencia';
  document.getElementById('header-title').textContent = 'Gestión de Alumnos';
  document.getElementById('header-sub').classList.add('hidden');
  document.getElementById('btn-back').classList.add('hidden');
  document.getElementById('btn-menu').classList.remove('hidden');
  showView('view-home');
  renderHome();
}

function goStudent(id) {
  const student = state.students.find(s => s.id === id);
  if (!student) return;
  state.currentStudentId = id;
  state.currentTab = 'asistencia';
  document.getElementById('header-title').textContent = student.name;
  document.getElementById('header-sub').textContent = 'Perfil del estudiante';
  document.getElementById('header-sub').classList.remove('hidden');
  document.getElementById('btn-back').classList.remove('hidden');
  document.getElementById('btn-menu').classList.add('hidden');
  showView('view-student');
  renderStudentDetail(student);
}

// ──────────────────────────────────────────────
// RENDER: HOME
// ──────────────────────────────────────────────
function renderHome() {
  renderStats();
  renderStudentList();
}

function renderStats() {
  const bar = document.getElementById('stats-bar');
  if (!bar) return;
  const activeStudents = state.students.filter(s => s.active !== false);
  const totalActive = activeStudents.length;

  const avgAttend = totalActive === 0 ? 0 :
    Math.round(activeStudents.reduce((a, s) => a + getAttendanceStats(s).pct, 0) / totalActive);

  const withFicha = activeStudents.filter(s => s.medico?.ficha).length;

  bar.innerHTML = `
    <div class="stat-chip">Estudiantes <span class="chip-num">${totalActive}</span></div>
    <div class="stat-chip">Asistencia media <span class="chip-num">${avgAttend}%</span></div>
    <div class="stat-chip">Fichas médicas <span class="chip-num">${withFicha}</span></div>
    <div class="stat-chip">Clases dictadas <span class="chip-num">${getClassDates().length}</span></div>
  `;
}

function renderStudentList() {
  const list = document.getElementById('student-list');
  const empty = document.getElementById('empty-state');
  const emptyMsg = document.getElementById('empty-msg');
  const q = state.searchQuery.toLowerCase().trim();

  let students = [...state.students].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (q) students = students.filter(s => s.name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));

  if (students.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    emptyMsg.innerHTML = q
      ? `No se encontraron resultados para <strong>"${escapeHtml(q)}"</strong>.`
      : 'Aún no hay estudiantes.<br>Usá el botón + para agregar uno.';
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = students.map((s, i) => {
    const stats = getAttendanceStats(s);
    const badgeClass = getAttendanceBadgeClass(stats.pct);
    const avgP = getAverage(s.grades.practica);
    const avgT = getAverage(s.grades.teorica);

    return `
    <div class="student-card" data-id="${s.id}" style="animation-delay:${i * 40}ms">
      <div class="avatar" style="${avatarGradient(s.id)}">${escapeHtml(getInitials(s.name))}</div>
      <div class="student-card-info">
        <div class="student-card-name">${escapeHtml(s.name)}</div>
        <div class="student-card-meta">
          <span class="mini-badge ${badgeClass}">${stats.pct}% asistencia</span>
          ${avgP !== null ? `<span class="mini-badge green">P: ${avgP}</span>` : ''}
          ${avgT !== null ? `<span class="mini-badge green">T: ${avgT}</span>` : ''}
          ${s.medico?.ficha ? '<span class="mini-badge gray">📋 Ficha</span>' : ''}
          ${s.active === false ? '<span class="mini-badge red">DESACTIVADO</span>' : ''}
        </div>
      </div>
      <div class="student-card-arrow">
        <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.student-card').forEach(card => {
    card.addEventListener('click', () => goStudent(card.dataset.id));
  });
}

function avatarGradient(id) {
  // Azul (#1E3A8A) a Rojo (#DC2626)
  return `background: linear-gradient(135deg, #1E3A8A, #DC2626)`;
}

// ──────────────────────────────────────────────
// RENDER: STUDENT DETAIL
// ──────────────────────────────────────────────
function renderStudentDetail(student) {
  // Avatar & name
  const avatarEl = document.getElementById('detail-avatar');
  avatarEl.textContent = getInitials(student.name);
  avatarEl.setAttribute('style', avatarGradient(student.id));

  document.getElementById('detail-name').textContent = student.name;

  // Badges
  const stats = getAttendanceStats(student);
  const avgP = getAverage(student.grades.practica);
  const avgT = getAverage(student.grades.teorica);
  document.getElementById('detail-badges').innerHTML = `
    <span class="mini-badge ${getAttendanceBadgeClass(stats.pct)}">${stats.pct}% asistencia</span>
    ${avgP !== null ? `<span class="mini-badge green">P: ${avgP}</span>` : ''}
    ${avgT !== null ? `<span class="mini-badge green">T: ${avgT}</span>` : ''}
    ${student.medico?.ficha ? '<span class="mini-badge gray">📋 Ficha entregada</span>' : ''}
    ${student.active === false ? '<span class="mini-badge red">DESACTIVADO</span>' : ''}
  `;

  // Reset tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('.tab[data-tab="asistencia"]').classList.add('active');
  document.getElementById('tab-asistencia').classList.add('active');

  renderAttendance(student);
  renderGrades(student);
  renderObservations(student);
  renderMedico(student);

  // Active/Inactive toggle
  const btnToggle = document.getElementById('btn-toggle-active');
  if (student.active === false) {
    btnToggle.textContent = 'Activar estudiante';
    btnToggle.className = 'btn-primary';
    btnToggle.style.background = 'linear-gradient(135deg, #1E3A8A, #DC2626)';
    btnToggle.style.color = 'white';
    btnToggle.style.border = 'none';
  } else {
    btnToggle.textContent = 'Desactivar estudiante';
    btnToggle.className = 'btn-danger';
    btnToggle.style.background = 'var(--danger)';
    btnToggle.style.color = 'white';
    btnToggle.style.border = 'none';
  }

  btnToggle.onclick = async () => {
    const newState = !student.active;
    const msg = newState
      ? '¿Deseas volver a activar a este estudiante?'
      : '¿Deseas desactivar a este estudiante? No aparecerá en las listas de asistencia.';

    showConfirm(newState ? 'Activar' : 'Desactivar', msg, async () => {
      student.active = newState;
      await dbPut(student);
      showToast(newState ? 'Estudiante activado' : 'Estudiante desactivado');
      renderStudentDetail(student);
      renderStudentList();
    });
  };
}

// ── ATTENDANCE ──
function renderAttendance(student) {
  toggleDeactivated('tab-asistencia', student.active === false);
  if (student.active === false) return;

  const stats = getAttendanceStats(student);

  document.getElementById('attendance-summary').innerHTML = `
    <div class="attend-pct">${stats.pct}<span>%</span></div>
    <div class="attend-detail">
      <div class="attend-label">Porcentaje de asistencia</div>
      <div class="attend-bar-wrap">
        <div class="attend-bar" style="width:${stats.pct}%"></div>
      </div>
      <div class="attend-counts">
        <span>✅ ${stats.present} presentes</span>
        <span>❌ ${stats.absent} ausentes</span>
        <span>⏳ ${stats.pending} sin marcar</span>
      </div>
    </div>
  `;

  const dates = getClassDates().reverse(); // más reciente primero
  const listEl = document.getElementById('attendance-list');

  listEl.innerHTML = dates.map(d => {
    const isHoliday = HOLIDAYS_2026[d];
    const val = student.attendance[d];
    const dayName = getDayName(d);

    if (isHoliday) {
      return `
      <div class="attend-row holiday-row">
        <div class="attend-date" style="text-decoration: line-through; opacity: 0.6;">${formatDate(d)}</div>
        <span class="attend-day-badge">${dayName}</span>
        <div class="holiday-label">${isHoliday}</div>
      </div>`;
    }

    const presentActive = val === true ? 'active-present' : '';
    const absentActive = val === false ? 'active-absent' : '';
    return `
    <div class="attend-row">
      <div class="attend-date">${formatDate(d)}</div>
      <span class="attend-day-badge">${dayName}</span>
      <div class="attend-toggle">
        <button class="attend-btn ${presentActive}" data-date="${d}" data-val="true" title="Presente">✓</button>
        <button class="attend-btn ${absentActive}" data-date="${d}" data-val="false" title="Ausente">✗</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.attend-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const d = btn.dataset.date;
      const val = btn.dataset.val === 'true';
      const current = student.attendance[d];
      // Toggle: si ya está marcado igual, desmarca
      student.attendance[d] = (current === val) ? null : val;
      await dbPut(student);
      renderAttendance(student);
      // Update badges
      const stats2 = getAttendanceStats(student);
      document.getElementById('detail-badges').querySelector(`.mini-badge`).className =
        `mini-badge ${getAttendanceBadgeClass(stats2.pct)}`;
      document.getElementById('detail-badges').querySelector(`.mini-badge`).textContent =
        `${stats2.pct}% asistencia`;
      renderStats();
    });
  });
}

// ── GRADES ──
let recuperatorioContext = { type: null, idx: null };

function isFailing(val) {
  return val === 'A' || val === 'NR' || (typeof val === 'number' && val < 7);
}

function renderGrades(student) {
  toggleDeactivated('tab-notas', student.active === false);
  if (student.active === false) return;

  ['practica', 'teorica'].forEach(type => {
    const listEl = document.getElementById(`grades-${type === 'practica' ? 'practicas' : 'teoricas'}`);
    const avgEl = document.getElementById(`avg-${type === 'practica' ? 'practicas' : 'teoricas'}`);
    const grades = student.grades[type] || [];

    if (grades.length === 0) {
      listEl.innerHTML = '<p style="font-size:13px;color:var(--text-muted);padding:4px 0">Sin notas aún.</p>';
    } else {
      listEl.innerHTML = grades.map((g, i) => {
        const isSpecial = g.value === 'A' || g.value === 'NR';
        const valClass = isSpecial ? 'failing' : (parseFloat(g.value) >= 7 ? 'passing' : 'failing');
        const failing = isFailing(g.value);

        // Recuperatorio row
        let recHtml = '';
        if (failing) {
          if (g.recuperatorio !== undefined && g.recuperatorio !== null) {
            const rv = g.recuperatorio;
            const recClass = rv === 'NR' ? 'failing' : (parseFloat(rv) >= 7 ? 'passing' : 'failing');
            const recLabel = rv === 'NR' ? 'No lo realizó' : `R: ${rv}`;
            recHtml = `
              <div class="rec-row">
                <span class="rec-label grade-cell ${recClass}">${recLabel}</span>
                <button class="rec-edit-btn" data-type="${type}" data-idx="${i}" title="Editar recuperatorio">✏️</button>
              </div>`;
          } else {
            recHtml = `
              <div class="rec-row">
                <button class="rec-add-btn" data-type="${type}" data-idx="${i}">➕ Recuperatorio</button>
              </div>`;
          }
        }

        return `
        <div class="grade-item" style="flex-wrap:wrap;">
          <span class="grade-item-name">${escapeHtml(g.name)}</span>
          <span class="grade-item-val grade-cell ${valClass}">${g.value}</span>
          <button class="grade-item-del" data-type="${type}" data-idx="${i}" title="Eliminar">
            <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
          </button>
          ${recHtml}
        </div>`;
      }).join('');
    }

    // No averages per user request
    if (avgEl) avgEl.innerHTML = '';

    listEl.querySelectorAll('.grade-item-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = btn.dataset.type;
        const idx = parseInt(btn.dataset.idx);
        student.grades[t].splice(idx, 1);
        await dbPut(student);
        renderGrades(student);
        showToast('Nota eliminada');
      });
    });

    listEl.querySelectorAll('.rec-add-btn, .rec-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openRecuperatorio(student, btn.dataset.type, parseInt(btn.dataset.idx));
      });
    });
  });
}

function openRecuperatorio(student, type, idx) {
  recuperatorioContext = { student, type, idx };
  const grade = student.grades[type][idx];
  // Pre-fill if editing
  const hasRec = grade.recuperatorio !== undefined && grade.recuperatorio !== null;
  if (hasRec && grade.recuperatorio !== 'NR') {
    document.querySelector('input[name="rec-state"][value="si"]').checked = true;
    document.getElementById('rec-value').value = grade.recuperatorio;
    document.getElementById('rec-value-wrap').classList.remove('hidden');
  } else if (hasRec && grade.recuperatorio === 'NR') {
    document.querySelector('input[name="rec-state"][value="no"]').checked = true;
    document.getElementById('rec-value').value = '';
    document.getElementById('rec-value-wrap').classList.add('hidden');
  } else {
    document.querySelector('input[name="rec-state"][value="si"]').checked = true;
    document.getElementById('rec-value').value = '';
    document.getElementById('rec-value-wrap').classList.remove('hidden');
  }
  openModal('modal-recuperatorio');
}

async function saveRecuperatorio() {
  const { student, type, idx } = recuperatorioContext;
  if (!student || type === null || idx === null) return;

  const state_rec = document.querySelector('input[name="rec-state"]:checked').value;
  let recValue;
  if (state_rec === 'no') {
    recValue = 'NR';
  } else {
    recValue = parseFloat(document.getElementById('rec-value').value);
    if (isNaN(recValue) || recValue < 0 || recValue > 10) {
      showToast('⚠️ La nota debe estar entre 0 y 10.');
      return;
    }
  }

  student.grades[type][idx].recuperatorio = recValue;
  const sIdx = state.students.findIndex(s => s.id === student.id);
  if (sIdx !== -1) state.students[sIdx] = student;
  await dbPut(student);
  closeModal('modal-recuperatorio');
  renderGrades(student);
  showToast('✅ Recuperatorio guardado');
}

// ── OBSERVATIONS ──
function renderObservations(student) {
  toggleDeactivated('tab-observaciones', student.active === false);
  if (student.active === false) return;

  const timeline = document.getElementById('obs-timeline');
  const empty = document.getElementById('obs-empty');
  const obs = [...(student.observations || [])].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt));

  if (obs.length === 0) {
    timeline.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  timeline.innerHTML = obs.map((o, i) => `
    <div class="obs-card" style="animation-delay:${i * 50}ms">
      <div class="obs-card-header">
        <span class="obs-card-date">🕐 ${formatDateTime(o.createdAt)}</span>
        <div class="obs-card-actions">
          <button class="obs-action-btn" data-obs-id="${o.id}" data-action="edit" title="Editar">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          </button>
          <button class="obs-action-btn del" data-obs-id="${o.id}" data-action="delete" title="Eliminar">
            <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
          </button>
        </div>
      </div>
      <div class="obs-card-text">${escapeHtml(o.text)}</div>
    </div>`).join('');

  timeline.querySelectorAll('.obs-action-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const obsId = btn.dataset.obsId;
      const action = btn.dataset.action;
      if (action === 'edit') {
        const o = student.observations.find(x => x.id === obsId);
        if (!o) return;
        state.editingObsId = obsId;
        document.getElementById('modal-obs-title').textContent = 'Editar observación';
        document.getElementById('obs-text').value = o.text;
        openModal('modal-obs');
      } else if (action === 'delete') {
        showConfirm('Eliminar observación', '¿Eliminar esta observación? La acción no se puede deshacer.', async () => {
          student.observations = student.observations.filter(x => x.id !== obsId);
          await dbPut(student);
          renderObservations(student);
          showToast('Observación eliminada');
        });
      }
    });
  });
}

// ── MEDICO ──
function renderMedico(student) {
  toggleDeactivated('tab-medico', student.active === false);
  if (student.active === false) return;

  const fichaCheck = document.getElementById('medico-ficha-check');
  const notasArea = document.getElementById('medico-notas');
  fichaCheck.checked = student.medico?.ficha || false;
  notasArea.value = student.medico?.notas || '';
}

// ──────────────────────────────────────────────
// ADD/EDIT STUDENT
// ──────────────────────────────────────────────
function openAddStudent() {
  state.editingStudentId = null;
  document.getElementById('modal-student-title').textContent = 'Nuevo estudiante';
  document.getElementById('student-name').value = '';
  document.getElementById('student-email').value = '';
  document.getElementById('student-notes').value = '';
  openModal('modal-student');
}

function openEditStudent() {
  const s = state.students.find(x => x.id === state.currentStudentId);
  if (!s) return;
  state.editingStudentId = s.id;
  document.getElementById('modal-student-title').textContent = 'Editar estudiante';
  document.getElementById('student-name').value = s.name;
  document.getElementById('student-email').value = s.email || '';
  document.getElementById('student-notes').value = s.notes || '';
  openModal('modal-student');
}

async function saveStudent() {
  const name = document.getElementById('student-name').value.trim();
  if (!name) { showToast('⚠️ El nombre es obligatorio.'); return; }

  if (state.editingStudentId) {
    const s = state.students.find(x => x.id === state.editingStudentId);
    if (s) {
      s.name = name;
      s.email = document.getElementById('student-email').value.trim();
      s.notes = document.getElementById('student-notes').value.trim();
      await dbPut(s);
      closeModal('modal-student');
      showToast('✅ Estudiante actualizado');
      if (state.currentStudentId === s.id) {
        document.getElementById('header-title').textContent = s.name;
        renderStudentDetail(s);
      }
      renderHome();
    }
  } else {
    const s = createStudent(name, document.getElementById('student-email').value, document.getElementById('student-notes').value);
    state.students.push(s);
    await dbPut(s);
    closeModal('modal-student');
    showToast('✅ Estudiante agregado');
    renderHome();
  }
  state.editingStudentId = null;
}

async function deleteCurrentStudent() {
  const s = state.students.find(x => x.id === state.currentStudentId);
  if (!s) return;
  showConfirm('Eliminar estudiante', `¿Eliminás a ${s.name}? Todos sus datos se perderán.`, async () => {
    state.students = state.students.filter(x => x.id !== state.currentStudentId);
    await dbDelete(state.currentStudentId);
    showToast('🗑️ Estudiante eliminado');
    goHome();
  });
}

// ──────────────────────────────────────────────
// ADD GRADE
// ──────────────────────────────────────────────
function openAddGrade() {
  const select = document.getElementById('grade-content-select');
  const wrap = document.getElementById('grade-custom-content-wrap');
  const nameInput = document.getElementById('grade-name');

  // Populate dropdown with global contents
  select.innerHTML = '';
  state.contents.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'Otro (escribir manualmente)...';
  select.appendChild(customOpt);

  if (state.contents.length > 0) {
    select.value = state.contents[0].name;
    wrap.classList.add('hidden');
  } else {
    select.value = 'custom';
    wrap.classList.remove('hidden');
  }

  nameInput.value = '';
  document.getElementById('grade-value').value = '';
  document.querySelector('input[name="grade-type"][value="practica"]').checked = true;
  // Reset state to 'nota'
  document.querySelector('input[name="grade-state"][value="nota"]').checked = true;
  document.getElementById('grade-value-wrap').classList.remove('hidden');
  openModal('modal-grade');
}

async function saveGrade() {
  const type = document.querySelector('input[name="grade-type"]:checked').value;
  const gradeState = document.querySelector('input[name="grade-state"]:checked').value;
  const select = document.getElementById('grade-content-select');
  let name = select.value;
  if (name === 'custom') {
    name = document.getElementById('grade-name').value.trim();
  }

  if (!name) { showToast('⚠️ Ingresá una descripción.'); return; }

  let value = null;
  if (gradeState === 'nota') {
    value = parseFloat(document.getElementById('grade-value').value);
    if (isNaN(value) || value < 0 || value > 10) {
      showToast('⚠️ La nota debe estar entre 0 y 10.');
      return;
    }
  } else {
    value = gradeState; // 'A' or 'NR'
  }

  const s = state.students.find(x => x.id === state.currentStudentId);
  if (!s) return;
  s.grades[type].push({ id: Date.now().toString(36), name, value });
  await dbPut(s);
  closeModal('modal-grade');
  renderGrades(s);
  renderStudentDetail(s);
  showToast('✅ Nota guardada');
}

// ──────────────────────────────────────────────
// OBSERVATIONS
// ──────────────────────────────────────────────
function openAddObs() {
  state.editingObsId = null;
  document.getElementById('modal-obs-title').textContent = 'Nueva observación';
  document.getElementById('obs-text').value = '';
  openModal('modal-obs');
}

async function saveObs() {
  const text = document.getElementById('obs-text').value.trim();
  if (!text) { showToast('⚠️ Escribí una observación.'); return; }

  const s = state.students.find(x => x.id === state.currentStudentId);
  if (!s) return;

  if (state.editingObsId) {
    const o = s.observations.find(x => x.id === state.editingObsId);
    if (o) { o.text = text; o.updatedAt = new Date().toISOString(); }
    showToast('✅ Observación actualizada');
  } else {
    s.observations.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      text,
      createdAt: new Date().toISOString(),
    });
    showToast('✅ Observación guardada');
  }

  await dbPut(s);
  closeModal('modal-obs');
  state.editingObsId = null;
  renderObservations(s);
}

// ──────────────────────────────────────────────
// MEDICO SAVE
// ──────────────────────────────────────────────
async function saveMedico() {
  const s = state.students.find(x => x.id === state.currentStudentId);
  if (!s) return;
  s.medico = {
    ficha: document.getElementById('medico-ficha-check').checked,
    notas: document.getElementById('medico-notas').value.trim(),
  };
  await dbPut(s);
  renderStudentDetail(s);
  renderStats();
  showToast('✅ Información médica guardada');
}

// ──────────────────────────────────────────────
// EXPORT / IMPORT
// ──────────────────────────────────────────────
function exportData() {
  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    students: state.students,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `edutrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📦 Datos exportados');
}

function triggerImport() {
  document.getElementById('import-file').click();
}

async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.students || !Array.isArray(data.students)) throw new Error('Formato inválido');
    showConfirm('Importar datos', `Se importarán ${data.students.length} estudiantes. ¿Reemplazar datos actuales?`, async () => {
      await dbClear();
      state.students = data.students;
      syncDatesToStudents();
      for (const s of state.students) await dbPut(s);
      renderHome();
      showToast(`✅ ${data.students.length} estudiantes importados`);
    });
  } catch (e) {
    showToast('❌ Error al importar el archivo');
  }
}

async function resetAllData() {
  showConfirm('Borrar todos los datos', 'Se eliminarán TODOS los estudiantes y datos. Esta acción no se puede deshacer.', async () => {
    await dbClear();
    state.students = [];
    goHome();
    showToast('🗑️ Todos los datos eliminados');
  });
}

// ──────────────────────────────────────────────
// UTILITY
// ──────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────
// EVENT LISTENERS
// ──────────────────────────────────────────────
function bindEvents() {
  // Theme
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  // Back
  document.getElementById('btn-back').addEventListener('click', goHome);

  // Dropdown menu
  const menuBtn = document.getElementById('btn-menu');
  const dropdown = document.getElementById('dropdown-menu');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => dropdown.classList.add('hidden'));
  dropdown.addEventListener('click', (e) => e.stopPropagation());

  document.getElementById('menu-add-student').addEventListener('click', () => { dropdown.classList.add('hidden'); openAddStudent(); });
  document.getElementById('menu-export').addEventListener('click', () => { dropdown.classList.add('hidden'); exportData(); });
  document.getElementById('menu-import').addEventListener('click', () => { dropdown.classList.add('hidden'); triggerImport(); });
  document.getElementById('menu-reset').addEventListener('click', () => { dropdown.classList.add('hidden'); resetAllData(); });



  // Search
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    searchClear.classList.toggle('hidden', !searchInput.value);
    renderStudentList();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClear.classList.add('hidden');
    renderStudentList();
  });

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });

  // Save student
  document.getElementById('btn-save-student').addEventListener('click', saveStudent);
  document.getElementById('student-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveStudent();
  });

  // Student actions
  document.getElementById('btn-edit-student').addEventListener('click', openEditStudent);
  document.getElementById('btn-delete-student').addEventListener('click', deleteCurrentStudent);

  // Add grade
  document.getElementById('btn-add-grade').addEventListener('click', openAddGrade);
  document.getElementById('btn-save-grade').addEventListener('click', saveGrade);

  // Observations
  document.getElementById('btn-add-obs').addEventListener('click', openAddObs);
  document.getElementById('btn-save-obs').addEventListener('click', saveObs);

  // Medico save
  document.getElementById('btn-save-medico').addEventListener('click', saveMedico);

  // Import file
  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) { importData(file); e.target.value = ''; }
  });

  // Tabs
  document.getElementById('student-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const tabId = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    state.currentTab = tabId;
  });

  // Auto-detect system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'auto') applyTheme('auto');
  });

  // Keyboard shortcut: Escape closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  // Quick Actions (Home)
  document.getElementById('btn-quick-attendance')?.addEventListener('click', openTinderAttendance);
  document.getElementById('btn-quick-add')?.addEventListener('click', openAddStudent);
  document.getElementById('btn-quick-content')?.addEventListener('click', openContentModal);
  document.getElementById('btn-quick-grades')?.addEventListener('click', openGradesView);
  document.getElementById('btn-quick-attendance-view')?.addEventListener('click', openAttendanceMatrixView);
  document.getElementById('btn-quick-topic-log')?.addEventListener('click', openTopicLogView);

  // Topic Log Actions
  document.getElementById('btn-add-topic-entry')?.addEventListener('click', openAddTopic);
  document.getElementById('btn-save-topic')?.addEventListener('click', saveTopic);

  // Attendance Matrix Month Filter
  document.getElementById('attendance-month-filter')?.addEventListener('change', renderAttendanceMatrix);

  // Grade Content Select Toggle
  document.getElementById('grade-content-select')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('grade-custom-content-wrap');
    if (e.target.value === 'custom') {
      wrap.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
    }
  });

  // Grade State Toggle (numeric / A / NR)
  document.querySelectorAll('input[name="grade-state"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const wrap = document.getElementById('grade-value-wrap');
      if (e.target.value === 'nota') {
        wrap.classList.remove('hidden');
      } else {
        wrap.classList.add('hidden');
      }
    });
  });

  // Recuperatorio
  document.querySelectorAll('input[name="rec-state"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const wrap = document.getElementById('rec-value-wrap');
      wrap.classList.toggle('hidden', e.target.value === 'no');
    });
  });
  document.getElementById('btn-save-recuperatorio')?.addEventListener('click', saveRecuperatorio);

  // Content Actions
  document.getElementById('btn-add-content')?.addEventListener('click', saveContent);
  document.getElementById('new-content-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveContent();
  });

  // Tinder Actions
  document.getElementById('btn-tinder-finish')?.addEventListener('click', goHome);
  document.getElementById('tinder-btn-present')?.addEventListener('click', () => handleTinderAction(true));
  document.getElementById('tinder-btn-absent')?.addEventListener('click', () => handleTinderAction(false));
}

// ──────────────────────────────────────────────
// GRADES MATRIX VIEW
// ──────────────────────────────────────────────
function openGradesView() {
  showView('view-grades');
  document.getElementById('header-title').textContent = 'Notas';
  document.getElementById('header-sub').classList.add('hidden');
  document.getElementById('btn-back').classList.remove('hidden');
  document.getElementById('btn-menu').classList.add('hidden');
  renderGradesMatrix();
}

// ──────────────────────────────────────────────
// ATTENDANCE MATRIX VIEW
// ──────────────────────────────────────────────
function openAttendanceMatrixView() {
  showView('view-attendance-matrix');
  document.getElementById('header-title').textContent = 'Asistencia General';
  document.getElementById('header-sub').classList.add('hidden');
  document.getElementById('btn-back').classList.remove('hidden');
  document.getElementById('btn-menu').classList.add('hidden');

  // Populate month filter if empty
  const filter = document.getElementById('attendance-month-filter');
  if (filter.options.length === 0) {
    const months = [
      { v: '03', n: 'Marzo' }, { v: '04', n: 'Abril' }, { v: '05', n: 'Mayo' },
      { v: '06', n: 'Junio' }, { v: '07', n: 'Julio' }, { v: '08', n: 'Agosto' },
      { v: '09', n: 'Septiembre' }, { v: '10', n: 'Octubre' }, { v: '11', n: 'Noviembre' },
      { v: '12', n: 'Diciembre' }
    ];
    const currMonth = new Date().toISOString().split('-')[1];
    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.v;
      opt.textContent = m.n;
      if (m.v === currMonth) opt.selected = true;
      filter.appendChild(opt);
    });
  }

  renderAttendanceMatrix();
}

function renderAttendanceMatrix() {
  const table = document.getElementById('attendance-matrix');
  const month = document.getElementById('attendance-month-filter').value;
  const year = '2026';

  const students = [...state.students].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const dates = getClassDates().filter(d => d.startsWith(`${year}-${month}`));

  if (dates.length === 0) {
    table.innerHTML = `<tr><td style="padding:40px; color:var(--text-muted)">No hay clases programadas para este mes.</td></tr>`;
    document.getElementById('attendance-view-sub').textContent = 'Sin clases este mes';
    return;
  }

  document.getElementById('attendance-view-sub').textContent = `${students.length} alumnos · ${dates.length} clases`;

  // Header
  let html = '<thead><tr><th sticky>Alumno</th>';
  dates.forEach(d => {
    const day = d.split('-')[2];
    html += `<th>${day}</th>`;
  });
  html += '<th>%</th></tr></thead>';

  // Body
  html += '<tbody>';
  students.forEach(s => {
    const isInactive = s.active === false;
    html += `<tr class="${isInactive ? 'inactive-student' : ''}">`;
    html += `<td sticky>${escapeHtml(s.name)}</td>`;

    let present = 0, total = 0;
    dates.forEach(d => {
      const status = s.attendance[d];
      let cell = '-';
      if (status === true) {
        cell = '<span style="color:var(--text); font-weight:800;">P</span>';
        present++; total++;
      }
      else if (status === false) {
        cell = '<span style="color:var(--danger)">A</span>';
        total++;
      }
      html += `<td>${cell}</td>`;
    });

    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    html += `<td style="font-weight:700; color:${pct < 75 ? 'var(--danger)' : 'var(--success)'}">${pct}%</td>`;
    html += '</tr>';
  });
  html += '</tbody>';

  table.innerHTML = html;
}

function renderGradesMatrix() {
  const table = document.getElementById('grades-matrix');
  const empty = document.getElementById('grades-empty');

  const contents = state.contents;
  const students = [...state.students].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  if (contents.length === 0) {
    table.innerHTML = '';
    empty.classList.remove('hidden');
    document.getElementById('grades-view-sub').textContent = 'Sin contenidos cargados';
    return;
  }

  empty.classList.add('hidden');
  document.getElementById('grades-view-sub').textContent =
    `${students.length} alumnos · ${contents.length} contenidos`;

  // Build header row 1: "Alumno" + content names spanning 2 cols each
  let thead1 = '<tr><th rowspan="2" style="vertical-align:middle">Alumno</th>';
  contents.forEach(c => {
    thead1 += `<th colspan="2">${escapeHtml(c.name)}</th>`;
  });
  thead1 += '</tr>';

  // Build header row 2: PRÁCTICO / TEÓRICO sub-headers
  let thead2 = '<tr>';
  contents.forEach(() => {
    thead2 += '<th>PR\u00c1CTICO</th><th>TE\u00d3RICO</th>';
  });
  thead2 += '</tr>';

  // Build body rows
  let tbody = '';
  students.forEach(student => {
    const inactiveClass = student.active === false ? 'inactive-student' : '';
    tbody += `<tr><td class="${inactiveClass}">${escapeHtml(student.name)}</td>`;

    contents.forEach(c => {
      // Find matching grades by name (case-insensitive)
      const practica = (student.grades?.practica || []).find(
        g => g.name.toLowerCase() === c.name.toLowerCase()
      );
      const teorica = (student.grades?.teorica || []).find(
        g => g.name.toLowerCase() === c.name.toLowerCase()
      );

      const renderCell = (grade) => {
        if (!grade) return '<td class="grade-cell empty">&mdash;</td>';
        let mainClass, mainVal;
        if (grade.value === 'A') { mainClass = 'failing'; mainVal = 'A'; }
        else if (grade.value === 'NR') { mainClass = 'failing'; mainVal = 'NR'; }
        else { mainClass = parseFloat(grade.value) >= 7 ? 'passing' : 'failing'; mainVal = grade.value; }

        let recHtml = '';
        if (grade.recuperatorio !== undefined && grade.recuperatorio !== null) {
          const rv = grade.recuperatorio;
          if (rv === 'NR') {
            recHtml = `<div class="matrix-rec failing">R: NR</div>`;
          } else {
            const rc = parseFloat(rv) >= 7 ? 'passing' : 'failing';
            recHtml = `<div class="matrix-rec ${rc}">R: ${rv}</div>`;
          }
        }

        return `<td class="grade-cell ${mainClass}">
                  <div class="matrix-val-wrap">
                    <span>${mainVal}</span>
                    ${recHtml}
                  </div>
                </td>`;
      };

      tbody += renderCell(practica) + renderCell(teorica);
    });

    tbody += '</tr>';
  });

  table.innerHTML = `<thead>${thead1}${thead2}</thead><tbody>${tbody}</tbody>`;
}

// ──────────────────────────────────────────────
// CONTENIDOS GLOBALES
// ──────────────────────────────────────────────
function openContentModal() {
  renderContentList();
  openModal('modal-content');
}

function renderContentList() {
  const list = document.getElementById('content-list');
  list.innerHTML = '';
  state.contents.forEach((c, idx) => {
    const item = document.createElement('div');
    item.className = 'content-item';
    item.innerHTML = `
      <span>${escapeHtml(c.name)}</span>
      <div class="content-item-actions">
        <div class="content-item-btn btn-move-up" data-idx="${idx}" title="Subir">
          <svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </div>
        <div class="content-item-btn btn-move-down" data-idx="${idx}" title="Bajar">
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </div>
        <div class="content-item-btn content-item-del" data-id="${c.id}" title="Eliminar">
          <svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.btn-move-up').forEach(btn => {
    btn.addEventListener('click', () => moveContent(parseInt(btn.dataset.idx), -1));
  });
  list.querySelectorAll('.btn-move-down').forEach(btn => {
    btn.addEventListener('click', () => moveContent(parseInt(btn.dataset.idx), 1));
  });

  list.querySelectorAll('.content-item-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('¿Seguro que deseas eliminar este contenido?')) {
        const id = btn.dataset.id;
        await dbDeleteContent(id);
        state.contents = state.contents.filter(c => c.id !== id);
        renderContentList();
      }
    });
  });
}

async function moveContent(idx, dir) {
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= state.contents.length) return;

  // Swap in array
  const temp = state.contents[idx];
  state.contents[idx] = state.contents[targetIdx];
  state.contents[targetIdx] = temp;

  // Update timestamps to persist order (since we sort by createdAt)
  const timeA = state.contents[idx].createdAt;
  const timeB = state.contents[targetIdx].createdAt;
  state.contents[idx].createdAt = timeB;
  state.contents[targetIdx].createdAt = timeA;

  await Promise.all([
    dbPutContent(state.contents[idx]),
    dbPutContent(state.contents[targetIdx])
  ]);

  renderContentList();
}

async function saveContent() {
  const input = document.getElementById('new-content-input');
  const name = input.value.trim();
  if (!name) return;

  const newContent = {
    id: Date.now().toString(),
    name: name,
    createdAt: new Date().toISOString()
  };

  await dbPutContent(newContent);
  state.contents.unshift(newContent);
  input.value = '';
  renderContentList();
}

// ──────────────────────────────────────────────
// TINDER ATTENDANCE
// ──────────────────────────────────────────────
let tinderStudents = [];
let tinderIndex = 0;
let tinderCurrentDate = new Date().toISOString().split('T')[0];

function openTinderAttendance() {
  // Only active students
  tinderStudents = state.students
    .filter(s => s.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  if (tinderStudents.length === 0) {
    showToast('⚠️ No hay estudiantes agregados.');
    return;
  }

  const dates = getClassDates();
  if (!dates.includes(tinderCurrentDate)) {
    tinderCurrentDate = dates[dates.length - 1] || tinderCurrentDate;
  }

  tinderIndex = 0;
  showView('view-tinder');
  document.getElementById('header-title').textContent = 'Asistencia';
  document.getElementById('header-sub').classList.add('hidden');
  document.getElementById('btn-back').classList.add('hidden');
  document.getElementById('btn-menu').classList.add('hidden');

  renderTinderCards();
}

function renderTinderCards() {
  const container = document.getElementById('tinder-cards');
  document.getElementById('tinder-progress').textContent = `${tinderIndex} / ${tinderStudents.length} estudiantes`;

  if (tinderIndex >= tinderStudents.length) {
    container.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); animation: card-in 0.3s ease;">
        <svg viewBox="0 0 24 24" style="width:64px;height:64px;margin-bottom:16px;color:var(--success)"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        <h3 style="font-family:var(--font-title); font-size:24px; color:var(--text)">¡Asistencia completada!</h3>
        <p style="margin-top:8px">Has registrado a todos los alumnos.</p>
      </div>
    `;
    return;
  }

  const student = tinderStudents[tinderIndex];
  const stats = getAttendanceStats(student);

  container.innerHTML = `
    <div class="tinder-card" id="tinder-active-card">
      <div class="avatar-lg" style="${avatarGradient(student.id)}; font-size:32px;">${escapeHtml(getInitials(student.name))}</div>
      <div class="tinder-card-name">${escapeHtml(student.name)}</div>
      <div class="tinder-card-stats">
        <span class="p">✅ ${stats.present} Presentes</span>
        <span class="a">❌ ${stats.absent} Ausentes</span>
      </div>
      <div class="tinder-stamp present" id="tinder-stamp-p">PRESENTE</div>
      <div class="tinder-stamp absent" id="tinder-stamp-a">AUSENTE</div>
    </div>
  `;

  // --- SWIPE LOGIC (Pointer Events for Mouse & Touch) ---
  const activeCard = document.getElementById('tinder-active-card');
  if (!activeCard) return;

  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  activeCard.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startX = e.clientX;
    activeCard.setPointerCapture(e.pointerId);
    activeCard.classList.add('is-moving');
  });

  activeCard.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    const rotate = currentX / 10;
    activeCard.style.transform = `translateX(${currentX}px) rotate(${rotate}deg)`;

    // Stamps
    const stampP = document.getElementById('tinder-stamp-p');
    const stampA = document.getElementById('tinder-stamp-a');
    if (currentX > 30) {
      stampP.style.opacity = Math.min((currentX - 30) / 100, 1);
      stampA.style.opacity = 0;
    } else if (currentX < -30) {
      stampA.style.opacity = Math.min((Math.abs(currentX) - 30) / 100, 1);
      stampP.style.opacity = 0;
    } else {
      stampP.style.opacity = 0;
      stampA.style.opacity = 0;
    }
  });

  activeCard.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    activeCard.releasePointerCapture(e.pointerId);
    activeCard.classList.remove('is-moving');

    if (currentX > 100) {
      handleTinderAction(true);
    } else if (currentX < -100) {
      handleTinderAction(false);
    } else {
      activeCard.style.transform = '';
      document.getElementById('tinder-stamp-p').style.opacity = 0;
      document.getElementById('tinder-stamp-a').style.opacity = 0;
    }
    startX = 0;
    currentX = 0;
  });

  activeCard.addEventListener('pointercancel', (e) => {
    isDragging = false;
    activeCard.style.transform = '';
    activeCard.classList.remove('is-moving');
    document.getElementById('tinder-stamp-p').style.opacity = 0;
    document.getElementById('tinder-stamp-a').style.opacity = 0;
  });
}

async function handleTinderAction(isPresent) {
  if (tinderIndex >= tinderStudents.length) return;

  const card = document.getElementById('tinder-active-card');
  if (card) {
    card.classList.add('is-moving');
    card.style.transform = `translate(${isPresent ? '150%' : '-150%'}, -20px) rotate(${isPresent ? '20deg' : '-20deg'})`;
    card.style.opacity = '0';

    if (isPresent) {
      document.getElementById('tinder-stamp-p').style.opacity = '1';
    } else {
      document.getElementById('tinder-stamp-a').style.opacity = '1';
    }
  }

  const student = tinderStudents[tinderIndex];
  student.attendance[tinderCurrentDate] = isPresent;

  // Guardamos en Firebase en segundo plano
  dbPut(student).then(() => {
    const sIndex = state.students.findIndex(s => s.id === student.id);
    if (sIndex !== -1) state.students[sIndex] = student;
  }).catch(err => {
    console.error("Error guardando asistencia en Firebase", err);
    showToast('⚠️ Error al guardar en la nube');
  });

  tinderIndex++;
  setTimeout(() => {
    renderTinderCards();
  }, 250);
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
async function init() {
  // Theme
  const savedTheme = localStorage.getItem('edutrack-theme') || 'auto';
  state.theme = savedTheme;
  applyTheme(savedTheme);

  // Init DB
  try {
    await initDB();
    state.students = await dbGetAll();
    state.contents = await dbGetContents();
    state.topicLog = await dbGetTopics();
    syncDatesToStudents();
  } catch (e) {
    console.warn('IndexedDB unavailable, falling back to localStorage');
    // Fallback localStorage
    const raw = localStorage.getItem('edutrack-students');
    state.students = raw ? JSON.parse(raw) : [];
  }

  // Bind events
  bindEvents();

  // Render home
  renderHome();

  // Hide splash
  const splash = document.getElementById('splash');
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.remove();
      document.getElementById('app').classList.remove('hidden');
    }, 500);
  }, 900);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => { });
  }
}

// ──────────────────────────────────────────────
// TOPIC LOG VIEW
// ──────────────────────────────────────────────
function openTopicLogView() {
  showView('view-topic-log');
  document.getElementById('header-title').textContent = 'Libro de Temas';
  document.getElementById('header-sub').classList.add('hidden');
  document.getElementById('btn-back').classList.remove('hidden');
  document.getElementById('btn-menu').classList.add('hidden');
  renderTopicLog();
}

function renderTopicLog() {
  const body = document.getElementById('topic-log-body');
  const empty = document.getElementById('topic-log-empty');

  if (state.topicLog.length === 0) {
    body.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  // Sort by date descending
  const sorted = [...state.topicLog].sort((a, b) => b.date.localeCompare(a.date));

  body.innerHTML = sorted.map(t => {
    const [y, m, d] = t.date.split('-');
    const simpleDate = `${d}/${m}/${y}`;
    
    let typeClass = 'badge-gray';
    if (t.type === 'Teórico') typeClass = 'badge-teorico';
    else if (t.type === 'Práctico') typeClass = 'badge-practico';
    else if (t.type === 'Práctico/Teórico') typeClass = 'badge-mixto';
    else if (t.type === 'Evaluación') typeClass = 'badge-evaluacion';

    return `
    <tr>
      <td style="font-size:13px; font-weight:600; text-align:center;">${simpleDate}</td>
      <td><span class="type-badge ${typeClass}">${t.type.toUpperCase()}</span></td>
      <td style="font-weight:600; color:var(--text-muted); font-size:12px; text-align:center;">${escapeHtml(t.contentName)}</td>
      <td style="text-align:center; font-weight:600;">${escapeHtml(t.observations || '-')}</td>
      <td>
        <button class="btn-icon" style="color:var(--danger)" onclick="deleteTopicEntry('${t.id}')">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </button>
      </td>
    </tr>
    `;
  }).join('');
}

function openAddTopic() {
  const select = document.getElementById('topic-content-select');
  select.innerHTML = state.contents.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  document.getElementById('topic-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('topic-obs').value = '';
  openModal('modal-topic');
}

async function saveTopic() {
  const date = document.getElementById('topic-date').value;
  const type = document.querySelector('input[name="topic-type"]:checked').value;
  const contentId = document.getElementById('topic-content-select').value;
  const obs = document.getElementById('topic-obs').value.trim();

  if (!date || !contentId || !obs) {
    showToast('⚠️ Por favor completa los campos obligatorios');
    return;
  }

  const content = state.contents.find(c => c.id === contentId);
  const newEntry = {
    id: Date.now().toString(),
    date,
    type,
    contentId,
    contentName: content ? content.name : 'Desconocido',
    observations: obs,
    createdAt: new Date().toISOString()
  };

  await dbPutTopic(newEntry);
  state.topicLog.push(newEntry);
  closeModal('modal-topic');
  renderTopicLog();
  showToast('✅ Registro guardado');
}

async function deleteTopicEntry(id) {
  if (confirm('¿Deseas eliminar este registro del libro de temas?')) {
    await dbDeleteTopic(id);
    state.topicLog = state.topicLog.filter(t => t.id !== id);
    renderTopicLog();
  }
}

document.addEventListener('DOMContentLoaded', init);
