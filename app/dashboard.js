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
  const avgValue = total > 0 ? csvData.reduce((s,r) => s + r.custValue, 0) / total : 0;

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
  const active  = csvData.filter(r => r.churn === 0);
  if (!churned.length || !active.length) return;

  const avg = (arr, key) => arr.reduce((s,r) => s + r[key], 0) / arr.length;

  const drivers = [
    { label: 'Call Failures',       key: 'callFailures',  dir: 'higher' },
    { label: 'Complain Rate',        key: 'complains',     dir: 'higher' },
    { label: 'Inactive Status',      key: 'status',        dir: 'higher' },
    { label: 'Low SMS Frequency',    key: 'freqSMS',       dir: 'lower'  },
    { label: 'Low Usage Frequency',  key: 'freqUse',       dir: 'lower'  },
    { label: 'Customer Value',       key: 'custValue',     dir: 'lower'  },
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
  scores.sort((a,b) => b.ratio - a.ratio);

  const colors = ['#ef4444','#ef4444','#f59e0b','#f59e0b','#10b981','#10b981'];
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
  const paygChurned     = churned.filter(r => r.tariffPlan === 1).length;
  const contractChurned = churned.filter(r => r.tariffPlan === 2).length;
  const total = paygChurned + contractChurned;
  const paygPct = total > 0 ? ((paygChurned / total)*100).toFixed(1) : 0;
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
      datasets: [{ data: [paygChurned, contractChurned], backgroundColor: ['#ef4444','#3b82f6'], borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: false, cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + c.raw.toLocaleString() + ' customers' }}}
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
  const labels = Object.keys(buckets).sort((a,b)=>a-b).map(k => k + '-' + (parseInt(k)+4) + ' mo');
  const values = Object.keys(buckets).sort((a,b)=>a-b).map(k => buckets[k]);

  if (subLengthChart) subLengthChart.destroy();
  subLengthChart = new Chart(document.getElementById('subLengthChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Churned Customers', data: values, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 }]
    },
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

// ─── Age Group Chart ───
function updateAgeGroupChart() {
  const groups = [1,2,3,4,5];
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
      plugins: { legend: { display: false }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }}},
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 }, callback: v => v + '%' }, max: Math.max(...rates) + 5 }
      }
    }
  });
}

// ─── Kaplan-Meier Survival Curve ───
function updateSurvivalChart() {
  const n = csvData.length;
  if (n === 0) return;

  const timeMap = {};
  csvData.forEach(r => {
    const t = Math.round(r.subLength);
    if (!timeMap[t]) timeMap[t] = { events: 0, censored: 0 };
    if (r.churn === 1) timeMap[t].events++;
    else timeMap[t].censored++;
  });

  const times = Object.keys(timeMap).map(Number).sort((a,b)=>a-b);
  const maxTime = times[times.length - 1];

  let atRisk = n;
  let survival = 1.0;
  const kmPoints = [{ t: 0, s: 100 }];

  times.forEach(t => {
    const { events, censored } = timeMap[t];
    if (events > 0) {
      survival *= (1 - events / atRisk);
      kmPoints.push({ t, s: parseFloat((survival * 100).toFixed(2)) });
    }
    atRisk -= (events + censored);
  });

  const labels = [];
  const values = [];
  let kmIdx = 0;
  let currentS = 100;

  for (let month = 0; month <= maxTime; month++) {
    while (kmIdx < kmPoints.length && kmPoints[kmIdx].t <= month) {
      currentS = kmPoints[kmIdx].s;
      kmIdx++;
    }
    labels.push(month);
    values.push(parseFloat(currentS.toFixed(2)));
  }

  const finalSurvival = values[values.length - 1];
  const medianMonth = values.findIndex(v => v <= 50);
  const at12mo = values[Math.min(12, values.length - 1)];
  const at24mo = values[Math.min(24, values.length - 1)];

  const stats = [
    { label: 'Survival at 12 mo', value: at12mo.toFixed(1) + '%' },
    { label: 'Survival at 24 mo', value: at24mo.toFixed(1) + '%' },
    { label: 'Median Churn Month', value: medianMonth > 0 ? 'Mo ' + medianMonth : '>'+maxTime },
    { label: 'Final Survival', value: finalSurvival.toFixed(1) + '%' },
  ];
  document.getElementById('survival-stats').innerHTML = stats.map(s => `
    <div style="background:#f8f9fb;border-radius:8px;padding:8px 14px;">
      <div style="font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.5px">${s.label}</div>
      <div style="font-size:16px;font-weight:700;color:var(--accent-blue);margin-top:2px">${s.value}</div>
    </div>
  `).join('');

  if (survivalChart) survivalChart.destroy();
  survivalChart = new Chart(document.getElementById('survivalChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Survival Probability',
        data: values,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.07)',
        fill: true,
        tension: 0,
        pointRadius: 0,
        borderWidth: 2.5,
        borderJoinStyle: 'miter'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => 'Month ' + items[0].label,
            label: (c) => 'Survival: ' + c.raw + '%'
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Month', font: { size: 11 } },
          ticks: { font: { size: 10 }, maxTicksLimit: 24, callback: (v,i) => labels[i] },
          grid: { color: '#f0f0f0' }
        },
        y: {
          min: Math.max(0, Math.floor(finalSurvival / 10) * 10 - 10),
          max: 105,
          title: { display: true, text: 'Probability (%)', font: { size: 11 } },
          ticks: { font: { size: 11 }, callback: v => v + '%' },
          grid: { color: '#f0f0f0' }
        }
      }
    }
  });
}
