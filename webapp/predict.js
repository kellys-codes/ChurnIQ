// prediction using backend API
async function computeChurnPrediction(d) {
  const tariffPlan = (d.tariff === 'contract' || d.tariff === '2') ? 2 : 1;

  const resp = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      features: {
        call_failure: d.failures,
        complains: d.complains,
        charge_amount: d.charge,
        frequency_of_use: d.freq,
        frequency_of_sms: d.sms,
        distinct_called_numbers: d.distinct,
        age_group: d.ageGroup,
        tariff_plan: tariffPlan,
        minutes_of_use: d.minutesOfUse
      }
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `API error ${resp.status}`);
  }

  const { prediction: score } = await resp.json();
  const finalProb = score / 100;

  return {
    score,
    riskLevel: finalProb >= 0.6 ? 'HIGH' : finalProb >= 0.25 ? 'MEDIUM' : 'LOW',
    churnProbability: score + '%',
    predictedChurnMonth: finalProb > 0.8 ? '1–3' : '12+',
    segment: getSegment(d, finalProb),
    narrative: getNarrative(d, finalProb, finalProb > 0.8 ? 3 : 24),
    actions: getActions(d, finalProb)
  };
}

// ui control
async function runPrediction() {
  const id = 'PREDICTED CUST';
  const data = {
    failures: parseFloat(document.getElementById('f-failures').value) || 0,
    complains: parseInt(document.getElementById('f-complains').value) || 0,
    charge: parseFloat(document.getElementById('f-charge').value) || 0,
    minutesOfUse: (parseFloat(document.getElementById('f-minutes').value) || 0),
    freq: parseFloat(document.getElementById('f-freq').value) || 0,
    sms: parseFloat(document.getElementById('f-sms').value) || 0,
    distinct: parseFloat(document.getElementById('f-distinct').value) || 0,
    ageGroup: parseInt(document.getElementById('f-age').value) || 3,
    tariff: document.getElementById('f-tariff').value
  };

  const btn = document.getElementById('predict-btn');
  btn.disabled = true;
  document.getElementById('btn-text').textContent = 'Analyzing Patterns…';

  try {
    const result = await computeChurnPrediction(data);
    showResult(id, result);
  } catch (err) {
    console.error(err);
    alert("Prediction Error: " + err.message);
  } finally {
    btn.disabled = false;
    document.getElementById('btn-text').textContent = 'Calculate Churn Risk';
  }
}

function getSegment(d, prob) {
  if (prob > 0.9) return 'Inactive / Zombie';
  if (d.complains) return 'High-Risk Churner';
  if (prob < 0.2) return 'Loyal Base';
  return 'Standard User';
}

function getNarrative(d, risk, month) {
  if (risk === 'HIGH') return `Critical churn risk detected. The AFT model expects potential churn within ${month} months due to recent usage friction or inactivity.`;
  return `This customer shows a stable profile. Predicted tenure extends beyond the primary risk window.`;
}

function getActions(d, risk) {
  const acts = [];
  if (risk === 'HIGH') acts.push("Immediate re-engagement call required.");
  if (d.complains) acts.push("Escalate open complaint to senior support.");
  if (d.failures > 10) acts.push("Verify technical infrastructure in customer's region.");
  if (acts.length === 0) acts.push("Maintain standard monthly monitoring.");
  return acts.slice(0, 3);
}

function showResult(id, r) {
  const panel = document.getElementById('result-panel');
  const badge = document.getElementById('result-badge');
  const header = document.getElementById('result-header');

  panel.style.display = 'block';
  document.getElementById('result-cust-id').textContent = id;

  // set text
  badge.textContent = r.riskLevel;

  // remove any previous color classes to prevent "color bleeding"
  badge.classList.remove('risk-low', 'risk-medium', 'risk-high');
  header.classList.remove('bg-low', 'bg-medium', 'bg-high');

  // apply new color based on the riskLevel string
  const level = r.riskLevel.toLowerCase(); // 'low', 'medium', or 'high'
  badge.classList.add(`risk-${level}`);
  header.classList.add(`bg-${level}`);

  // update metrics
  document.getElementById('res-prob').textContent = r.churnProbability;
  document.getElementById('res-month').textContent = 'Month ' + r.predictedChurnMonth;
  document.getElementById('res-segment').textContent = r.segment;
  document.getElementById('res-narrative').textContent = r.narrative;

  // update actions
  document.getElementById('res-actions').innerHTML = r.actions.map(a =>
    `<div class="action-item"><span>${a}</span></div>`
  ).join('');

  panel.scrollIntoView({ behavior: 'smooth' });
}