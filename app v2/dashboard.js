let donutChart = null;
let subLengthChart = null;
let ageGroupChart = null;
let survivalChart = null;

// Called by common.js when data is available
function onDataLoaded() {
  document.getElementById('dashboard-empty').style.display = 'none';
  document.getElementById('dashboard-content').style.display = '';
  updateKPIs();
  updateRiskDrivers();
  updateDonut();
  updateSubLengthChart();
  updateAgeGroupChart();
  updateSurvivalChart();
}

// Called by common.js when no stored data exists
function onNoData() {
  document.getElementById('dashboard-empty').style.display = 'flex';
  document.getElementById('dashboard-content').style.display = 'none';
}

// ─── KPIs ───
function updateKPIs() {
  const total = csvData.length;
  const churned = csvData.filter(r => r.churn === 1);
  const churnedCount = churned.length;
  const churnRate = total > 0 ? ((churnedCount / total) * 100).toFixed(1) : 0;
  const totalRevenueAtRisk = churned.reduce((s, r) => s + r.custValue, 0);
  const avgValue = total > 0 ? csvData.reduce((s, r) => s + r.custValue, 0) / total : 0;

  document.getElementById('kpi-revenue').textContent = formatCurrency(totalRevenueAtRisk);
  document.getElementById('kpi-avg-value').textContent = formatCurrency(avgValue);
  document.getElementById('kpi-churned').textContent = churnedCount.toLocaleString();
  document.getElementById('kpi-churned-sub').textContent = `Out of ${total.toLocaleString()} total`;
  document.getElementById('kpi-churn-rate').textContent = churnRate + '%';
  document.getElementById('kpi-rate-sub').textContent = `${churnedCount} of ${total.toLocaleString()} customers`;
  document.getElementById('kpi-total-label').textContent = `Across ${total.toLocaleString()} customers`;
}

// ─── Risk Drivers ───
function updateRiskDrivers() {
  const churned = csvData.filter(r => r.churn === 1);
  const active = csvData.filter(r => r.churn === 0);
  if (!churned.length || !active.length) return;

  const avg = (arr, key) => arr.reduce((s, r) => s + r[key], 0) / arr.length;

  const drivers = [
    { label: 'Call Failures', key: 'callFailures', dir: 'higher' },
    { label: 'Complain Rate', key: 'complains', dir: 'higher' },
    { label: 'Inactive Status', key: 'status', dir: 'higher' },
    { label: 'Low SMS Frequency', key: 'freqSMS', dir: 'lower' },
    { label: 'Low Usage Frequency', key: 'freqUse', dir: 'lower' },
    { label: 'Customer Value', key: 'custValue', dir: 'lower' },
  ];

  const scores = drivers.map(d => {
    const ca = avg(churned, d.key);
    const aa = avg(active, d.key);
    let ratio = d.dir === 'higher'
      ? (aa > 0 ? ca / aa : ca > 0 ? 2 : 1)
      : (ca > 0 ? aa / ca : aa > 0 ? 2 : 1);
    return { ...d, ratio: Math.min(ratio, 5) };
  });

  const maxRatio = Math.max(...scores.map(s => s.ratio));
  scores.sort((a, b) => b.ratio - a.ratio);

  const colors = ['#ef4444', '#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981'];
  const html = scores.map((d, i) => {
    const pct = Math.round((d.ratio / maxRatio) * 100);
    return `<div class="risk-item">
      <div class="risk-label">${d.label}</div>
      <div class="risk-bar-wrap"><div class="risk-bar" style="width:${pct}%;background:${colors[i]}"></div></div>
      <div class="risk-pct" style="color:${colors[i]}">${pct}%</div>
    </div>`;
  }).join('');

  document.getElementById('risk-drivers-content').innerHTML = html;
}

// ─── Donut Chart ───
function updateDonut() {
  const churned = csvData.filter(r => r.churn === 1);
  const paygChurned = churned.filter(r => r.tariffPlan === 1).length;
  const contractChurned = churned.filter(r => r.tariffPlan === 2).length;
  const total = paygChurned + contractChurned;
  const paygPct = total > 0 ? ((paygChurned / total) * 100).toFixed(1) : 0;
  const contractPct = total > 0 ? (100 - parseFloat(paygPct)).toFixed(1) : 0;

  document.getElementById('donut-total').textContent = total;
  document.getElementById('legend-payg-pct').textContent = paygPct + '%';
  document.getElementById('legend-payg-count').textContent = paygChurned.toLocaleString() + ' customers';
  document.getElementById('legend-contract-pct').textContent = contractPct + '%';
  document.getElementById('legend-contract-count').textContent = contractChurned.toLocaleString() + ' customers';

  const ratio = contractChurned > 0 ? (paygChurned / contractChurned).toFixed(1) : '∞';
  document.getElementById('tariff-finding').style.display = 'flex';
  document.getElementById('tariff-finding-text').innerHTML = `<strong>Key Finding:</strong> Pay-as-you-go customers account for ${paygPct}% of all churns (${paygChurned.toLocaleString()} customers). They churn at ~${ratio}× the rate of contractual customers.`;

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      datasets: [{ data: [paygChurned, contractChurned], backgroundColor: ['#ef4444', '#3b82f6'], borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: false, cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + c.raw.toLocaleString() + ' customers' } } }
    }
  });
}

// ─── Subscription Length Chart ───
function updateSubLengthChart() {
  const churned = csvData.filter(r => r.churn === 1);
  const buckets = {};
  churned.forEach(r => {
    const bucket = Math.floor(r.subLength / 5) * 5;
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  });
  const labels = Object.keys(buckets).sort((a, b) => a - b).map(k => k + '-' + (parseInt(k) + 4) + ' mo');
  const values = Object.keys(buckets).sort((a, b) => a - b).map(k => buckets[k]);

  if (subLengthChart) subLengthChart.destroy();
  subLengthChart = new Chart(document.getElementById('subLengthChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Churned Customers', data: values, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 }, stepSize: 1 } }
      }
    }
  });
}

// ─── Age Group Chart ───
function updateAgeGroupChart() {
  const groups = [1, 2, 3, 4, 5];
  const rates = groups.map(g => {
    const inGroup = csvData.filter(r => r.ageGroup === g);
    if (!inGroup.length) return 0;
    const churned = inGroup.filter(r => r.churn === 1).length;
    return parseFloat(((churned / inGroup.length) * 100).toFixed(1));
  });

  if (ageGroupChart) ageGroupChart.destroy();
  ageGroupChart = new Chart(document.getElementById('ageGroupChart'), {
    type: 'bar',
    data: {
      labels: ['Age 1 (Youngest)', 'Age 2', 'Age 3', 'Age 4', 'Age 5 (Oldest)'],
      datasets: [{ label: 'Churn Rate %', data: rates, backgroundColor: rates.map(r => r > 20 ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.7)'), borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 }, callback: v => v + '%' }, max: Math.max(...rates) + 5 }
      }
    }
  });
}

// ─── XGBoost AFT Survival Curve ───

let _dashboardXgbModel = null;

async function loadDashboardXGBModel() {
  if (_dashboardXgbModel) return _dashboardXgbModel;
  try {
    const resp = await fetch('model.json');
    _dashboardXgbModel = await resp.json();
    return _dashboardXgbModel;
  } catch (err) {
    console.error('Failed to load XGBoost model:', err);
    return null;
  }
}

function dashPredictTree(tree, features) {
  let nodeIdx = 0;
  while (true) {
    const leftChild = tree.left_children[nodeIdx];
    if (leftChild === -1) return tree.base_weights[nodeIdx];
    const splitFeature = tree.split_indices[nodeIdx];
    const splitValue = tree.split_conditions[nodeIdx];
    const featureVal = features[splitFeature];
    nodeIdx = (featureVal < splitValue) ? leftChild : tree.right_children[nodeIdx];
  }
}

function dashErf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function parseBaseScore(model) {
  const raw = model.learner?.learner_model_param?.base_score || '0';
  const val = parseFloat(String(raw).replace(/[\[\]]/g, ''));
  return isNaN(val) ? 0 : val;
}

// Corrected: Returns logTime (mu), matches predict.js logic
function xgbPredictLogTime(model, features) {
  const trees = model.learner.gradient_booster.model.trees;
  let logTime = parseBaseScore(model);
  for (const tree of trees) {
    logTime += dashPredictTree(tree, features);
  }
  return logTime;
}

// Corrected: Uses Log-Normal S(t) = 1 - Phi((ln(t) - mu) / sigma)
function logNormalSurvival(month, logTime, sigma) {
  if (month <= 0) return 1.0;
  const z = (Math.log(month) - logTime) / sigma;
  const churnProb = 0.5 * (1 + dashErf(z / Math.sqrt(2)));
  const surv = 1 - churnProb;
  if (z < -5) return 1.0;
  if (z > 5) return 0.0;
  return isNaN(surv) ? 0.5 : surv;
}

function buildFeatureVectorFromRow(row) {
  return [
    row.callFailures || 0,
    row.complains || 0,
    row.chargeAmount || 0,
    row.freqUse || 0,
    row.freqSMS || 0,
    row.distinctNums || 0,
    row.ageGroup || 1,
    row.tariffPlan || 1,
    (row.secondsUse || 0) / 60 // convert seconds to minutes
  ];
}

async function updateSurvivalChart() {
  const n = csvData.length;
  if (n === 0) return;

  const model = await loadDashboardXGBModel();
  if (!model) return;

  // Extract learned sigma (scale)
  const sigma = parseFloat(model.learner?.learner_model_param?.aft_loss_distribution_scale || '1.0');

  // Pre-compute logTimes for population
  const featureVectors = csvData.map(r => buildFeatureVectorFromRow(r));
  const logTimes = featureVectors.map(fv => xgbPredictLogTime(model, fv));

  const maxTime = 48;
  const labels = [];
  const values = [];

  for (let month = 0; month <= maxTime; month++) {
    labels.push(month);
    if (month === 0) {
      values.push(100);
      continue;
    }
    let totalSurvival = 0;
    for (const lt of logTimes) {
      totalSurvival += logNormalSurvival(month, lt, sigma);
    }
    values.push(parseFloat(((totalSurvival / n) * 100).toFixed(2)));
  }

  const finalSurvival = values[values.length - 1];
  const medianMonthIdx = values.findIndex(v => v <= 50);
  const at12mo = values[Math.min(12, values.length - 1)];
  const at24mo = values[Math.min(24, values.length - 1)];

  document.getElementById('survival-stats').innerHTML = [
    { label: 'Survival at 12 mo', value: at12mo.toFixed(1) + '%' },
    { label: 'Survival at 24 mo', value: at24mo.toFixed(1) + '%' },
    { label: 'Median Churn Month', value: medianMonthIdx > 0 ? 'Mo ' + medianMonthIdx : '>' + maxTime },
    { label: 'Final Survival', value: finalSurvival.toFixed(1) + '%' }
  ].map(s => `
    <div style="background:#f8f9fb;border-radius:8px;padding:8px 14px;">
      <div style="font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase">${s.label}</div>
      <div style="font-size:16px;font-weight:700;color:var(--accent-blue);margin-top:2px">${s.value}</div>
    </div>`).join('');

  if (survivalChart) survivalChart.destroy();
  survivalChart = new Chart(document.getElementById('survivalChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Average Survival Probability',
        data: values,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.05)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: Math.max(0, Math.floor(finalSurvival / 10) * 10 - 20), max: 105, ticks: { callback: v => v + '%' } }
      }
    }
  });
}