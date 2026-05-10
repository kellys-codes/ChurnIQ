// ═══════════════════════════════════════════════════════════════
// predict.js  —  ChurnIQ  |  Predict Customer page
// ═══════════════════════════════════════════════════════════════

// Called by shared.js after a new CSV is imported — nothing to re-render here
function onDataLoaded() {}

// ── RUN PREDICTION ───────────────────────────────────────────────
function runPrediction() {
  const id         = document.getElementById('f-id').value        || 'CUST-XXXX';
  const failures   = parseFloat(document.getElementById('f-failures').value)  || 0;
  const complains  = parseInt(document.getElementById('f-complains').value)    || 0;
  const sublength  = parseFloat(document.getElementById('f-sublength').value)  || 0;
  const charge     = parseFloat(document.getElementById('f-charge').value)     || 0;
  const secondsOfUse = parseFloat(document.getElementById('f-seconds').value)  || 0;
  const minutesOfUse = secondsOfUse / 60;
  const freq       = parseFloat(document.getElementById('f-freq').value)       || 0;
  const sms        = parseFloat(document.getElementById('f-sms').value)        || 0;
  const distinct   = parseFloat(document.getElementById('f-distinct').value)   || 0;
  const ageGroup   = parseInt(document.getElementById('f-age').value)          || 3;
  const tariff     = document.getElementById('f-tariff').value;
  const custValue  = parseFloat(document.getElementById('f-value').value)      || 0;
  const status     = document.getElementById('f-status').value;

  const btn = document.getElementById('predict-btn');
  btn.disabled = true;
  document.getElementById('btn-text').textContent     = 'Analyzing…';
  document.getElementById('btn-arrow').style.display  = 'none';
  document.getElementById('btn-spinner').style.display = 'block';

  setTimeout(() => {
    try {
      const result = computeChurnPrediction({
        id, failures, complains, sublength, charge, minutesOfUse,
        freq, sms, distinct, ageGroup, tariff, custValue, status
      });
      showResult(id, result);
    } catch (err) {
      showToast('Analysis failed: ' + err.message, 'error');
    }
    btn.disabled = false;
    document.getElementById('btn-text').textContent     = 'Calculate Churn Risk';
    document.getElementById('btn-arrow').style.display  = '';
    document.getElementById('btn-spinner').style.display = 'none';
  }, 600);
}

// ── PREDICTION ENGINE ────────────────────────────────────────────
function computeChurnPrediction(d) {
  // 1. Risk score (0–100)
  let score = 0;
  score += Math.min(d.failures * 4.2, 36);
  score += d.complains ? 22 : 0;
  if      (d.charge <= 1) score += 15;
  else if (d.charge <= 3) score +=  7;
  else if (d.charge >= 4) score -=  5;

  if      (d.sms < 5)  score += 12;
  else if (d.sms < 20) score +=  6;
  else if (d.sms > 60) score -=  4;

  if      (d.freq < 5)  score += 10;
  else if (d.freq < 20) score +=  4;
  else if (d.freq > 80) score -=  3;

  if      (d.distinct < 5)  score += 10;
  else if (d.distinct < 10) score +=  4;
  else if (d.distinct >= 20 && d.distinct <= 40) score -= 4;

  score += (d.tariff === 'payg' || d.tariff === '1') ? 10 : 0;

  if      (d.minutesOfUse < 30)  score +=  7;
  else if (d.minutesOfUse < 100) score +=  2;
  else if (d.minutesOfUse > 400) score -=  3;

  score += d.ageGroup === 1 ? 2 : 0;
  score = Math.min(Math.max(Math.round(score), 0), 100);

  const riskLevel = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';

  // 2. Churn probability
  const churnProb = Math.round(1 / (1 + Math.exp(-0.08 * (score - 45))) * 100);

  // 3. Predicted churn month
  const predictedMonth = Math.round(44 - (score / 100) * 36);
  const monthLow  = Math.max(1,  predictedMonth - 2);
  const monthHigh = Math.min(47, predictedMonth + 2);

  // 4. Segment
  let segment;
  if (d.failures > 5 || d.complains)                                    segment = 'High-Risk Churner';
  else if (d.sms < 10 && d.freq < 10)                                   segment = 'Low Engagement';
  else if ((d.tariff === 'payg' || d.tariff === '1') && score >= 30)    segment = 'Pay-as-go Switcher';
  else if (d.sublength <= 6 || d.distinct < 5)                          segment = 'New Subscriber';
  else if (score < 25)                                                   segment = 'Loyal Base';
  else                                                                   segment = 'Silent Churner';

  // 5. Narrative
  const drivers = [];
  if (d.failures > 5)    drivers.push(`high call failures (${d.failures})`);
  if (d.complains)       drivers.push('an active complaint');
  if (d.charge <= 1)     drivers.push('a very low charge amount');
  if (d.sms < 20)        drivers.push(`low SMS usage (${d.sms})`);
  if (d.freq < 20)       drivers.push(`low call frequency (${d.freq})`);
  if (d.distinct < 5)    drivers.push(`very few unique contacts (${d.distinct})`);
  if (d.tariff === 'payg' || d.tariff === '1') drivers.push('a pay-as-you-go plan');

  let narrative;
  if (!drivers.length) {
    narrative = riskLevel === 'LOW'
      ? 'This customer shows a healthy usage pattern with no major churn signals detected. Ongoing monitoring is recommended.'
      : 'This customer shows some risk indicators. Consider a routine check-in to ensure satisfaction.';
  } else {
    const top   = drivers.slice(0, 3).join(', ');
    const close = riskLevel === 'HIGH'   ? 'Immediate action is recommended.'
                : riskLevel === 'MEDIUM' ? 'Proactive outreach is advised.'
                :                          'Continued monitoring is recommended.';
    narrative = `This customer has a ${riskLevel.toLowerCase()} churn risk. Key risk factors: ${top}. ${close}`;
  }

  // 6. Retention actions
  const actions = [];
  if (d.failures > 5)    actions.push('Investigate call quality issues and offer a service credit');
  if (d.complains)       actions.push('Assign a support agent to resolve the open complaint promptly');
  if (d.charge <= 1)     actions.push('Offer a plan upgrade with better value to increase engagement');
  if (d.tariff === 'payg' || d.tariff === '1') actions.push('Offer a contract plan with a promotional discount');
  if (d.sms < 20)        actions.push('Provide an SMS bundle to encourage more frequent usage');
  if (d.freq < 20)       actions.push('Send a re-engagement offer with bonus call minutes or data');
  if (d.distinct < 5)    actions.push('Schedule a proactive check-in to understand usage needs');
  if (d.custValue > 500) actions.push('Flag as high-value — consider a loyalty reward or VIP tier');
  if (riskLevel === 'HIGH' && actions.length < 2) actions.push('Schedule a retention call within 48 hours');
  if (!actions.length)   actions.push('No immediate action needed — schedule a routine check-in in 30 days');

  return {
    score,
    riskLevel,
    churnProbability: churnProb + '%',
    predictedChurnMonth: `${monthLow}–${monthHigh}`,
    segment,
    narrative,
    actions: actions.slice(0, 4)
  };
}

// ── SHOW RESULT ──────────────────────────────────────────────────
function showResult(id, r) {
  const panel = document.getElementById('result-panel');
  panel.style.display = 'block';
  document.getElementById('result-cust-id').textContent = id;

  const badge  = document.getElementById('result-badge');
  const colors = {
    HIGH:   { bg: '#fef2f2', color: '#b91c1c' },
    MEDIUM: { bg: '#fffbeb', color: '#92400e' },
    LOW:    { bg: '#f0fdf4', color: '#166534' }
  };
  const c = colors[r.riskLevel] || colors.MEDIUM;
  badge.textContent      = r.riskLevel;
  badge.style.background = c.bg;
  badge.style.color      = c.color;

  const headerBg = { HIGH: '#fef2f2', MEDIUM: '#fffbeb', LOW: '#f0fdf4' };
  document.getElementById('result-header').style.background = headerBg[r.riskLevel] || 'white';

  document.getElementById('res-prob').textContent    = r.churnProbability;
  document.getElementById('res-month').textContent   = 'Month ' + r.predictedChurnMonth;
  document.getElementById('res-segment').textContent = r.segment;
  document.getElementById('res-narrative').textContent = r.narrative;

  document.getElementById('res-actions').innerHTML = (r.actions || []).map(a =>
    `<div class="action-item"><div class="action-bullet"></div><span>${a}</span></div>`
  ).join('');

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
