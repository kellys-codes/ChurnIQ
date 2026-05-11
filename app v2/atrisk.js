// ═══════════════════════════════════════════════════════════════
// at-risk.js  —  ChurnIQ  |  At-Risk Customers page
// ═══════════════════════════════════════════════════════════════

const PAGE_SIZE = 20;
let filteredData = [];
let currentPage  = 1;
let actionedSet  = loadActionedSet();

// Called by shared.js after a new CSV is imported
function onDataLoaded(csvData) {
  renderPage(csvData);
}

document.addEventListener('DOMContentLoaded', () => {
  const data = loadCSVData();
  if (data.length > 0) {
    renderPage(data);
  } else {
    document.getElementById('atrisk-empty').style.display   = 'flex';
    document.getElementById('atrisk-content').style.display = 'none';
  }
});

function renderPage(csvData) {
  document.getElementById('atrisk-empty').style.display   = 'none';
  document.getElementById('atrisk-content').style.display = '';
  filteredData = [...csvData].sort((a, b) => b.riskScore - a.riskScore);
  currentPage  = 1;
  renderTable();
}

// ── FILTER ───────────────────────────────────────────────────────
function filterTable() {
  const csvData   = loadCSVData();
  const search    = document.getElementById('table-search').value.toLowerCase();
  const riskF     = document.getElementById('filter-risk').value;
  const churnF    = document.getElementById('filter-churn').value;
  const tariffF   = document.getElementById('filter-tariff').value;

  filteredData = csvData.filter(r => {
    if (search  && !r.id.toLowerCase().includes(search)) return false;
    if (riskF   && r.riskLevel !== riskF)                return false;
    if (churnF !== '' && r.churn !== parseInt(churnF))   return false;
    if (tariffF === 'payg'     && r.tariffPlan !== 1)    return false;
    if (tariffF === 'contract' && r.tariffPlan !== 2)    return false;
    return true;
  });

  currentPage = 1;
  renderTable();
}

// ── TABLE RENDER ─────────────────────────────────────────────────
function renderTable() {
  const tbody  = document.getElementById('at-risk-tbody');
  const barColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  const start  = (currentPage - 1) * PAGE_SIZE;
  const page   = filteredData.slice(start, start + PAGE_SIZE);

  document.getElementById('table-info').textContent = filteredData.length.toLocaleString() + ' customers';

  tbody.innerHTML = page.map(r => `
    <tr>
      <td>
        <div style="font-weight:500;font-size:13px">${r.id}</div>
        <div style="font-size:11px;color:var(--text-muted)">Age group: ${r.ageGroup}</div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="mini-bar-wrap">
            <div class="mini-bar" style="width:${r.riskScore}%;background:${barColors[r.riskLevel]}"></div>
          </div>
          <span style="font-size:12px;font-weight:600;color:${barColors[r.riskLevel]};min-width:32px">${r.riskScore}%</span>
          <span class="risk-pill ${r.riskLevel}"><span class="pill-dot"></span>${r.riskLevel.toUpperCase()}</span>
        </div>
      </td>
      <td>${r.subLength} mo</td>
      <td>${r.callFailures}</td>
      <td style="text-align:center">${r.complains
        ? '<span style="color:#ef4444;font-weight:700">✕</span>'
        : '<span style="color:#9ca3af">—</span>'}</td>
      <td>${r.tariffPlan === 1 ? 'Pay-as-you-go' : 'Contractual'}</td>
      <td>${r.status === 1
        ? '<span style="color:#3b82f6;font-weight:500">Active</span>'
        : '<span style="color:#ef4444;font-weight:500">Non-Active</span>'}</td>
      <td>${r.churn
        ? '<span style="color:#ef4444;font-weight:600">Yes</span>'
        : '<span style="color:#10b981">No</span>'}</td>
      <td>
        <button class="btn-action ${actionedSet.has(r.id) ? 'actioned' : ''}"
                onclick="openActionModal(${JSON.stringify(r).replace(/"/g,'&quot;')})">
          ${actionedSet.has(r.id) ? '✓ Done' : 'Action'}
        </button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px">No customers found</td></tr>';

  renderPagination();
}

// ── PAGINATION ───────────────────────────────────────────────────
function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>←</button>`;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  pages.forEach(p => {
    if (p === '…') html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    else html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
  });
  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>→</button>`;
  html += `<span style="margin-left:auto;font-size:12px;color:var(--text-muted)">Page ${currentPage} of ${totalPages}</span>`;
  pag.innerHTML = html;
}

function goPage(p) {
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  renderTable();
}

// ── ACTION MODAL ─────────────────────────────────────────────────
function openActionModal(r) {
  const badgeBg  = { high: '#fef2f2', medium: '#fffbeb', low: '#f0fdf4' };
  const badgeCol = { high: '#b91c1c', medium: '#92400e', low: '#166534' };

  document.getElementById('am-cust-id').textContent = r.id;
  const badge = document.getElementById('am-badge');
  badge.textContent       = r.riskLevel.toUpperCase();
  badge.style.background  = badgeBg[r.riskLevel];
  badge.style.color       = badgeCol[r.riskLevel];

  document.getElementById('am-details').innerHTML = [
    { label: 'Risk Score',     val: r.riskScore + '%' },
    { label: 'Churned',        val: r.churn ? 'Yes' : 'No' },
    { label: 'Tariff Plan',    val: r.tariffPlan === 1 ? 'Pay-as-you-go' : 'Contractual' },
    { label: 'Call Failures',  val: r.callFailures },
    { label: 'Complains',      val: r.complains ? 'Yes' : 'No' },
    { label: 'Sub. Length',    val: r.subLength + ' months' },
    { label: 'Status',         val: r.status === 1 ? 'Active' : 'Non-Active' },
  ].map(d => `
    <div class="action-detail-item">
      <div class="action-detail-label">${d.label}</div>
      <div class="action-detail-val">${d.val}</div>
    </div>`).join('');

  const recs = [];
  if (r.callFailures > 5)  recs.push({ icon:'📞', text: 'Escalate call quality issue to network team and offer service credit — #1 churn predictor' });
  if (r.complains)         recs.push({ icon:'🎧', text: 'Assign dedicated support agent and resolve open complaint within 24h' });
  if (r.chargeAmount <= 1) recs.push({ icon:'💳', text: 'Offer a plan upgrade to increase engagement and perceived value' });
  if (r.tariffPlan === 1)  recs.push({ icon:'📋', text: 'Offer a contract plan conversion with a promotional discount' });
  if (r.freqSMS < 10)      recs.push({ icon:'💬', text: 'Provide an SMS bundle to encourage more frequent usage' });
  if (r.freqUse < 20)      recs.push({ icon:'📱', text: 'Send re-engagement offer with usage-based bonus data or minutes' });
  if (r.distinctNums < 5)  recs.push({ icon:'📇', text: 'Very few distinct contacts — likely early churner. Trigger onboarding check-in call immediately' });
  if (r.custValue > 500)   recs.push({ icon:'⭐', text: 'Flag as high-value customer — offer VIP loyalty tier upgrade' });
  if (r.riskLevel === 'high') recs.push({ icon:'🚨', text: 'Schedule proactive retention call within 48 hours' });
  if (!recs.length)        recs.push({ icon:'✅', text: 'Monitor customer for 30 days — no immediate action required' });

  document.getElementById('am-actions').innerHTML = recs.map((rec, i) => `
    <label class="action-rec-item">
      <input type="checkbox" id="am-chk-${i}">
      <span>${rec.icon}&nbsp; ${rec.text}</span>
    </label>`).join('');

  document.getElementById('action-modal-overlay').dataset.custId = r.id;
  document.getElementById('action-modal-overlay').classList.add('open');
}

function closeActionModal()               { document.getElementById('action-modal-overlay').classList.remove('open'); }
function closeActionModalIfOutside(e)      { if (e.target === e.currentTarget) closeActionModal(); }

function confirmAction() {
  const custId  = document.getElementById('action-modal-overlay').dataset.custId;
  const checked = document.querySelectorAll('#am-actions input[type=checkbox]:checked').length;
  closeActionModal();
  showToast(`✓ ${checked || 'Retention'} action${checked !== 1 ? 's' : ''} logged for ${custId}`, 'success');
  actionedSet.add(custId);
  saveActionedSet(actionedSet);
  renderTable();
}
