// ═══════════════════════════════════════════════════════════════
// dashboard.js  —  ChurnIQ  |  Dashboard page logic
// ═══════════════════════════════════════════════════════════════

let donutChart         = null;
let subLengthChart     = null;
let ageGroupChart      = null;
let chargeAmountChart  = null;
let distinctNosChart   = null;
let survivalChart      = null;

// Called by shared.js after a new CSV is imported
function onDataLoaded(csvData) {
  renderDashboard(csvData);
}

document.addEventListener('DOMContentLoaded', () => {
  const data = loadCSVData();
  if (data.length > 0) {
    renderDashboard(data);
  } else {
    document.getElementById('dashboard-empty').style.display   = 'flex';
    document.getElementById('dashboard-content').style.display = 'none';
  }
});

// ── RENDER ALL ───────────────────────────────────────────────────
function renderDashboard(csvData) {
  document.getElementById('dashboard-empty').style.display   = 'none';
  document.getElementById('dashboard-content').style.display = '';
  renderKPIs(csvData);
  renderRiskDrivers(csvData);
  renderDonut(csvData);
  renderSubLengthChart(csvData);
  renderAgeGroupChart(csvData);
  renderChargeAmountChart(csvData);
  renderDistinctNumbersChart(csvData);
  renderSurvivalChart(csvData);
}

// ── KPI CARDS ────────────────────────────────────────────────────
function renderKPIs(csvData) {
  const total       = csvData.length;
  const churned     = csvData.filter(r => r.churn === 1);
  const churnedCnt  = churned.length;
  const churnRate   = total > 0 ? ((churnedCnt / total) * 100).toFixed(1) : 0;
  const revAtRisk   = churned.reduce((s, r) => s + r.custValue, 0);
  const avgValue    = total > 0 ? csvData.reduce((s, r) => s + r.custValue, 0) / total : 0;

  document.getElementById('kpi-revenue').textContent    = formatCurrency(revAtRisk);
  document.getElementById('kpi-avg-value').textContent  = formatCurrency(avgValue);
  document.getElementById('kpi-churned').textContent    = churnedCnt.toLocaleString();
  document.getElementById('kpi-churned-sub').textContent = `Out of ${total.toLocaleString()} total`;
  document.getElementById('kpi-churn-rate').textContent  = churnRate + '%';
  document.getElementById('kpi-rate-sub').textContent    = `${churnedCnt} of ${total.toLocaleString()} customers`;
  document.getElementById('kpi-total-label').textContent = `Across ${total.toLocaleString()} customers`;
}

// ── RISK DRIVERS ─────────────────────────────────────────────────
function renderRiskDrivers(csvData) {
  const churned = csvData.filter(r => r.churn === 1);
  const active  = csvData.filter(r => r.churn === 0);
  if (!churned.length || !active.length) return;

  const avg = (arr, key) => arr.reduce((s, r) => s + r[key], 0) / arr.length;
  const drivers = [
    { label: 'Call Failures',        key: 'callFailures',  dir: 'higher' },
    { label: 'Complain Rate',         key: 'complains',     dir: 'higher' },
    { label: 'Low SMS Frequency',     key: 'freqSMS',       dir: 'lower'  },
    { label: 'Low Usage Frequency',   key: 'freqUse',       dir: 'lower'  },
    { label: 'Low Charge Amount',     key: 'chargeAmount',  dir: 'lower'  },
    { label: 'Few Distinct Contacts', key: 'distinctNums',  dir: 'lower'  },
  ];

  const scores = drivers.map(d => {
    const ca = avg(churned, d.key);
    const aa = avg(active, d.key);
    const ratio = d.dir === 'higher'
      ? (aa > 0 ? ca / aa : ca > 0 ? 2 : 1)
      : (ca > 0 ? aa / ca : aa > 0 ? 2 : 1);
    return { ...d, ratio: Math.min(ratio, 5) };
  }).sort((a, b) => b.ratio - a.ratio);

  const maxRatio = Math.max(...scores.map(s => s.ratio));
  const colors   = ['#ef4444','#ef4444','#f59e0b','#f59e0b','#10b981','#10b981'];

  document.getElementById('risk-drivers-content').innerHTML = scores.map((d, i) => {
    const pct = Math.round((d.ratio / maxRatio) * 100);
    return `<div class="risk-item">
      <div class="risk-label">${d.label}</div>
      <div class="risk-bar-wrap"><div class="risk-bar" style="width:${pct}%;background:${colors[i]}"></div></div>
      <div class="risk-pct" style="color:${colors[i]}">${pct}%</div>
    </div>`;
  }).join('');
}

// ── DONUT CHART ──────────────────────────────────────────────────
function renderDonut(csvData) {
  const churned = csvData.filter(r => r.churn === 1);
  const payg     = churned.filter(r => r.tariffPlan === 1).length;
  const contract = churned.filter(r => r.tariffPlan === 2).length;
  const total    = payg + contract;
  const paygPct  = total > 0 ? ((payg / total) * 100).toFixed(1) : 0;
  const conPct   = total > 0 ? (100 - parseFloat(paygPct)).toFixed(1) : 0;

  document.getElementById('donut-total').textContent         = total;
  document.getElementById('legend-payg-pct').textContent     = paygPct + '%';
  document.getElementById('legend-payg-count').textContent   = payg.toLocaleString() + ' customers';
  document.getElementById('legend-contract-pct').textContent = conPct + '%';
  document.getElementById('legend-contract-count').textContent = contract.toLocaleString() + ' customers';

  const ratio = contract > 0 ? (payg / contract).toFixed(1) : '∞';
  document.getElementById('tariff-finding').style.display = 'flex';
  document.getElementById('tariff-finding-text').innerHTML =
    `<strong>Key Finding:</strong> Pay-as-you-go customers account for ${paygPct}% of all churns (${payg.toLocaleString()} customers). They churn at ~${ratio}× the rate of contractual customers.`;

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: { datasets: [{ data: [payg, contract], backgroundColor: ['#ef4444','#3b82f6'], borderWidth: 0, hoverOffset: 4 }] },
    options: {
      responsive: false, cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.raw.toLocaleString() + ' customers' }}}
    }
  });
}

// ── SUB LENGTH CHART ─────────────────────────────────────────────
function renderSubLengthChart(csvData) {
  const buckets = {};
  csvData.filter(r => r.churn === 1).forEach(r => {
    const b = Math.floor(r.subLength / 5) * 5;
    buckets[b] = (buckets[b] || 0) + 1;
  });
  const keys   = Object.keys(buckets).sort((a, b) => a - b);
  const labels = keys.map(k => k + '–' + (parseInt(k) + 4) + ' mo');
  const values = keys.map(k => buckets[k]);

  if (subLengthChart) subLengthChart.destroy();
  subLengthChart = new Chart(document.getElementById('subLengthChart'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Churned', data: values, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }}},
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 }, stepSize: 1 }}
      }
    }
  });
}

// ── AGE GROUP CHART ──────────────────────────────────────────────
function renderAgeGroupChart(csvData) {
  const rates = [1,2,3,4,5].map(g => {
    const grp = csvData.filter(r => r.ageGroup === g);
    return grp.length ? parseFloat(((grp.filter(r => r.churn === 1).length / grp.length) * 100).toFixed(1)) : 0;
  });

  if (ageGroupChart) ageGroupChart.destroy();
  ageGroupChart = new Chart(document.getElementById('ageGroupChart'), {
    type: 'bar',
    data: {
      labels: ['Age 1 (Youngest)', 'Age 2', 'Age 3', 'Age 4', 'Age 5 (Oldest)'],
      datasets: [{ label: 'Churn Rate %', data: rates,
        backgroundColor: rates.map(r => r > 20 ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.7)'), borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }}},
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 }, callback: v => v + '%' }, max: Math.max(...rates) + 5 }
      }
    }
  });
}

// ── CHARGE AMOUNT CHART ──────────────────────────────────────────
function renderChargeAmountChart(csvData) {
  const levels = [0,1,2,3,4,5,6,7,8,9];
  const allRates = levels.map(lvl => {
    const grp = csvData.filter(r => Math.round(r.chargeAmount) === lvl);
    return grp.length ? parseFloat(((grp.filter(r => r.churn === 1).length / grp.length) * 100).toFixed(1)) : null;
  });
  const validLabels = levels.filter((_, i) => allRates[i] !== null);
  const validRates  = allRates.filter(r => r !== null);

  if (chargeAmountChart) chargeAmountChart.destroy();
  chargeAmountChart = new Chart(document.getElementById('chargeAmountChart'), {
    type: 'bar',
    data: {
      labels: validLabels.map(l => 'Level ' + l),
      datasets: [{ label: 'Churn Rate %', data: validRates,
        backgroundColor: validRates.map(r => r > 15 ? 'rgba(239,68,68,0.75)' : r > 8 ? 'rgba(245,158,11,0.7)' : 'rgba(16,185,129,0.7)'),
        borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }}},
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 }, callback: v => v + '%' }, max: Math.max(...validRates) + 5 }
      }
    }
  });
}

// ── DISTINCT NUMBERS CHART ───────────────────────────────────────
function renderDistinctNumbersChart(csvData) {
  const buckets = {};
  csvData.forEach(r => {
    const b = Math.floor(r.distinctNums / 5) * 5;
    if (!buckets[b]) buckets[b] = { total: 0, churned: 0 };
    buckets[b].total++;
    if (r.churn === 1) buckets[b].churned++;
  });
  const sortedKeys = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  const labels = sortedKeys.map(k => k + '–' + (k + 4));
  const rates  = sortedKeys.map(k => {
    const g = buckets[k];
    return g.total > 0 ? parseFloat(((g.churned / g.total) * 100).toFixed(1)) : 0;
  });

  if (distinctNosChart) distinctNosChart.destroy();
  distinctNosChart = new Chart(document.getElementById('distinctNumbersChart'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Churn Rate %', data: rates,
      borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)',
      fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#3b82f6', borderWidth: 2.5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }},
      scales: {
        x: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 }, maxRotation: 45 }},
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 }, callback: v => v + '%' }}
      }
    }
  });
}

// ── KAPLAN-MEIER SURVIVAL CURVE ──────────────────────────────────
function renderSurvivalChart(csvData) {
  const n = csvData.length;
  if (!n) return;

  const timeMap = {};
  csvData.forEach(r => {
    const t = Math.round(r.subLength);
    if (!timeMap[t]) timeMap[t] = { events: 0, censored: 0 };
    r.churn === 1 ? timeMap[t].events++ : timeMap[t].censored++;
  });

  const times   = Object.keys(timeMap).map(Number).sort((a, b) => a - b);
  const maxTime = times[times.length - 1];

  let atRisk = n, survival = 1.0;
  const kmPoints = [{ t: 0, s: 100 }];
  times.forEach(t => {
    const { events, censored } = timeMap[t];
    if (events > 0) {
      survival *= (1 - events / atRisk);
      kmPoints.push({ t, s: parseFloat((survival * 100).toFixed(2)) });
    }
    atRisk -= (events + censored);
  });

  const labels = [], values = [];
  let kmIdx = 0, currentS = 100;
  for (let month = 0; month <= maxTime; month++) {
    while (kmIdx < kmPoints.length && kmPoints[kmIdx].t <= month) {
      currentS = kmPoints[kmIdx].s;
      kmIdx++;
    }
    labels.push(month);
    values.push(parseFloat(currentS.toFixed(2)));
  }

  const finalSurvival = values[values.length - 1];
  const medianMonth   = values.findIndex(v => v <= 50);
  const at12mo = values[Math.min(12, values.length - 1)];
  const at24mo = values[Math.min(24, values.length - 1)];

  const stats = [
    { label: 'Survival at 12 mo', value: at12mo.toFixed(1) + '%' },
    { label: 'Survival at 24 mo', value: at24mo.toFixed(1) + '%' },
    { label: 'Median Churn Month', value: medianMonth > 0 ? 'Mo ' + medianMonth : '>' + maxTime },
    { label: 'Final Survival',    value: finalSurvival.toFixed(1) + '%' },
  ];
  document.getElementById('survival-stats').innerHTML = stats.map(s => `
    <div style="background:#f8f9fb;border-radius:8px;padding:8px 14px;">
      <div style="font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.5px">${s.label}</div>
      <div style="font-size:16px;font-weight:700;color:var(--accent-blue);margin-top:2px">${s.value}</div>
    </div>`).join('');

  if (survivalChart) survivalChart.destroy();
  survivalChart = new Chart(document.getElementById('survivalChart'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Survival Probability', data: values,
      borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.07)',
      fill: true, tension: 0, pointRadius: 0, borderWidth: 2.5, borderJoinStyle: 'miter' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        title: items => 'Month ' + items[0].label,
        label: c => 'Survival: ' + c.raw + '%'
      }}},
      scales: {
        x: { title: { display: true, text: 'Month', font: { size: 11 }},
             ticks: { font: { size: 10 }, maxTicksLimit: 24, callback: (v,i) => labels[i] },
             grid: { color: '#f0f0f0' }},
        y: { min: Math.max(0, Math.floor(finalSurvival / 10) * 10 - 10), max: 105,
             title: { display: true, text: 'Probability (%)', font: { size: 11 }},
             ticks: { font: { size: 11 }, callback: v => v + '%' },
             grid: { color: '#f0f0f0' }}
      }
    }
  });
}
