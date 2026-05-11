// ═══════════════════════════════════════════════════════════════
// predict.js — ChurnIQ | Final Recalibrated XGBoost AFT Engine
// ═══════════════════════════════════════════════════════════════

let xgbModel = null;

async function loadXGBModel() {
  if (xgbModel) return xgbModel;
  try {
    const resp = await fetch('model.json'); 
    if (!resp.ok) throw new Error("Model file not found");
    xgbModel = await resp.json();
    return xgbModel;
  } catch (err) {
    console.error('XGBoost Load Error:', err);
    return null;
  }
}

// ── RECALIBRATED PREDICTION ENGINE ───────────────────────────────
async function computeChurnPrediction(d) {
  const model = await loadXGBModel();
  if (!model) throw new Error("XGBoost brain offline.");

  // 1. Feature Vector
  const features = [
    d.failures, d.complains, d.charge, d.freq, d.sms, 
    d.distinct, d.ageGroup, (d.tariff === 'contract' || d.tariff === '2') ? 2 : 1, d.minutesOfUse
  ];

  // 2. Tree Traversal
  const trees = model.learner.gradient_booster.model.trees;
  const baseScore = parseBaseScore(model);
  let logTime = baseScore;
  for (const tree of trees) {
    let nodeIdx = 0;
    while (tree.left_children[nodeIdx] !== -1) {
      nodeIdx = (features[tree.split_indices[nodeIdx]] < tree.split_conditions[nodeIdx]) 
                ? tree.left_children[nodeIdx] : tree.right_children[nodeIdx];
    }
    logTime += tree.base_weights[nodeIdx];
  }

  // 3. Math & Universal Calibration
  const sigma = parseFloat(model.learner?.learner_model_param?.aft_loss_distribution_scale || '1.0');
  
  // We check risk at Month 36 to ensure scores are always unique and visible
  const z = (Math.log(36) - logTime) / sigma;
  let risk = 0.5 * (1 + dashErf(z / Math.sqrt(2)));

  // 4. THE FIX: Risk Multipliers (Making it "Real")
  // These MUST stay inside the function to work
  if (d.failures > 0) {
    risk = risk + (d.failures * 0.03); // Adds 3% risk for every failure
  }
  if (d.complains > 0) {
    risk = risk + 0.35; // Adds 35% flat risk for complaints
  }
  if (d.minutesOfUse < 30 && d.freq < 5) {
    risk = Math.max(risk, 0.85); // Floor risk for inactive "Zombies"
  }

  // 5. Final Formatting
  const finalProb = Math.min(Math.max(risk, 0.01), 0.99);
  const medianMonth = Math.exp(logTime);

  return {
    score: Math.round(finalProb * 100),
    riskLevel: finalProb >= 0.6 ? 'HIGH' : finalProb >= 0.25 ? 'MEDIUM' : 'LOW',
    churnProbability: Math.round(finalProb * 100) + '%',
    predictedChurnMonth: finalProb > 0.8 ? '1–3' : (medianMonth > 48 ? '48+' : Math.round(medianMonth)),
    segment: getSegment(d, finalProb),
    narrative: getNarrative(d, finalProb, Math.round(medianMonth)),
    actions: getActions(d, finalProb)
  };
}

// ── UI CONTROLLER ────────────────────────────────────────────────
async function runPrediction() {
  const id = document.getElementById('f-id').value || 'CUST-NEW';
  const data = {
    failures: parseFloat(document.getElementById('f-failures').value) || 0,
    complains: parseInt(document.getElementById('f-complains').value) || 0,
    charge: parseFloat(document.getElementById('f-charge').value) || 0,
    minutesOfUse: (parseFloat(document.getElementById('f-seconds').value) || 0) / 60,
    freq: parseFloat(document.getElementById('f-freq').value) || 0,
    sms: parseFloat(document.getElementById('f-sms').value) || 0,
    distinct: parseFloat(document.getElementById('f-distinct').value) || 0,
    ageGroup: parseInt(document.getElementById('f-age').value) || 3,
    tariff: document.getElementById('f-tariff').value,
    custValue: parseFloat(document.getElementById('f-value').value) || 0
  };

  const btn = document.getElementById('predict-btn');
  btn.disabled = true;
  document.getElementById('btn-text').textContent = 'Analyzing Patterns…';

  try {
    const result = await computeChurnPrediction(data);
    showResult(id, result);
  } catch (err) {
    console.error(err);
    alert("Prediction Error: Check console (F12)");
  } finally {
    btn.disabled = false;
    document.getElementById('btn-text').textContent = 'Calculate Churn Risk';
  }
}

function parseBaseScore(model) {
  const raw = model.learner?.learner_model_param?.base_score || '0';
  return parseFloat(String(raw).replace(/[\[\]]/g, '')) || 0;
}

// ── HELPERS (AFT & UI) ───────────────────────────────────────────
function dashErf(x) {
  const p = 0.3275911, a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const sign = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a[4]*t+a[3])*t+a[2])*t+a[1])*t+a[0])*t*Math.exp(-x*x));
  return sign * y;
}

// HELPER: Traverses the XGBoost trees
function dashPredictTree(tree, features) {
  let nodeIdx = 0;
  while (tree.left_children[nodeIdx] !== -1) {
    const fIdx = tree.split_indices[nodeIdx];
    const val = tree.split_conditions[nodeIdx];
    nodeIdx = (features[fIdx] < val) ? tree.left_children[nodeIdx] : tree.right_children[nodeIdx];
  }
  return tree.base_weights[nodeIdx];
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
  
  // 1. Set the text
  badge.textContent = r.riskLevel;
  
  // 2. Remove any previous color classes to prevent "color bleeding"
  badge.classList.remove('risk-low', 'risk-medium', 'risk-high');
  header.classList.remove('bg-low', 'bg-medium', 'bg-high');
  
  // 3. Apply new color based on the riskLevel string
  const level = r.riskLevel.toLowerCase(); // 'low', 'medium', or 'high'
  badge.classList.add(`risk-${level}`);
  header.classList.add(`bg-${level}`);
  
  // Update metrics
  document.getElementById('res-prob').textContent = r.churnProbability;
  document.getElementById('res-month').textContent = 'Month ' + r.predictedChurnMonth;
  document.getElementById('res-segment').textContent = r.segment;
  document.getElementById('res-narrative').textContent = r.narrative;
  
  // Update actions
  document.getElementById('res-actions').innerHTML = r.actions.map(a => 
    `<div class="action-item"><span>${a}</span></div>`
  ).join('');
  
  panel.scrollIntoView({ behavior: 'smooth' });
}