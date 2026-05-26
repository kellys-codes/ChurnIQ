// ═══════════════════════════════════════════════════════════════
// segments.js  —  ChurnIQ  |  Customer Segments page
// ═══════════════════════════════════════════════════════════════

// Called by shared.js after a new CSV is imported
function onDataLoaded(csvData) {
  renderSegments(csvData);
}

document.addEventListener('DOMContentLoaded', () => {
  const data = loadCSVData();
  if (data.length > 0) {
    renderSegments(data);
  } else {
    document.getElementById('segments-empty').style.display = 'flex';
    document.getElementById('segments-grid').style.display  = 'none';
  }
});

// ── RENDER SEGMENTS ──────────────────────────────────────────────
function renderSegments(csvData) {
  document.getElementById('segments-empty').style.display = 'none';
  document.getElementById('segments-grid').style.display  = '';

  // ── Segment calculations ──────────────────────────────────────

  // High-Risk Churners
  const highRisk = csvData.filter(r => r.riskLevel === 'high');
  const highRiskChurnRate = highRisk.length > 0
    ? ((highRisk.filter(r => r.churn === 1).length / highRisk.length) * 100).toFixed(1) : 0;
  const highRiskRevAtRisk = highRisk.filter(r => r.churn === 0).reduce((s, r) => s + r.custValue, 0);
  const highRiskTag = parseFloat(highRiskChurnRate) >= 30
    ? '<span class="seg-tag urgent">Urgent Action Required</span>'
    : '<span class="seg-tag">Action Required</span>';

  // Low Engagement
  const lowEngage = csvData.filter(r => r.riskLevel === 'medium' && r.freqUse < 20 && !highRisk.includes(r));
  const lowEngageChurnRate = lowEngage.length > 0
    ? ((lowEngage.filter(r => r.churn === 1).length / lowEngage.length) * 100).toFixed(1) : 0;
  const lowEngageRevAtRisk = lowEngage.filter(r => r.churn === 0).reduce((s, r) => s + r.custValue, 0);

  // Pay-as-go Switchers
  const paygSwitchers = csvData.filter(r => r.tariffPlan === 1 && r.status === 1 && r.freqUse >= 20 && r.churn === 0);
  const paygUpsellOpp = paygSwitchers.reduce((s, r) => s + r.custValue, 0) * 0.15;

  // Loyal Base
  const loyal = csvData.filter(r => r.riskLevel === 'low' && r.subLength > 30 && r.status === 1 && r.churn === 0);
  const loyalChurnRate = loyal.length > 0
    ? ((csvData.filter(r => r.churn === 1 && r.subLength > 30 && r.complains === 0).length / loyal.length) * 100).toFixed(1) : 0;
  const avgLoyalValue = loyal.length > 0
    ? loyal.reduce((s, r) => s + r.custValue, 0) / loyal.length : 0;

  // New Subscribers
  const newSubs = csvData.filter(r => r.subLength <= 6);
  const newSubsEarlyChurn = newSubs.length > 0
    ? ((newSubs.filter(r => r.churn === 1).length / newSubs.length) * 100).toFixed(1) : 0;

  // Silent Churners
  const silentChurners = csvData.filter(r => r.churn === 1 && r.complains === 0);
  const allChurned = csvData.filter(r => r.churn === 1);
  const silentChurnRate = allChurned.length > 0
    ? ((silentChurners.length / allChurned.length) * 100).toFixed(1) : 0;
  const silentRevAtRisk = silentChurners.reduce((s, r) => s + r.custValue, 0);

  // ── Render cards ──────────────────────────────────────────────
  document.getElementById('segments-grid').innerHTML = `

    <div class="segment-card red">
      <div class="seg-header">
        <div>
          <div class="seg-name">High-Risk Churners</div>
          <div class="seg-count">${highRisk.length.toLocaleString()} customers</div>
        </div>
        <div class="seg-dot" style="background:#ef4444"></div>
      </div>
      <div class="seg-metrics">
        <div>
          <div class="seg-metric-label">Churn Rate</div>
          <div class="seg-metric-val red">${highRiskChurnRate}%</div>
        </div>
        <div>
          <div class="seg-metric-label">Revenue at Risk</div>
          <div class="seg-metric-val red">${formatCurrency(highRiskRevAtRisk)}</div>
        </div>
      </div>
      <div class="seg-desc">Customers with high call failures or active complaints. These customers require immediate attention before further disengagement.</div>
      ${highRiskTag}
    </div>

    <div class="segment-card" style="border-top:3px solid #8b5cf6">
      <div class="seg-header">
        <div>
          <div class="seg-name">Silent Churners</div>
          <div class="seg-count">${silentChurners.length.toLocaleString()} customers</div>
        </div>
        <div class="seg-dot" style="background:#8b5cf6"></div>
      </div>
      <div class="seg-metrics">
        <div>
          <div class="seg-metric-label">% of All Churns</div>
          <div class="seg-metric-val" style="color:#8b5cf6">${silentChurnRate}%</div>
        </div>
        <div>
          <div class="seg-metric-label">Revenue Lost</div>
          <div class="seg-metric-val" style="color:#8b5cf6">${formatCurrency(silentRevAtRisk)}</div>
        </div>
      </div>
      <div class="seg-desc">Customers who churned without ever raising a complaint. Relying on complaints alone as a warning signal can miss a significant portion of churners.</div>
      <span class="seg-tag" style="background:#f5f3ff;color:#5b21b6">Proactive Outreach</span>
    </div>

    <div class="segment-card orange">
      <div class="seg-header">
        <div>
          <div class="seg-name">Low Engagement</div>
          <div class="seg-count">${lowEngage.length.toLocaleString()} customers</div>
        </div>
        <div class="seg-dot" style="background:#f59e0b"></div>
      </div>
      <div class="seg-metrics">
        <div>
          <div class="seg-metric-label">Churn Rate</div>
          <div class="seg-metric-val orange">${lowEngageChurnRate}%</div>
        </div>
        <div>
          <div class="seg-metric-label">Revenue at Risk</div>
          <div class="seg-metric-val orange">${formatCurrency(lowEngageRevAtRisk)}</div>
        </div>
      </div>
      <div class="seg-desc">Customers with low call and SMS activity. Lower engagement is associated with a higher likelihood of churning. Re-engagement campaigns are recommended.</div>
      <span class="seg-tag">Re-engagement Campaign</span>
    </div>

    <div class="segment-card blue">
      <div class="seg-header">
        <div>
          <div class="seg-name">Pay-as-go Switchers</div>
          <div class="seg-count">${paygSwitchers.length.toLocaleString()} customers</div>
        </div>
        <div class="seg-dot" style="background:#3b82f6"></div>
      </div>
      <div class="seg-metrics">
        <div>
          <div class="seg-metric-label">Conversion Potential</div>
          <div class="seg-metric-val blue">High</div>
        </div>
        <div>
          <div class="seg-metric-label">Upsell Opportunity</div>
          <div class="seg-metric-val blue">${formatCurrency(paygUpsellOpp)}/yr</div>
        </div>
      </div>
      <div class="seg-desc">Active customers on pay-as-you-go plans. This group shows a higher tendency to churn compared to contract customers and are good candidates for plan conversion.</div>
      <span class="seg-tag">Contract Upsell</span>
    </div>

    <div class="segment-card green">
      <div class="seg-header">
        <div>
          <div class="seg-name">Loyal Base</div>
          <div class="seg-count">${loyal.length.toLocaleString()} customers</div>
        </div>
        <div class="seg-dot" style="background:#10b981"></div>
      </div>
      <div class="seg-metrics">
        <div>
          <div class="seg-metric-label">Churn Rate</div>
          <div class="seg-metric-val green">${loyalChurnRate}%</div>
        </div>
        <div>
          <div class="seg-metric-label">Avg Customer Value</div>
          <div class="seg-metric-val green">${formatCurrency(avgLoyalValue)}</div>
        </div>
      </div>
      <div class="seg-desc">Long-tenured customers with no complaints and active status. Continue nurturing this group with loyalty rewards and priority support to maintain retention.</div>
      <span class="seg-tag">Loyalty Program</span>
    </div>

    <div class="segment-card gray">
      <div class="seg-header">
        <div>
          <div class="seg-name">New Subscribers</div>
          <div class="seg-count">${newSubs.length.toLocaleString()} customers · ≤6 months</div>
        </div>
        <div class="seg-dot" style="background:#9ca3af"></div>
      </div>
      <div class="seg-metrics">
        <div>
          <div class="seg-metric-label">Early Churn Risk</div>
          <div class="seg-metric-val" style="color:#6b7280">${newSubsEarlyChurn}%</div>
        </div>
        <div>
          <div class="seg-metric-label">Monitoring Priority</div>
          <div class="seg-metric-val" style="color:#6b7280">High</div>
        </div>
      </div>
      <div class="seg-desc">Customers in the early months of their subscription. The onboarding experience during this period plays a key role in determining long-term retention.</div>
      <span class="seg-tag">Onboarding Review</span>
    </div>

  `;
}
