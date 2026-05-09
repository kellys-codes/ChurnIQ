let csvData = [];

// ─── LocalStorage helpers ───
function saveDataToStorage(data) {
  try {
    localStorage.setItem('churniq_csvData', JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

function loadDataFromStorage() {
  try {
    const stored = localStorage.getItem('churniq_csvData');
    if (stored) {
      csvData = JSON.parse(stored);
      return true;
    }
  } catch (e) {
    console.warn('Could not load from localStorage:', e);
  }
  return false;
}

// ─── Toast ───
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.className = 'toast ' + type;
  t.innerHTML = (type === 'success'
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>') + msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── Modal ───
function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function closeModalIfOutside(e) { if (e.target === e.currentTarget) closeModal(); }

function handleDragOver(e) { e.preventDefault(); document.getElementById('drop-zone').classList.add('dragover'); }
function handleDragLeave(e) { document.getElementById('drop-zone').classList.remove('dragover'); }
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

// ─── CSV Parser ───
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
    for (const n of names) {
      for (const k of Object.keys(raw)) {
        if (k.replace(/\s+/g,'_') === n.replace(/\s+/g,'_')) return raw[k];
      }
    }
    return '';
  };

  const callFailures = parseFloat(get('call__failure','call_failure','call_failures')) || 0;
  const complains    = parseInt(get('complains')) || 0;
  const subLength    = parseFloat(get('subscription__length','subscription_length')) || 0;
  const chargeAmount = parseFloat(get('charge__amount','charge_amount')) || 0;
  const secondsUse   = parseFloat(get('seconds_of_use')) || 0;
  const freqUse      = parseFloat(get('frequency_of_use')) || 0;
  const freqSMS      = parseFloat(get('frequency_of_sms')) || 0;
  const distinctNums = parseFloat(get('distinct_called_numbers')) || 0;
  const ageGroup     = parseInt(get('age_group')) || 1;
  const tariffPlan   = parseInt(get('tariff_plan')) || 1;
  const status       = parseInt(get('status')) || 1;
  const age          = parseFloat(get('age')) || 0;
  const custValue    = parseFloat(get('customer_value')) || 0;
  const churn        = parseInt(get('churn')) || 0;

  const riskScore = computeRiskScore({ callFailures, complains, subLength, chargeAmount, secondsUse, freqUse, freqSMS, distinctNums, ageGroup, tariffPlan, status, custValue });

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
  score += Math.min(d.callFailures * 3.5, 30);
  score += d.complains ? 20 : 0;
  score += d.tariffPlan === 1 ? 10 : 0;
  score += d.status === 2 ? 10 : 0;
  score += d.freqSMS < 10 ? 8 : d.freqSMS < 30 ? 4 : 0;
  score += d.freqUse < 10 ? 8 : d.freqUse < 30 ? 3 : 0;
  score += d.subLength < 10 ? 8 : d.subLength > 35 ? -5 : 0;
  score += d.custValue < 100 ? 6 : 0;
  return Math.min(Math.max(Math.round(score), 0), 100);
}

// ─── Process File ───
function processFile(file) {
  closeModal();
  document.getElementById('loading-overlay').classList.remove('hidden');
  document.getElementById('loading-text').textContent = 'Reading ' + file.name + '...';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      document.getElementById('loading-text').textContent = 'Parsing CSV data...';
      const raw = parseCSV(e.target.result);
      document.getElementById('loading-text').textContent = 'Computing analytics...';

      setTimeout(() => {
        csvData = raw.map((r, i) => normalizeRow(r, i));
        saveDataToStorage(csvData);
        if (typeof onDataLoaded === 'function') onDataLoaded();
        document.getElementById('loading-overlay').classList.add('hidden');
        showToast(`✓ Loaded ${csvData.length.toLocaleString()} customers from ${file.name}`);
        updateStatusBar();
      }, 100);
    } catch(err) {
      document.getElementById('loading-overlay').classList.add('hidden');
      showToast('Failed to parse CSV: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function updateStatusBar() {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (csvData.length > 0) {
    dot.classList.remove('none');
    txt.textContent = `${csvData.length.toLocaleString()} customers loaded`;
  } else {
    dot.classList.add('none');
    txt.textContent = 'No data loaded';
  }
}

// ─── Utilities ───
function formatCurrency(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + Math.round(n/1000) + 'K';
  return '$' + Math.round(n);
}

// ─── Init on page load ───
document.addEventListener('DOMContentLoaded', () => {
  const hasData = loadDataFromStorage();
  updateStatusBar();
  if (hasData && typeof onDataLoaded === 'function') {
    onDataLoaded();
  } else if (typeof onNoData === 'function') {
    onNoData();
  }
});
