const STORAGE_KEY  = 'churniq_data';
const ACTIONED_KEY = 'churniq_actioned';

let csvData = [];

// api config
const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const API_BASE_URL = isLocalhost ? 'http://localhost:5000' : '';

// data persistence (localStorage, used as in-memory cache)
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
  catch (e) { }
}

// csv parser
function parseCSVLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      fields.push(cur.trim()); cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCSV(text) {
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const headers = parseCSVLine(lines[0]).map(h =>
    h.toLowerCase().replace(/[\s_]+/g, '_').replace(/^_|_$/g, '')
  );
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] !== undefined ? vals[idx] : ''; });
    rows.push(row);
  }
  return rows;
}

function normalizeRow(raw, idx, churnInCustValueCol = false) {
  const norm = s => s.toLowerCase().replace(/[\s_]+/g, '_').replace(/^_|_$/g, '');
  const normMap = {};
  for (const k of Object.keys(raw)) normMap[norm(k)] = raw[k];

  const get = (...names) => {
    for (const n of names) {
      const v = normMap[norm(n)];
      if (v !== undefined && v !== '') return v;
    }
    return '';
  };

  const callFailures  = parseFloat(get('call_failure', 'call_failures')) || 0;
  const complains     = parseInt(get('complains')) || 0;
  const subLength     = parseFloat(get('subscription_length')) || 0;
  const chargeAmount  = parseFloat(get('charge_amount')) || 0;
  const secondsUse    = parseFloat(get('seconds_of_use')) || (parseFloat(get('minutes_of_use')) * 60) || 0;
  const freqUse       = parseFloat(get('frequency_of_use')) || 0;
  const freqSMS       = parseFloat(get('frequency_of_sms')) || 0;
  const distinctNums  = parseFloat(get('distinct_called_numbers')) || 0;
  const ageGroup      = parseInt(get('age_group')) || 1;
  const tariffPlan    = parseInt(get('tariff_plan')) || 1;
  const rawStatus     = parseInt(get('status')) || 0;
  const status        = (rawStatus === 1 || rawStatus === 2) ? rawStatus : 1;
  const age           = parseFloat(get('age')) || 0;
  const rawChurn      = parseFloat(get('churn')) || 0;
  const rawCustValue  = parseFloat(get('customer_value')) || 0;
  const churn         = churnInCustValueCol ? Math.round(rawCustValue) : (rawChurn > 0.5 ? 1 : 0);
  const custValue     = churnInCustValueCol ? rawChurn : rawCustValue;

  return {
    id: `CUST-${String(idx + 1).padStart(5, '0')}`,
    callFailures, complains, subLength, chargeAmount,
    secondsUse, freqUse, freqSMS, distinctNums,
    ageGroup, tariffPlan, status, age, custValue, churn,
    riskScore: 0,
    riskLevel: 'low'
  };
}

// batch predict api
async function fetchBatchPredictions(rows) {
  const payload = rows.map(r => ({
    call_failure: r.callFailures,
    complains: r.complains,
    charge_amount: r.chargeAmount,
    frequency_of_use: r.freqUse,
    frequency_of_sms: r.freqSMS,
    distinct_called_numbers: r.distinctNums,
    age_group: r.ageGroup,
    tariff_plan: r.tariffPlan,
    minutes_of_use: r.secondsUse / 60
  }));

  const resp = await fetch(`${API_BASE_URL}/predict/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: payload })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `API error ${resp.status}`);
  }

  const { predictions } = await resp.json();
  return predictions;
}

// utils
function formatCurrency(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'K';
  return '$' + Math.round(n);
}

// toast
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

// import modal
function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function closeModalIfOutside(e) { if (e.target === e.currentTarget) closeModal(); }

function handleDragOver(e) { e.preventDefault(); document.getElementById('drop-zone').classList.add('dragover'); }
function handleDragLeave() { document.getElementById('drop-zone').classList.remove('dragover'); }
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

// delete modal
function openDeleteModal() {
  document.getElementById('delete-modal-overlay').classList.add('open');
}
function closeDeleteModal() {
  document.getElementById('delete-modal-overlay').classList.remove('open');
}
function closeDeleteModalIfOutside(e) {
  if (e.target === e.currentTarget) closeDeleteModal();
}

async function confirmDeleteAllData() {
  closeDeleteModal();
  document.getElementById('loading-overlay').classList.remove('hidden');
  document.getElementById('loading-text').textContent = 'Deleting all data…';

  const deletedCount = csvData.length;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIONED_KEY);
  csvData = [];

  document.getElementById('loading-overlay').classList.add('hidden');
  showToast(`✓ Deleted ${deletedCount.toLocaleString()} customer records`, 'success');
  window.location.href = 'index.html';
}

// file processing
function processFile(file) {
  closeModal();
  document.getElementById('loading-overlay').classList.remove('hidden');
  document.getElementById('loading-text').textContent = 'Reading ' + file.name + '…';

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      document.getElementById('loading-text').textContent = 'Parsing CSV data…';
      const raw = parseCSV(ev.target.result);
      const normKey = k => k.toLowerCase().replace(/[\s_]+/g, '_').replace(/^_|_$/g, '');
      const churnInCustValueCol = raw.some(r => {
        const churnKey = Object.keys(r).find(k => normKey(k) === 'churn');
        if (!churnKey) return false;
        const v = parseFloat(r[churnKey]);
        return !isNaN(v) && v > 1;
      });
      csvData = raw.map((r, i) => normalizeRow(r, i, churnInCustValueCol));

      document.getElementById('loading-text').textContent =
        `Running XGBoost inference on ${csvData.length.toLocaleString()} customers…`;
      const scores = await fetchBatchPredictions(csvData);

      for (let i = 0; i < csvData.length; i++) {
        csvData[i].riskScore = scores[i];
        csvData[i].riskLevel = scores[i] >= 50 ? 'high' : scores[i] >= 25 ? 'medium' : 'low';
      }

      document.getElementById('loading-text').textContent =
        `Saving ${csvData.length.toLocaleString()} customers…`;
      saveCSVData(csvData);

      document.getElementById('loading-overlay').classList.add('hidden');
      showToast(`✓ Loaded ${csvData.length.toLocaleString()} customers from ${file.name}`);
      updateDataStatus(csvData.length);
      if (typeof onDataLoaded === 'function') onDataLoaded(csvData);
    } catch (err) {
      document.getElementById('loading-overlay').classList.add('hidden');
      showToast('Prediction failed: ' + err.message, 'error');
      console.error('processFile error:', err);
    }
  };
  reader.readAsText(file);
}

// data status 
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

// init
document.addEventListener('DOMContentLoaded', () => {
  csvData = loadCSVData();
  updateDataStatus(csvData.length);

  if (csvData.length > 0 && typeof onDataLoaded === 'function') onDataLoaded(csvData);
  else if (csvData.length === 0 && typeof onNoData === 'function') onNoData();
});