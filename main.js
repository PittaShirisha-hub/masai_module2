// main.js
// Uses Firebase compat SDK for simplicity

// --- Helpers ---
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const fmtDate = (d) => d.toISOString().slice(0,10);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

let user = null;
let unsubLog = null; // unsubscribe from snapshot
let currentDate = fmtDate(new Date());

// Init dates
$('#logDate').value = currentDate;
$('#dashDate').value = currentDate;

// Tabs switching
$$('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    $$('#appShell .tabview').forEach(v => v.classList.add('hidden'));
    $('#tab-' + target).classList.remove('hidden');
    if (target === 'dash') loadDashboard();
  });
});

// Firebase Auth UI wiring
$('#googleSignIn').addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  await firebase.auth().signInWithPopup(provider);
});

$('#emailSignIn').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const pass = $('#password').value.trim();
  await firebase.auth().signInWithEmailAndPassword(email, pass).catch(alert);
});

$('#emailSignUp').addEventListener('click', async () => {
  const email = $('#email').value.trim();
  const pass = $('#password').value.trim();
  await firebase.auth().createUserWithEmailAndPassword(email, pass).catch(alert);
});

$('#signOut').addEventListener('click', () => firebase.auth().signOut());

firebase.auth().onAuthStateChanged(async (u) => {
  user = u;
  if (u) {
    // show app
    $('#landing').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    $('#userEmail').textContent = u.email || u.displayName || 'Signed in';
    currentDate = $('#logDate').value;
    bindDayListener(currentDate);
    loadDashboard();
  } else {
    // show landing
    $('#appShell').classList.add('hidden');
    $('#landing').classList.remove('hidden');
    if (unsubLog) unsubLog();
  }
});

// --- Firestore paths ---
const dayCol = (uid, date) => firebase.firestore()
  .collection('users').doc(uid)
  .collection('days').doc(date)
  .collection('activities');

// Realtime listener for a given date
function bindDayListener(date) {
  if (!user) return;
  if (unsubLog) unsubLog();
  unsubLog = dayCol(user.uid, date)
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderActivities(items);
    }, (err) => console.error(err));
}

// Change date in log tab
$('#logDate').addEventListener('change', (e) => {
  currentDate = e.target.value;
  bindDayListener(currentDate);
});

// Add activity
$('#activityForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!user) return;
  const title = $('#actTitle').value.trim();
  const category = $('#actCategory').value;
  const minutes = clamp(parseInt($('#actMinutes').value, 10), 1, 1440);

  // Validate against remaining
  const totals = computeTotalsFromDOM();
  if (totals.total + minutes > 1440) {
    alert(`Adding ${minutes} min exceeds 1440. Remaining: ${1440 - totals.total} min.`);
    return;
  }

  await dayCol(user.uid, currentDate).add({
    title, category, minutes,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  e.target.reset();
});

// Render activities list and totals
function renderActivities(items) {
  const list = $('#activityList');
  list.innerHTML = '';
  const empty = $('#emptyList');
  empty.classList.toggle('hidden', items.length > 0);

  items.forEach(it => {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = it.id;
    li.innerHTML = `
      <input type="text" value="${escapeHtml(it.title)}" class="title" />
      <select class="category">
        ${['Work','Study','Sleep','Entertainment','Exercise','Chores','Other'].map(c => `<option ${c===it.category?'selected':''}>${c}</option>`).join('')}
      </select>
      <input type="number" min="1" max="1440" value="${it.minutes}" class="minutes" />
      <div class="actions">
        <button class="btn">Save</button>
        <button class="btn danger">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.btn').forEach(btn => btn.addEventListener('click', onItemAction));
  list.querySelectorAll('input,select').forEach(inp => inp.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter') {
      e.preventDefault();
      const b = e.currentTarget.closest('.item').querySelector('.actions .btn');
      b.click();
    }
  }));

  updateTotals(items);
}

// Save/Delete actions
async function onItemAction(e) {
  const li = e.currentTarget.closest('.item');
  const id = li.dataset.id;
  const isDelete = e.currentTarget.classList.contains('danger');
  if (isDelete) {
    await dayCol(user.uid, currentDate).doc(id).delete();
    return;
  }
  // Save: validate totals
  const title = li.querySelector('.title').value.trim();
  const category = li.querySelector('.category').value;
  const minutes = clamp(parseInt(li.querySelector('.minutes').value,10)||0, 1, 1440);

  const items = [...$('#activityList').querySelectorAll('.item')].map(el => ({
    id: el.dataset.id,
    minutes: clamp(parseInt(el.querySelector('.minutes').value,10)||0, 1, 1440)
  }));

  // Sum with new value for this id
  let total = 0;
  items.forEach(x => total += (x.id===id ? minutes : x.minutes));
  if (total > 1440) {
    alert(`Total would be ${total} min (>1440). Reduce minutes.`);
    return;
  }

  await dayCol(user.uid, currentDate).doc(id).update({ title, category, minutes });
}

// Compute totals from DOM (for quick validation without roundtrip)
function computeTotalsFromDOM(){
  const items = [...$('#activityList').querySelectorAll('.item')];
  let total = 0;
  items.forEach(li => total += parseInt(li.querySelector('.minutes')?.value||'0',10));
  return { total };
}

function updateTotals(items){
  const total = items.reduce((a,b)=>a + (b.minutes||0), 0);
  $('#total').textContent = `Total: ${total} min`;
  $('#remaining').textContent = `Remaining: ${Math.max(0,1440-total)} min`;
  // Enable Analyse if there is data and total <= 1440
  $('#analyseBtn').disabled = total <= 0 || total > 1440;
}

// Analyse button -> switch to dashboard with same date
$('#analyseBtn').addEventListener('click', () => {
  $$('.tab').forEach(b=>b.classList.remove('active'));
  document.querySelector('[data-tab="dash"]').classList.add('active');
  $('#tab-log').classList.add('hidden');
  $('#tab-dash').classList.remove('hidden');
  $('#dashDate').value = $('#logDate').value;
  loadDashboard();
});

$('#refreshDash').addEventListener('click', loadDashboard);
$('#dashDate').addEventListener('change', loadDashboard);

// Dashboard
let pieChart = null;
let barChart = null;

async function loadDashboard(){
  if (!user) return;
  const date = $('#dashDate').value;
  const snap = await dayCol(user.uid, date).get();
  const items = snap.docs.map(d => d.data());
  const hasData = items.length > 0;

  $('#noData').classList.toggle('hidden', hasData);
  $('#dashContent').classList.toggle('hidden', !hasData);
  if (!hasData) return;

  const total = items.reduce((a,b)=>a + (b.minutes||0), 0);
  const perCat = {};
  items.forEach(it => perCat[it.category] = (perCat[it.category]||0) + (it.minutes||0));

  // Update summary
  $('#sumTotal').textContent = `${(total/60).toFixed(1)}h`;
  $('#sumActivities').textContent = String(items.length);
  $('#sumCategories').textContent = String(Object.keys(perCat).length);

  // Pie: by category
  const pieCtx = document.getElementById('pie');
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(perCat),
      datasets: [{ data: Object.values(perCat) }]
    },
    options: {
      plugins: { legend: { labels: { color: '#e5e7eb' } } }
    }
  });

  // Bar: activity durations
  const barCtx = document.getElementById('bar');
  if (barChart) barChart.destroy();
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: items.map(i => i.title),
      datasets: [{ data: items.map(i => i.minutes) }]
    },
    options: {
      scales: {
        x: { ticks: { color: '#e5e7eb' }, grid: { display:false } },
        y: { ticks: { color: '#e5e7eb' } }
      },
      plugins: { legend: { display:false } }
    }
  });
}

// Security: escape HTML
function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
