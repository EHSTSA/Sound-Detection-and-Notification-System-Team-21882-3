// ── DOM refs ──────────────────────────────────────────────────────────────────
const statusEl       = document.getElementById('status');
const statusOrb      = document.getElementById('statusOrb');
const startBtn       = document.getElementById('startBtn');
const stopBtn        = document.getElementById('stopBtn');
const alertBox       = document.getElementById('alertBox');
const eventLog       = document.getElementById('eventLog');
const settingsBtn    = document.getElementById('settingsBtn');
const settingsPanel  = document.getElementById('settingsPanel');
const notifSetting   = document.getElementById('notifSetting');
const darkSetting    = document.getElementById('darkSetting');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdVal   = document.getElementById('thresholdVal');
const clearLogBtn    = document.getElementById('clearLog');

// ── Config ────────────────────────────────────────────────────────────────────
// YAMNet operates at 16 kHz. We collect ~1.5 s of audio and run inference
// every 750 ms (sliding window with 50% overlap).
const YAMNET_SR        = 16000;
const WINDOW_SECS      = 1.5;
const WINDOW_SAMPLES   = YAMNET_SR * WINDOW_SECS;   // 24 000 samples
const INFERENCE_MS     = 750;
const COOLDOWN         = 3000;
const YAMNET_MODEL_URL = 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1';
const CLASS_MAP_URL    = 'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv';

// Known YAMNet class indices (from the official yamnet_class_map.csv).
// Used as a fallback if the CSV can't be fetched at runtime.
const FALLBACK_INDICES = { doorbell: 379, fireAlarm: 401, smokeAlarm: 400 };

// ── State ─────────────────────────────────────────────────────────────────────
let model         = null;
let classIndices  = { ...FALLBACK_INDICES };
let audioCtx      = null;
let sourceNode    = null;
let processorNode = null;
let rawSamples    = [];      // ring-buffer at native sample rate
let nativeSR      = 44100;
let inferenceTimer = null;
let listening     = false;
let lastTrigger   = 0;
let THRESHOLD     = 0.20;

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
function showAlert(type, message) {
  clearTimeout(alertTimeout);
  alertBox.style.display = 'block';
  alertBox.className = type === 'door' ? 'alert-door' : 'alert-fire';
  alertBox.textContent = (type === 'door' ? '🔔  ' : '🔥  ') + message;
  alertBox.style.animation = 'none';
  void alertBox.offsetWidth;
  alertBox.style.animation = '';
  alertTimeout = setTimeout(() => { alertBox.style.display = 'none'; }, 8000);
}

async function sendNotification(title, body) {
  if (!notifSetting.checked) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') new Notification(title, { body });
}

function playFireTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.type = 'square';
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => osc.stop(), 600);
  } catch (e) {}
}

// ── YAMNet class map ──────────────────────────────────────────────────────────
// Attempt to fetch the official class map CSV and resolve indices by name.
// Falls back to hardcoded FALLBACK_INDICES if the fetch fails.
async function resolveClassIndices() {
  try {
    const resp = await fetch(CLASS_MAP_URL, { cache: 'force-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const csv = await resp.text();
    const rows = csv.trim().split('\n').slice(1); // skip header
    const names = rows.map(r => r.split(',').slice(2).join(',').replace(/^"|"$/g, '').trim());

    const find = (pattern) => names.findIndex(n => pattern.test(n));
    const di = find(/^doorbell$/i);
    const fi = find(/^fire alarm$/i);
    const si = find(/^smoke detector/i);

    if (di !== -1) classIndices.doorbell   = di;
    if (fi !== -1) classIndices.fireAlarm  = fi;
    if (si !== -1) classIndices.smokeAlarm = si;

    addLog(`Class map loaded — Doorbell: ${classIndices.doorbell}, Fire alarm: ${classIndices.fireAlarm}`);
  } catch (err) {
    addLog(`Class map fetch failed (${err.message}), using fallback indices.`);
  }
}

// ── Model loading ─────────────────────────────────────────────────────────────
async function loadModel() {
  statusEl.textContent = 'Loading YAMNet…';
  addLog('Fetching YAMNet from TF Hub…');

  await resolveClassIndices();

  model = await tf.loadGraphModel(YAMNET_MODEL_URL, { fromTFHub: true });
  addLog('YAMNet ready.');
  statusEl.textContent = 'Ready';
}

// ── Audio resampling ──────────────────────────────────────────────────────────
// Uses OfflineAudioContext to accurately resample a Float32Array from
// `fromSR` Hz down to `toSR` Hz (16 000 for YAMNet).
async function resampleTo16k(samples, fromSR) {
  if (fromSR === YAMNET_SR) return samples;

  const inLen  = samples.length;
  const outLen = Math.ceil(inLen * YAMNET_SR / fromSR);

  // Build a source buffer at the native rate
  const tmpCtx = new OfflineAudioContext(1, inLen, fromSR);
  const srcBuf = tmpCtx.createBuffer(1, inLen, fromSR);
  srcBuf.getChannelData(0).set(samples);

  // Render at 16 kHz using the browser's high-quality SRC
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

  // Snap a window of raw (native-rate) samples
  const needed = Math.ceil(nativeSR * WINDOW_SECS);
  if (rawSamples.length < needed) return;

  const snap = Float32Array.from(rawSamples.slice(-needed));

  let waveform, scores16, meanScores, scoresArr;
  try {
    const samples16 = await resampleTo16k(snap, nativeSR);

    // Clamp to [-1, 1] just in case
    const clamped = samples16.map(v => Math.max(-1, Math.min(1, v)));

    waveform   = tf.tensor1d(clamped);
    // YAMNet returns [scores, embeddings, spectrogram] for the TF Hub graph model
    const out  = model.execute({ 'waveform': waveform });
    scores16   = Array.isArray(out) ? out[0] : out;         // [frames, 521]
    meanScores = tf.mean(scores16, 0);                       // [521]
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

  const doorbellScore = scoresArr[classIndices.doorbell]   ?? 0;
  const fireScore     = scoresArr[classIndices.fireAlarm]  ?? 0;
  const smokeScore    = scoresArr[classIndices.smokeAlarm] ?? 0;
  const maxFireLike   = Math.max(fireScore, smokeScore);

  if (doorbellScore >= THRESHOLD || maxFireLike >= THRESHOLD) {
    lastTrigger = now;
    if (doorbellScore >= maxFireLike && doorbellScore >= THRESHOLD) {
      const p = doorbellScore.toFixed(3);
      showAlert('door', `Doorbell detected (${p})`);
      addLog(`Doorbell — score ${p}`);
      sendNotification('Doorbell Alert', 'Someone rang the doorbell.');
    } else {
      const p = maxFireLike.toFixed(3);
      showAlert('fire', `FIRE ALARM detected (${p})`);
      addLog(`FIRE ALARM — score ${p}`);
      playFireTone();
      sendNotification('Fire Alarm', 'Fire alarm detected in the area.');
    }
  }
}

// ── Audio capture ─────────────────────────────────────────────────────────────
async function startListening() {
  if (!model) await loadModel();
  if (listening) return;

  // Request microphone
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    addLog('Microphone error: ' + err.message);
    statusEl.textContent = 'Mic denied';
    return;
  }

  audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  nativeSR   = audioCtx.sampleRate;
  rawSamples = [];

  sourceNode    = audioCtx.createMediaStreamSource(stream);
  processorNode = audioCtx.createScriptProcessor(4096, 1, 1);

  const maxBuf = nativeSR * 6; // keep 6 s of audio in memory
  processorNode.onaudioprocess = (e) => {
    const chunk = e.inputBuffer.getChannelData(0);
    rawSamples.push(...chunk);
    if (rawSamples.length > maxBuf) {
      rawSamples = rawSamples.slice(rawSamples.length - maxBuf);
    }
  };

  sourceNode.connect(processorNode);
  processorNode.connect(audioCtx.destination);

  listening = true;
  inferenceTimer = setInterval(runInference, INFERENCE_MS);

  startBtn.disabled = false;  // keep enabled so user can re-click (no-op)
  startBtn.disabled = true;
  stopBtn.disabled  = false;
  statusEl.textContent = 'Listening…';
  statusOrb.classList.add('listening');
  addLog(`Listening at ${nativeSR} Hz, resampling to ${YAMNET_SR} Hz.`);
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

  startBtn.disabled = false;
  stopBtn.disabled  = true;
  statusEl.textContent = 'Stopped';
  statusOrb.classList.remove('listening');
  addLog('Stopped listening.');
}

startBtn.onclick = startListening;
stopBtn.onclick  = stopListening;
