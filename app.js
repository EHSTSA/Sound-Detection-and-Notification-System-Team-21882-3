const statusEl = document.getElementById('status');
const statusOrb = document.getElementById('statusOrb');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const alertBox = document.getElementById('alertBox');
const eventLog = document.getElementById('eventLog');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const notifSetting = document.getElementById('notifSetting');
const darkSetting = document.getElementById('darkSetting');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdVal = document.getElementById('thresholdVal');
const clearLogBtn = document.getElementById('clearLog');

let recognizer = null;
let listening = false;

const LABEL_DOORBELL = "Doorbell";
const LABEL_FIRE = "Fire Alarm";
let THRESHOLD = 0.70;
let lastTrigger = 0;
const COOLDOWN = 2500;

thresholdSlider.addEventListener('input', () => {
  THRESHOLD = parseFloat(thresholdSlider.value);
  thresholdVal.textContent = THRESHOLD.toFixed(2);
});

function addLog(message) {
  const ts = new Date().toLocaleTimeString();
  eventLog.textContent += `[${ts}] ${message}\n`;
  eventLog.scrollTop = eventLog.scrollHeight;
}

clearLogBtn.onclick = () => { eventLog.textContent = ''; };

settingsBtn.onclick = () => {
  const open = settingsPanel.style.display === 'block';
  settingsPanel.style.display = open ? 'none' : 'block';
};

darkSetting.addEventListener('change', () => {
  document.body.classList.toggle('dark', darkSetting.checked);
});

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

let alertTimeout;
function showAlert(type, message) {
  clearTimeout(alertTimeout);
  alertBox.style.display = 'block';
  alertBox.className = type === 'door' ? 'alert-door' : 'alert-fire';
  const icon = type === 'door' ? '🔔' : '🔥';
  alertBox.textContent = `${icon}  ${message}`;
  alertBox.style.animation = 'none';
  void alertBox.offsetWidth;
  alertBox.style.animation = '';
  alertTimeout = setTimeout(() => { alertBox.style.display = 'none'; }, 8000);
}

async function loadModel() {
  statusEl.textContent = 'Loading model…';
  addLog('Loading model…');
  const base = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
  recognizer = speechCommands.create('BROWSER_FFT', null, base + 'model.json', base + 'metadata.json');
  await recognizer.ensureModelLoaded();
  statusEl.textContent = 'Ready';
  addLog('Model loaded. Ready to listen.');
}

async function startListening() {
  if (!recognizer) await loadModel();
  if (listening) return;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  listening = true;
  statusEl.textContent = 'Listening…';
  statusOrb.classList.add('listening');

  recognizer.listen(result => {
    const scores = result.scores;
    const labels = recognizer.wordLabels();
    const maxProb = Math.max(...scores);
    const label = labels[scores.indexOf(maxProb)];
    const now = Date.now();
    if (maxProb >= THRESHOLD && now - lastTrigger > COOLDOWN) {
      lastTrigger = now;
      if (label === LABEL_DOORBELL) {
        const p = maxProb.toFixed(2);
        showAlert('door', `Doorbell detected (${p})`);
        addLog(`Doorbell detected — confidence ${p}`);
        sendNotification('Doorbell Alert', 'Someone rang the doorbell.');
      }
      if (label === LABEL_FIRE) {
        const p = maxProb.toFixed(2);
        showAlert('fire', `FIRE ALARM detected (${p})`);
        addLog(`FIRE ALARM detected — confidence ${p}`);
        playFireTone();
        sendNotification('Fire Alarm', 'Fire alarm detected in the area.');
      }
    }
  }, { includeSpectrogram: true, probabilityThreshold: 0, overlapFactor: 0.5, invokeCallbackOnNoiseAndUnknown: true });
}

function stopListening() {
  if (!recognizer || !listening) return;
  recognizer.stopListening();
  listening = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'Stopped';
  statusOrb.classList.remove('listening');
  addLog('Stopped listening.');
}

startBtn.onclick = startListening;
stopBtn.onclick = stopListening;
