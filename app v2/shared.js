// ═══════════════════════════════════════════════════════════════
// shared.js  —  ChurnIQ  |  Common utilities for all pages
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY  = 'churniq_data';
const ACTIONED_KEY = 'churniq_actioned';

// ── DATA PERSISTENCE ─────────────────────────────────────────────
function loadCSVData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveCSVData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.error('Storage write failed:', e); }
}

function loadActionedSet() {
  try {
    const raw = localStorage.getItem(ACTIONED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) { return new Set(); }
}

function saveActionedSet(set) {
  try { localStorage.setItem(ACTIONED_KEY, JSON.stringify([...set])); }
  catch (e) {}
}

// ── CSV PARSER ───────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    if (vals.length < headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ? vals[idx].trim() : ''; });
    rows.push(row);
  }
  return rows;
}

function normalizeRow(raw, idx) {
  const get = (...names) => {
    for (const n of names)
      for (const k of Object.keys(raw))
        if (k.replace(/\s+/g, '_') === n.replace(/\s+/g, '_')) return raw[k];
    return '';
  };

  const callFailures = parseFloat(get('call__failure', 'call_failure', 'call_failures')) || 0;
  const complains    = parseInt(get('complains'))                                         || 0;
  const subLength    = parseFloat(get('subscription__length', 'subscription_length'))     || 0;
  const chargeAmount = parseFloat(get('charge__amount', 'charge_amount'))                 || 0;
  const secondsUse   = parseFloat(get('seconds_of_use'))                                  || 0;
  const freqUse      = parseFloat(get('frequency_of_use'))                                || 0;
  const freqSMS      = parseFloat(get('frequency_of_sms'))                                || 0;
  const distinctNums = parseFloat(get('distinct_called_numbers'))                         || 0;
  const ageGroup     = parseInt(get('age_group'))                                         || 1;
  const tariffPlan   = parseInt(get('tariff_plan'))                                       || 1;
  const status       = parseInt(get('status'))                                             || 1;
  const age          = parseFloat(get('age'))                                              || 0;
  const custValue    = parseFloat(get('customer_value'))                                   || 0;
  const churn        = parseInt(get('churn'))                                              || 0;

  const riskScore = computeRiskScore({
    callFailures, complains, subLength, chargeAmount,
    secondsUse, freqUse, freqSMS, distinctNums, ageGroup, tariffPlan, status, custValue
  });

  return {
    id: `CUST-${String(idx + 1).padStart(5, '0')}`,
    callFailures, complains, subLength, chargeAmount,
    secondsUse, freqUse, freqSMS, distinctNums,
    ageGroup, tariffPlan, status, age, custValue, churn,
    riskScore,
    riskLevel: riskScore >= 65 ? 'high' : riskScore >= 35 ? 'medium' : 'low'
  };
}

function computeRiskScore(d) {
  let score = 0;
  score += Math.min(d.callFailures * 4, 35);
  score += d.complains    ? 22 : 0;
  score += d.chargeAmount <= 1 ? 14 : d.chargeAmount <= 3 ? 6 : 0;
  score += d.freqSMS   < 10 ? 10 : d.freqSMS  < 20 ? 5 : 0;
  score += d.freqUse   < 10 ? 10 : d.freqUse  < 30 ? 4 : 0;
  score += d.distinctNums < 5 ? 8 : d.distinctNums < 10 ? 3 : 0;
  score += d.tariffPlan === 1 ? 10 : 0;
  score += d.secondsUse < 3000 ? 6 : d.secondsUse < 9000 ? 2 : 0;
  score += d.ageGroup === 1 ? 2 : 0;
  return Math.min(Math.max(Math.round(score), 0), 100);
}

// ── UTILITIES ────────────────────────────────────────────────────
function formatCurrency(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'K';
  return '$' + Math.round(n);
}

// ── TOAST ────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.className = 'toast ' + type;
  const icon = type === 'success'
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  t.innerHTML = icon + msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── IMPORT MODAL ─────────────────────────────────────────────────
function openModal()  { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function closeModalIfOutside(e) { if (e.target === e.currentTarget) closeModal(); }

function handleDragOver(e)  { e.preventDefault(); document.getElementById('drop-zone').classList.add('dragover'); }
function handleDragLeave()  { document.getElementById('drop-zone').classList.remove('dragover'); }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.csv')) processFile(f);
  else showToast('Please upload a CSV file', 'error');
}
function handleFileSelect(e) {
  const f = e.target.files[0];
  if (f) processFile(f);
  e.target.value = '';
}

// ── FILE PROCESSING ──────────────────────────────────────────────
function processFile(file) {
  closeModal();
  document.getElementById('loading-overlay').classList.remove('hidden');
  document.getElementById('loading-text').textContent = 'Reading ' + file.name + '…';
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      document.getElementById('loading-text').textContent = 'Parsing CSV data…';
      const raw = parseCSV(ev.target.result);
      document.getElementById('loading-text').textContent = 'Computing analytics…';
      setTimeout(() => {
        const csvData = raw.map((r, i) => normalizeRow(r, i));
        saveCSVData(csvData);
        document.getElementById('loading-overlay').classList.add('hidden');
        showToast(`✓ Loaded ${csvData.length.toLocaleString()} customers from ${file.name}`);
        updateDataStatus(csvData.length);
        if (typeof onDataLoaded === 'function') onDataLoaded(csvData);
      }, 100);
    } catch (err) {
      document.getElementById('loading-overlay').classList.add('hidden');
      showToast('Failed to parse CSV: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ── DATA STATUS BAR ──────────────────────────────────────────────
function updateDataStatus(count) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (count > 0) {
    dot.classList.remove('none');
    text.textContent = `${count.toLocaleString()} customers loaded`;
  } else {
    dot.classList.add('none');
    text.textContent = 'No data loaded';
  }
}

// Init status on every page load
document.addEventListener('DOMContentLoaded', () => {
  const data = loadCSVData();
  updateDataStatus(data.length);
});
