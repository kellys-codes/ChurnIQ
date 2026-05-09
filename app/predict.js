// No special init needed for predict page, but common.js calls these
function onDataLoaded() { /* Predict page works with or without data */ }
function onNoData() { /* Predict form is always visible */ }

// ─── Run Prediction via Claude API ───
async function runPrediction() {
  const id = document.getElementById('f-id').value || 'CUST-XXXX';
  const failures = document.getElementById('f-failures').value;
  const complains = document.getElementById('f-complains').value;
  const sublength = document.getElementById('f-sublength').value;
  const charge = document.getElementById('f-charge').value;
  const seconds = document.getElementById('f-seconds').value;
  const freq = document.getElementById('f-freq').value;
  const sms = document.getElementById('f-sms').value;
  const distinct = document.getElementById('f-distinct').value;
  const value = document.getElementById('f-value').value;
  const age = document.getElementById('f-age').value;
  const tariff = document.getElementById('f-tariff').value;
  const status = document.getElementById('f-status').value;

  const btn = document.getElementById('predict-btn');
  btn.disabled = true;
  document.getElementById('btn-text').textContent = 'Analyzing...';
  document.getElementById('btn-arrow').style.display = 'none';
  document.getElementById('btn-spinner').style.display = 'block';

  // Add dataset stats context if loaded
  let dataContext = '';
  if (csvData.length > 0) {
    const churnRate = ((csvData.filter(r=>r.churn===1).length / csvData.length)*100).toFixed(1);
    const avgFailures = (csvData.reduce((s,r)=>s+r.callFailures,0)/csvData.length).toFixed(1);
    dataContext = `\n\nDataset context (${csvData.length} customers, ${churnRate}% overall churn rate, avg ${avgFailures} call failures):`;
  }

  const prompt = `You are a telecom churn analyst. Analyze this customer and predict their churn risk:
- Customer ID: ${id}
- Call Failures: ${failures || 'unknown'}
- Complains (0=no, 1=yes): ${complains || 'unknown'}
- Subscription Length (months): ${sublength || 'unknown'}
- Charge Amount (0-9 scale): ${charge || 'unknown'}
- Seconds of Use: ${seconds || 'unknown'}
- Frequency of Use (calls): ${freq || 'unknown'}
- Frequency of SMS: ${sms || 'unknown'}
- Distinct Called Numbers: ${distinct || 'unknown'}
- Customer Value ($): ${value || 'unknown'}
- Age Category (1=youngest, 5=oldest): ${age || 'unknown'}
- Tariff Plan: ${tariff || 'unknown'}
- Status: ${status || 'unknown'}
${dataContext}

Key model findings:
- Call failures are the strongest churn predictor
- Low SMS frequency (<20/mo) → 2.4× higher churn rate
- Pay-as-you-go customers churn at nearly 2× contractual rate
- Complaints are a very strong churn signal
- Inactive status strongly correlates with churn

Respond ONLY with valid JSON (no markdown):
{
  "churnProbability": "<percentage like 73%>",
  "predictedChurnMonth": "<month number or range like 28-32>",
  "riskLevel": "<HIGH, MEDIUM, or LOW>",
  "segment": "<one of: High-Risk Churner, Low Engagement, Pay-as-go Switcher, Loyal Base, New Subscriber>",
  "narrative": "<2-3 sentence analysis referencing specific inputs>",
  "actions": ["<action 1>", "<action 2>", "<action 3>"]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    showResult(id, result);
  } catch (err) {
    showToast('Analysis failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    document.getElementById('btn-text').textContent = 'Calculate Churn Risk';
    document.getElementById('btn-arrow').style.display = '';
    document.getElementById('btn-spinner').style.display = 'none';
  }
}

// ─── Show Result Panel ───
function showResult(id, r) {
  const panel = document.getElementById('result-panel');
  panel.style.display = 'block';
  document.getElementById('result-cust-id').textContent = id;

  const badge = document.getElementById('result-badge');
  badge.textContent = r.riskLevel;
  const colors = { HIGH: { bg:'#fef2f2', color:'#b91c1c' }, MEDIUM: { bg:'#fffbeb', color:'#92400e' }, LOW: { bg:'#f0fdf4', color:'#166534' } };
  const c = colors[r.riskLevel] || colors.MEDIUM;
  badge.style.background = c.bg; badge.style.color = c.color;

  const header = document.getElementById('result-header');
  const headerColors = { HIGH:'#fef2f2', MEDIUM:'#fffbeb', LOW:'#f0fdf4' };
  header.style.background = headerColors[r.riskLevel] || 'white';

  document.getElementById('res-prob').textContent = r.churnProbability;
  document.getElementById('res-month').textContent = 'Month ' + r.predictedChurnMonth;
  document.getElementById('res-segment').textContent = r.segment;
  document.getElementById('res-narrative').textContent = r.narrative;

  document.getElementById('res-actions').innerHTML = (r.actions || []).map(a =>
    `<div class="action-item"><div class="action-bullet"></div><span>${a}</span></div>`
  ).join('');

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
