// ── Firebase imports ──────────────────────────────────────────────────────────
import { initializeApp }                          from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         GoogleAuthProvider, signInWithPopup }    from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// ── Firebase config ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDWqSi2Is6YLcwKPf-A2A5ekbk2QEd52MQ",
  authDomain:        "tsa-sound-detector.firebaseapp.com",
  projectId:         "tsa-sound-detector",
  storageBucket:     "tsa-sound-detector.firebasestorage.app",
  messagingSenderId: "895425942202",
  appId:             "1:895425942202:web:727262b3c1d2e20e6b2883",
  measurementId:     "G-55MMLXL9XC",
};

const app            = initializeApp(firebaseConfig);
const auth           = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ── Auth UI refs ──────────────────────────────────────────────────────────────
const authScreen      = document.getElementById('authScreen');
const mainApp         = document.getElementById('mainApp');
const authError       = document.getElementById('authError');
const userEmailEl     = document.getElementById('userEmail');
const tabSignIn       = document.getElementById('tabSignIn');
const tabSignUp       = document.getElementById('tabSignUp');
const emailInput      = document.getElementById('emailInput');
const passInput       = document.getElementById('passInput');
const passConfirmRow  = document.getElementById('passConfirmRow');
const passConfirmInput= document.getElementById('passConfirmInput');
const signInBtn       = document.getElementById('signInBtn');
const signUpBtn       = document.getElementById('signUpBtn');
const googleBtn       = document.getElementById('googleBtn');
const signOutBtn      = document.getElementById('signOutBtn');

// ── Auth helpers ──────────────────────────────────────────────────────────────
function setAuthError(msg) {
  authError.textContent   = msg;
  authError.style.display = msg ? 'block' : 'none';
}

function setLoading(btn, on) {
  btn.disabled = on;
  if (!btn._orig) btn._orig = btn.textContent;
  btn.textContent = on ? 'Please wait…' : btn._orig;
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found':         'No account found with that email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/email-already-in-use':   'An account with that email already exists.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/popup-closed-by-user':   'Sign-in popup was closed.',
    'auth/network-request-failed': 'Network error — check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Auth tab switching ────────────────────────────────────────────────────────
tabSignIn.onclick = () => {
  tabSignIn.classList.add('active'); tabSignUp.classList.remove('active');
  passConfirmRow.style.display = 'none';
  signInBtn.style.display = 'block'; signUpBtn.style.display = 'none';
  setAuthError('');
};
tabSignUp.onclick = () => {
  tabSignUp.classList.add('active'); tabSignIn.classList.remove('active');
  passConfirmRow.style.display = 'block';
  signUpBtn.style.display = 'block'; signInBtn.style.display = 'none';
  setAuthError('');
};

// ── Sign in / sign up / Google ────────────────────────────────────────────────
signInBtn.onclick = async () => {
  setAuthError('');
  setLoading(signInBtn, true);
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passInput.value);
  } catch (e) { setAuthError(friendlyError(e.code)); }
  finally     { setLoading(signInBtn, false); }
};

signUpBtn.onclick = async () => {
  setAuthError('');
  if (passInput.value !== passConfirmInput.value) {
    setAuthError("Passwords don't match."); return;
  }
  setLoading(signUpBtn, true);
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passInput.value);
  } catch (e) { setAuthError(friendlyError(e.code)); }
  finally     { setLoading(signUpBtn, false); }
};

googleBtn.onclick = async () => {
  setAuthError('');
  setLoading(googleBtn, true);
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) { setAuthError(friendlyError(e.code)); setLoading(googleBtn, false); }
};

signOutBtn.onclick = () => {
  stopListening();
  signOut(auth);
};

// ── Auth state ────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    authScreen.style.display = 'none';
    mainApp.style.display    = 'block';
    userEmailEl.textContent  = user.displayName || user.email;
  } else {
    authScreen.style.display = 'flex';
    mainApp.style.display    = 'none';
    stopListening();
  }
});

// ── Sound definitions ─────────────────────────────────────────────────────────
const SOUNDS = [
  { id: 'smoke',     idx: 393, label: 'Smoke Detector',    emoji: '🚨', tier: 'danger', notif: 'Smoke detector going off!' },
  { id: 'siren',     idx: 390, label: 'Siren',             emoji: '🚨', tier: 'danger', notif: 'Siren detected nearby.' },
  { id: 'glass',     idx: 437, label: 'Glass Shatter',     emoji: '💥', tier: 'danger', notif: 'Glass breaking detected!' },
  { id: 'baby',      idx:  22, label: 'Baby Crying',       emoji: '👶', tier: 'warn',   notif: 'Baby crying detected.' },
  { id: 'vehhorn',   idx: 302, label: 'Vehicle Horn',      emoji: '📯', tier: 'warn',   notif: 'Vehicle horn detected.' },
  { id: 'trainhorn', idx: 325, label: 'Train Horn',        emoji: '🚂', tier: 'warn',   notif: 'Train horn detected.' },
  { id: 'reversing', idx: 313, label: 'Reversing Beeps',   emoji: '🔁', tier: 'warn',   notif: 'Reversing vehicle detected.' },
  { id: 'doorbell',  idx: 350, label: 'Doorbell',          emoji: '🔔', tier: 'info',   notif: 'Someone rang the doorbell.' },
  { id: 'knock',     idx: 353, label: 'Knock',             emoji: '✊', tier: 'info',   notif: 'Knock at the door detected.' },
  { id: 'phone',     idx: 384, label: 'Telephone Ringing', emoji: '📞', tier: 'info',   notif: 'Telephone ringing.' },
  { id: 'alarm',     idx: 389, label: 'Alarm Clock',       emoji: '⏰', tier: 'info',   notif: 'Alarm clock going off.' },
  { id: 'buzzer',    idx: 392, label: 'Buzzer',            emoji: '📳', tier: 'info',   notif: 'Buzzer detected.' },
  { id: 'microwave', idx: 362, label: 'Microwave',         emoji: '📡', tier: 'info',   notif: 'Microwave beep detected.' },
  { id: 'dog',       idx:  74, label: 'Dog Barking',       emoji: '🐕', tier: 'info',   notif: 'Dog barking detected.' },
  { id: 'vacuum',    idx: 371, label: 'Vacuum Cleaner',    emoji: '🌀', tier: 'info',   notif: 'Vacuum cleaner detected.' },
];

// ── Audio / model config ──────────────────────────────────────────────────────
const YAMNET_SR      = 16000;
const WINDOW_SECS    = 1.5;
const INFERENCE_MS   = 750;
const COOLDOWN       = 3000;
const YAMNET_MODEL_URL = 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1';

// ── State ─────────────────────────────────────────────────────────────────────
let model          = null;
let audioCtx       = null;
let sourceNode     = null;
let processorNode  = null;
let rawSamples     = [];
let nativeSR       = 44100;
let inferenceTimer = null;
let listening      = false;
let lastTrigger    = 0;
let THRESHOLD      = 0.20;

const enabled = Object.fromEntries(SOUNDS.map(s => [s.id, true]));

// ── App DOM refs ──────────────────────────────────────────────────────────────
const statusEl        = document.getElementById('status');
const statusOrb       = document.getElementById('statusOrb');
const startBtn        = document.getElementById('startBtn');
const stopBtn         = document.getElementById('stopBtn');
const alertBox        = document.getElementById('alertBox');
const eventLog        = document.getElementById('eventLog');
const settingsBtn     = document.getElementById('settingsBtn');
const settingsPanel   = document.getElementById('settingsPanel');
const notifSetting    = document.getElementById('notifSetting');
const darkSetting     = document.getElementById('darkSetting');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdVal    = document.getElementById('thresholdVal');
const clearLogBtn     = document.getElementById('clearLog');

// ── Sound toggle builder ──────────────────────────────────────────────────────
function buildSoundToggles() {
  const container = document.getElementById('soundToggles');
  const groups = [
    { label: '🚨 Emergency',          tier: 'danger' },
    { label: '⚠️ Traffic & Safety',   tier: 'warn'   },
    { label: 'ℹ️ Everyday',           tier: 'info'   },
  ];
  groups.forEach(g => {
    const header = document.createElement('div');
    header.className = 'toggle-group-label';
    header.textContent = g.label;
    container.appendChild(header);
    SOUNDS.filter(s => s.tier === g.tier).forEach(s => {
      const row = document.createElement('div');
      row.className = 'setting-row sound-row';
      row.innerHTML = `
        <div class="setting-label">${s.emoji} ${s.label}</div>
        <label class="toggle">
          <input type="checkbox" id="snd-${s.id}" checked>
          <span class="toggle-slider"></span>
        </label>`;
      container.appendChild(row);
      row.querySelector(`#snd-${s.id}`).addEventListener('change', e => {
        enabled[s.id] = e.target.checked;
      });
    });
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function addLog(msg) {
  const ts = new Date().toLocaleTimeString();
  eventLog.textContent += `[${ts}] ${msg}\n`;
  eventLog.scrollTop = eventLog.scrollHeight;
}

clearLogBtn.onclick = () => { eventLog.textContent = ''; };

settingsBtn.onclick = () => {
  settingsPanel.style.display =
    settingsPanel.style.display === 'block' ? 'none' : 'block';
};

darkSetting.addEventListener('change', () => {
  document.body.classList.toggle('dark', darkSetting.checked);
});

thresholdSlider.addEventListener('input', () => {
  THRESHOLD = parseFloat(thresholdSlider.value);
  thresholdVal.textContent = THRESHOLD.toFixed(2);
});

let alertTimeout;
function showAlert(sound, score) {
  clearTimeout(alertTimeout);
  alertBox.style.display = 'block';
  alertBox.className = `alert-${sound.tier}`;
  alertBox.textContent = `${sound.emoji}  ${sound.label} detected (${score.toFixed(3)})`;
  alertBox.style.animation = 'none';
  void alertBox.offsetWidth;
  alertBox.style.animation = '';
  alertTimeout = setTimeout(() => { alertBox.style.display = 'none'; }, 8000);
}

async function sendNotification(sound) {
  if (!notifSetting.checked) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted')
    new Notification(`${sound.emoji} ${sound.label}`, { body: sound.notif });
}

function playTone(tier) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = tier === 'danger' ? 880 : tier === 'warn' ? 660 : 440;
    osc.type = tier === 'danger' ? 'square' : 'sine';
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => osc.stop(), 400);
  } catch (e) {}
}

// ── Model ─────────────────────────────────────────────────────────────────────
async function loadModel() {
  statusEl.textContent = 'Loading YAMNet…';
  addLog('Fetching YAMNet from TF Hub…');
  model = await tf.loadGraphModel(YAMNET_MODEL_URL, { fromTFHub: true });
  addLog('YAMNet ready — monitoring 15 sound classes.');
  statusEl.textContent = 'Ready';
}

// ── Resampling ────────────────────────────────────────────────────────────────
async function resampleTo16k(samples, fromSR) {
  if (fromSR === YAMNET_SR) return samples;
  const outLen = Math.ceil(samples.length * YAMNET_SR / fromSR);
  const tmpCtx = new OfflineAudioContext(1, samples.length, fromSR);
  const srcBuf = tmpCtx.createBuffer(1, samples.length, fromSR);
  srcBuf.getChannelData(0).set(samples);
  const resCtx = new OfflineAudioContext(1, outLen, YAMNET_SR);
  const src = resCtx.createBufferSource();
  src.buffer = srcBuf;
  src.connect(resCtx.destination);
  src.start(0);
  const rendered = await resCtx.startRendering();
  return rendered.getChannelData(0);
}

// ── Inference ─────────────────────────────────────────────────────────────────
async function runInference() {
  if (!model || !listening) return;
  const needed = Math.ceil(nativeSR * WINDOW_SECS);
  if (rawSamples.length < needed) return;

  const snap = Float32Array.from(rawSamples.slice(-needed));
  let waveform, scores16, meanScores, scoresArr;
  try {
    const samples16 = await resampleTo16k(snap, nativeSR);
    const clamped   = samples16.map(v => Math.max(-1, Math.min(1, v)));
    waveform   = tf.tensor1d(clamped);
    const out  = model.execute({ waveform });
    scores16   = Array.isArray(out) ? out[0] : out;
    meanScores = tf.mean(scores16, 0);
    scoresArr  = await meanScores.array();
  } catch (err) {
    addLog('Inference error: ' + err.message);
    return;
  } finally {
    waveform   && waveform.dispose();
    scores16   && scores16.dispose();
    meanScores && meanScores.dispose();
  }

  const now = Date.now();
  if (now - lastTrigger <= COOLDOWN) return;

  let best = null, bestScore = 0;
  for (const sound of SOUNDS) {
    if (!enabled[sound.id]) continue;
    const score = scoresArr[sound.idx] ?? 0;
    if (score >= THRESHOLD && score > bestScore) {
      best = sound; bestScore = score;
    }
  }

  if (best) {
    lastTrigger = now;
    showAlert(best, bestScore);
    addLog(`${best.emoji} ${best.label} — score ${bestScore.toFixed(3)}`);
    playTone(best.tier);
    sendNotification(best);
  }
}

// ── Audio capture ─────────────────────────────────────────────────────────────
async function startListening() {
  if (!model) await loadModel();
  if (listening) return;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    addLog('Microphone error: ' + err.message);
    statusEl.textContent = 'Mic denied';
    return;
  }

  audioCtx      = new (window.AudioContext || window.webkitAudioContext)();
  nativeSR      = audioCtx.sampleRate;
  rawSamples    = [];
  sourceNode    = audioCtx.createMediaStreamSource(stream);
  processorNode = audioCtx.createScriptProcessor(4096, 1, 1);

  const maxBuf = nativeSR * 6;
  processorNode.onaudioprocess = e => {
    const chunk = e.inputBuffer.getChannelData(0);
    rawSamples.push(...chunk);
    if (rawSamples.length > maxBuf)
      rawSamples = rawSamples.slice(rawSamples.length - maxBuf);
  };

  sourceNode.connect(processorNode);
  processorNode.connect(audioCtx.destination);

  listening = true;
  inferenceTimer = setInterval(runInference, INFERENCE_MS);

  startBtn.disabled = true;
  stopBtn.disabled  = false;
  statusEl.textContent = 'Listening…';
  statusOrb.classList.add('listening');
  addLog(`Listening at ${nativeSR} Hz → resampling to ${YAMNET_SR} Hz.`);
}

function stopListening() {
  if (!listening) return;
  clearInterval(inferenceTimer);
  processorNode && processorNode.disconnect();
  sourceNode    && sourceNode.disconnect();
  audioCtx      && audioCtx.close();
  processorNode = sourceNode = audioCtx = null;
  rawSamples    = [];
  listening     = false;
  if (startBtn) startBtn.disabled = false;
  if (stopBtn)  stopBtn.disabled  = true;
  if (statusEl) statusEl.textContent = 'Stopped';
  if (statusOrb) statusOrb.classList.remove('listening');
  addLog('Stopped listening.');
}

startBtn.onclick = startListening;
stopBtn.onclick  = stopListening;

buildSoundToggles();
