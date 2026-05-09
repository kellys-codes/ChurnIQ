// Called by common.js when data is available
function onDataLoaded() {
  document.getElementById('segments-empty').style.display = 'none';
  document.getElementById('segments-grid').style.display = '';
  updateSegments();
}

// Called by common.js when no stored data exists
function onNoData() {
  document.getElementById('segments-empty').style.display = 'flex';
  document.getElementById('segments-grid').style.display = 'none';
}

function updateSegments() {
  const total = csvData.length;

  // High-Risk Churners
  const highRisk = csvData.filter(r => (r.callFailures > 5 || r.complains === 1) && (r.churn === 1 || r.status === 2));
  const highRiskChurnRate = highRisk.length > 0 ? ((highRisk.filter(r => r.churn===1).length / highRisk.length)*100).toFixed(1) : 0;
  const highRiskRevAtRisk = highRisk.filter(r=>r.churn===1).reduce((s,r)=>s+r.custValue,0);

  // Low Engagement
  const lowEngage = csvData.filter(r => r.freqUse < 20 && r.freqSMS < 10 && !highRisk.includes(r));
  const lowEngageChurnRate = lowEngage.length > 0 ? ((lowEngage.filter(r=>r.churn===1).length/lowEngage.length)*100).toFixed(1) : 0;
  const lowEngageRevAtRisk = lowEngage.filter(r=>r.churn===1).reduce((s,r)=>s+r.custValue,0);

  // Pay-as-go Switchers
  const paygSwitchers = csvData.filter(r => r.tariffPlan === 1 && r.status === 1 && r.freqUse >= 20 && r.churn === 0);
  const paygUpsellOpp = paygSwitchers.reduce((s,r)=>s+r.custValue,0) * 0.15;

  // Loyal Base
  const loyal = csvData.filter(r => r.subLength > 30 && r.status === 1 && r.complains === 0 && r.churn === 0);
  const loyalChurnRate = loyal.length > 0 ? ((csvData.filter(r=>r.churn===1&&r.subLength>30&&r.complains===0).length / loyal.length)*100).toFixed(1) : 0;
  const avgLoyalValue = loyal.length > 0 ? loyal.reduce((s,r)=>s+r.custValue,0)/loyal.length : 0;

  // New Subscribers
  const newSubs = csvData.filter(r => r.subLength <= 6);
  const newSubsEarlyChurn = newSubs.length > 0 ? ((newSubs.filter(r=>r.churn===1).length/newSubs.length)*100).toFixed(1) : 0;

  document.getElementById('segments-grid').innerHTML = `
    <div class="segment-card red">
      <div class="seg-header"><div><div class="seg-name">High-Risk Churners</div><div class="seg-count">${highRisk.length.toLocaleString()} customers</div></div><div class="seg-dot" style="background:#ef4444"></div></div>
      <div class="seg-metrics">
        <div><div class="seg-metric-label">Churn Rate</div><div class="seg-metric-val red">${highRiskChurnRate}%</div></div>
        <div><div class="seg-metric-label">Revenue at Risk</div><div class="seg-metric-val red">${formatCurrency(highRiskRevAtRisk)}</div></div>
      </div>
      <div class="seg-desc">High call failures or active complaints. Need immediate intervention before further revenue loss.</div>
      <span class="seg-tag urgent">Urgent Action Required</span>
    </div>

    <div class="segment-card orange">
      <div class="seg-header"><div><div class="seg-name">Low Engagement</div><div class="seg-count">${lowEngage.length.toLocaleString()} customers</div></div><div class="seg-dot" style="background:#f59e0b"></div></div>
      <div class="seg-metrics">
        <div><div class="seg-metric-label">Churn Rate</div><div class="seg-metric-val orange">${lowEngageChurnRate}%</div></div>
        <div><div class="seg-metric-label">Revenue at Risk</div><div class="seg-metric-val orange">${formatCurrency(lowEngageRevAtRisk)}</div></div>
      </div>
      <div class="seg-desc">Low call and SMS frequency. Risk of silent churn. Re-engagement campaigns recommended.</div>
      <span class="seg-tag">Re-engagement Campaign</span>
    </div>

    <div class="segment-card blue">
      <div class="seg-header"><div><div class="seg-name">Pay-as-go Switchers</div><div class="seg-count">${paygSwitchers.length.toLocaleString()} customers</div></div><div class="seg-dot" style="background:#3b82f6"></div></div>
      <div class="seg-metrics">
        <div><div class="seg-metric-label">Conversion Potential</div><div class="seg-metric-val blue">High</div></div>
        <div><div class="seg-metric-label">Upsell Opportunity</div><div class="seg-metric-val blue">${formatCurrency(paygUpsellOpp)}/yr</div></div>
      </div>
      <div class="seg-desc">Active users on PAYG plans. Ideal candidates for contract conversion offers to reduce churn risk.</div>
      <span class="seg-tag">Contract Upsell</span>
    </div>

    <div class="segment-card green">
      <div class="seg-header"><div><div class="seg-name">Loyal Base</div><div class="seg-count">${loyal.length.toLocaleString()} customers</div></div><div class="seg-dot" style="background:#10b981"></div></div>
      <div class="seg-metrics">
        <div><div class="seg-metric-label">Churn Rate</div><div class="seg-metric-val green">${loyalChurnRate}%</div></div>
        <div><div class="seg-metric-label">Avg Customer Value</div><div class="seg-metric-val green">${formatCurrency(avgLoyalValue)}</div></div>
      </div>
      <div class="seg-desc">Long subscription, no complaints, active status. Protect with loyalty rewards and priority support.</div>
      <span class="seg-tag">Loyalty Program</span>
    </div>

    <div class="segment-card gray">
      <div class="seg-header"><div><div class="seg-name">New Subscribers</div><div class="seg-count">${newSubs.length.toLocaleString()} customers · ≤6 months</div></div><div class="seg-dot" style="background:#9ca3af"></div></div>
      <div class="seg-metrics">
        <div><div class="seg-metric-label">Early Churn Risk</div><div class="seg-metric-val" style="color:#6b7280">${newSubsEarlyChurn}%</div></div>
        <div><div class="seg-metric-label">Monitoring Priority</div><div class="seg-metric-val" style="color:#6b7280">Medium</div></div>
      </div>
      <div class="seg-desc">First 90 days are critical. Onboarding quality determines long-term retention probability.</div>
      <span class="seg-tag">Onboarding Review</span>
    </div>
  `;
}
