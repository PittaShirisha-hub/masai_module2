// Firebase config - REPLACE
const firebaseConfig = {
  apiKey: "REPLACE",
  authDomain: "REPLACE",
  projectId: "REPLACE",
  storageBucket: "REPLACE",
  messagingSenderId: "REPLACE",
  appId: "REPLACE"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const googleBtn = document.getElementById('googleSignIn');
const emailForm = document.getElementById('emailSignIn');
const signOutBtn = document.getElementById('signOutBtn');

const dayPicker = document.getElementById('dayPicker');
const activityTitle = document.getElementById('activityTitle');
const activityCategory = document.getElementById('activityCategory');
const activityMinutes = document.getElementById('activityMinutes');
const addActivityBtn = document.getElementById('addActivityBtn');
const activitiesList = document.getElementById('activitiesList');
const remainingText = document.getElementById('remainingText');
const analyseBtn = document.getElementById('analyseBtn');
const noData = document.getElementById('noData');
const pieCtx = document.getElementById('pieChart').getContext('2d');
let pieChart;

let currentUser;
let currentDateStr;

auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    authView.style.display = 'none';
    mainView.style.display = '';
    // default date = today
    dayPicker.value = (new Date()).toISOString().slice(0,10);
    loadActivitiesForDate(dayPicker.value);
  } else {
    authView.style.display = '';
    mainView.style.display = 'none';
  }
});

googleBtn.addEventListener('click', async ()=> {
  const provider = new firebase.auth.GoogleAuthProvider();
  try { await auth.signInWithPopup(provider); } catch(e){alert(e.message)}
});

emailForm.addEventListener('submit', async (e)=> {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const pwd = document.getElementById('password').value;
  try {
    await auth.signInWithEmailAndPassword(email, pwd);
  } catch(err) {
    // try register
    try { await auth.createUserWithEmailAndPassword(email, pwd); }
    catch(e){ alert(e.message); }
  }
});

signOutBtn.addEventListener('click', ()=> auth.signOut());

dayPicker.addEventListener('change', ()=> loadActivitiesForDate(dayPicker.value));
addActivityBtn.addEventListener('click', addActivity);
analyseBtn.addEventListener('click', showAnalyticsForDate);

function getDayDocRef(uid, dateStr){
  return db.collection('users').doc(uid).collection('days').doc(dateStr);
}

async function loadActivitiesForDate(dateStr){
  currentDateStr = dateStr;
  activitiesList.innerHTML = '';
  remainingText.textContent = '';
  analyseBtn.disabled = true;
  noData.style.display = 'none';
  if(!currentUser) return;

  const dayRef = getDayDocRef(currentUser.uid, dateStr);
  const snap = await dayRef.collection('activities').get();
  const activities = snap.docs.map(d=>({id:d.id, ...d.data()}));
  if(activities.length === 0){
    noData.style.display = '';
    updateRemaining(0);
    return;
  }
  noData.style.display = 'none';
  renderActivities(activities);
  updateRemaining(sumMinutes(activities));
}

function renderActivities(activities){
  activitiesList.innerHTML = '';
  activities.forEach(act=>{
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div><strong>${act.title}</strong> • ${act.category}</div>
      <div>${act.minutes} minutes</div>
      <div>
        <button data-id="${act.id}" class="edit">Edit</button>
        <button data-id="${act.id}" class="del">Delete</button>
      </div>
    `;
    activitiesList.appendChild(el);
  });
  activitiesList.querySelectorAll('.del').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const id = e.target.dataset.id;
      await getDayDocRef(currentUser.uid, currentDateStr).collection('activities').doc(id).delete();
      loadActivitiesForDate(currentDateStr);
    });
  });
  // Edit handler could be added similarly
}

function sumMinutes(activities){
  return activities.reduce((s,a)=>s + (a.minutes||0), 0);
}

function updateRemaining(total){
  const remaining = 1440 - total;
  remainingText.textContent = `You have ${remaining} minutes left for this day.`;
  if(total > 0 && total <= 1440){
    analyseBtn.disabled = false;
  } else {
    analyseBtn.disabled = true;
  }
  if(total === 0) remainingText.textContent = `No activities logged yet for ${currentDateStr}.`;
}

async function addActivity(){
  const title = activityTitle.value.trim();
  const category = activityCategory.value;
  const minutes = parseInt(activityMinutes.value, 10);
  if(!title || !minutes || minutes <= 0) { alert('Provide title and positive minutes'); return; }
  const dayRef = getDayDocRef(currentUser.uid, currentDateStr);
  // Check total
  const snap = await dayRef.collection('activities').get();
  const activities = snap.docs.map(d=>d.data());
  const total = sumMinutes(activities);
  if(total + minutes > 1440){ alert('Adding this exceeds 1440 minutes'); return; }
  await dayRef.collection('activities').add({
    title, category, minutes, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  activityTitle.value = ''; activityMinutes.value = '';
  loadActivitiesForDate(currentDateStr);
}

async function showAnalyticsForDate(){
  const dayRef = getDayDocRef(currentUser.uid, currentDateStr);
  const snap = await dayRef.collection('activities').get();
  const activities = snap.docs.map(d=>d.data());
  if(activities.length === 0){ alert('No data'); return; }
  // Build category aggregation
  const byCat = {};
  activities.forEach(a => { byCat[a.category] = (byCat[a.category]||0) + (a.minutes||0); });
  const labels = Object.keys(byCat);
  const data = labels.map(l => byCat[l]);
  // Chart
  if(pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: { labels, datasets: [{ data }] },
    options: { responsive: true }
  });
  // Summary
  const total = sumMinutes(activities);
  document.getElementById('summaryStats').innerHTML = `
    <div>Total hours: ${(total/60).toFixed(2)}h</div>
    <div>Activities: ${activities.length}</div>
  `;
}
