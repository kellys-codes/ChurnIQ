let filteredData = [];
let currentPage = 1;
const PAGE_SIZE = 20;
const actionedSet = new Set();

// Called by common.js when data is available
function onDataLoaded() {
  document.getElementById('atrisk-empty').style.display = 'none';
  document.getElementById('atrisk-content').style.display = '';
  filteredData = [...csvData].sort((a,b) => b.riskScore - a.riskScore);
  currentPage = 1;
  renderTable();
}

// Called by common.js when no stored data exists
function onNoData() {
  document.getElementById('atrisk-empty').style.display = 'flex';
  document.getElementById('atrisk-content').style.display = 'none';
}

// ─── Filter ───
function filterTable() {
  const search = document.getElementById('table-search').value.toLowerCase();
  const riskFilter = document.getElementById('filter-risk').value;
  const churnFilter = document.getElementById('filter-churn').value;
  const tariffFilter = document.getElementById('filter-tariff').value;

  filteredData = csvData.filter(r => {
    if (search && !r.id.toLowerCase().includes(search)) return false;
    if (riskFilter && r.riskLevel !== riskFilter) return false;
    if (churnFilter !== '' && r.churn !== parseInt(churnFilter)) return false;
    if (tariffFilter === 'payg' && r.tariffPlan !== 1) return false;
    if (tariffFilter === 'contract' && r.tariffPlan !== 2) return false;
    return true;
  });

  currentPage = 1;
  renderTable();
}

// ─── Table Render ───
function renderTable() {
  const tbody = document.getElementById('at-risk-tbody');
  const barColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredData.slice(start, start + PAGE_SIZE);

  document.getElementById('table-info').textContent = filteredData.length.toLocaleString() + ' customers';

  tbody.innerHTML = pageData.map(r => `
    <tr>
      <td><div style="font-weight:500;font-size:13px">${r.id}</div><div style="font-size:11px;color:var(--text-muted)">Age group: ${r.ageGroup}</div></td>
      <td>
        <span class="mini-bar-wrap"><span class="mini-bar" style="width:${r.riskScore}%;background:${barColors[r.riskLevel]}"></span></span>
        <span style="font-size:12px;margin-right:8px">${r.riskScore}%</span>
        <span class="risk-pill ${r.riskLevel}"><span class="pill-dot"></span>${r.riskLevel.toUpperCase()}</span>
      </td>
      <td>${r.subLength} mo</td>
      <td>${r.callFailures}</td>
      <td style="text-align:center">${r.complains ? '<span style="color:#ef4444;font-weight:700">✕</span>' : '<span style="color:#9ca3af">—</span>'}</td>
      <td>${r.tariffPlan === 1 ? 'Pay-as-you-go' : 'Contractual'}</td>
      <td style="font-weight:500">$${r.custValue.toFixed(2)}</td>
      <td>${r.status === 1
        ? '<span style="color:#3b82f6;font-weight:500">Active</span>'
        : '<span style="color:#ef4444;font-weight:500">Non-Active</span>'}</td>
      <td>${r.churn ? '<span style="color:#ef4444;font-weight:600">Yes</span>' : '<span style="color:#10b981">No</span>'}</td>
      <td><button class="btn-action ${actionedSet.has(r.id) ? 'actioned' : ''}" onclick="openActionModal(${JSON.stringify(r).replace(/"/g,'&quot;')})">${actionedSet.has(r.id) ? '✓ Done' : 'Action'}</button></td>
    </tr>
  `).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:30px">No customers found</td></tr>';

  renderPagination();
}

// ─── Pagination ───
function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>←</button>`;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) pages.push(i);
    else if (pages[pages.length-1] !== '...') pages.push('...');
  }
  pages.forEach(p => {
    if (p === '...') html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    else html += `<button class="page-btn ${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
  });
  html += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>→</button>`;
  html += `<span style="margin-left:auto;font-size:12px;color:var(--text-muted)">Page ${currentPage} of ${totalPages}</span>`;
  pag.innerHTML = html;
}

function goPage(p) {
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  renderTable();
}

// ─── Action Modal ───
function openActionModal(r) {
  const barColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  const badgeBg   = { high: '#fef2f2', medium: '#fffbeb', low: '#f0fdf4' };
  const badgeCol  = { high: '#b91c1c', medium: '#92400e', low: '#166534' };

  document.getElementById('am-cust-id').textContent = r.id;
  const badge = document.getElementById('am-badge');
  badge.textContent = r.riskLevel.toUpperCase();
  badge.style.background = badgeBg[r.riskLevel];
  badge.style.color = badgeCol[r.riskLevel];

  document.getElementById('am-details').innerHTML = [
    { label: 'Risk Score',       val: r.riskScore + '%' },
    { label: 'Churned',          val: r.churn ? 'Yes' : 'No' },
    { label: 'Tariff Plan',      val: r.tariffPlan === 1 ? 'Pay-as-you-go' : 'Contractual' },
    { label: 'Customer Value',   val: '$' + r.custValue.toFixed(2) },
    { label: 'Call Failures',    val: r.callFailures },
    { label: 'Complains',        val: r.complains ? 'Yes' : 'No' },
    { label: 'Sub. Length',      val: r.subLength + ' months' },
    { label: 'Status',           val: r.status === 1 ? 'Active' : 'Non-Active' },
  ].map(d => `
    <div class="action-detail-item">
      <div class="action-detail-label">${d.label}</div>
      <div class="action-detail-val">${d.val}</div>
    </div>
  `).join('');

  const recs = [];
  if (r.callFailures > 5)  recs.push({ icon:'📞', text: 'Escalate call quality issue to network team and offer service credit' });
  if (r.complains)         recs.push({ icon:'🎧', text: 'Assign dedicated support agent and resolve open complaint within 24h' });
  if (r.tariffPlan === 1)  recs.push({ icon:'📋', text: 'Offer contract plan conversion with 10% introductory discount' });
  if (r.status === 2)      recs.push({ icon:'🔔', text: 'Send re-activation campaign with personalised incentive offer' });
  if (r.freqSMS < 10)     recs.push({ icon:'💬', text: 'Enrol in SMS engagement program — offer 50 free texts/month for 3 months' });
  if (r.freqUse < 20)     recs.push({ icon:'📱', text: 'Send re-engagement offer with usage-based bonus data or minutes' });
  if (r.custValue > 500)  recs.push({ icon:'⭐', text: 'Flag as high-value customer — offer VIP loyalty tier upgrade' });
  if (r.riskLevel === 'high') recs.push({ icon:'🚨', text: 'Schedule proactive retention call within 48 hours' });
  if (!recs.length)        recs.push({ icon:'✅', text: 'Monitor customer for 30 days — no immediate action required' });

  document.getElementById('am-actions').innerHTML = recs.map((rec, i) => `
    <label class="action-rec-item">
      <input type="checkbox" id="am-chk-${i}">
      <span>${rec.icon}&nbsp; ${rec.text}</span>
    </label>
  `).join('');

  document.getElementById('action-modal-overlay').dataset.custId = r.id;
  document.getElementById('action-modal-overlay').classList.add('open');
}

function closeActionModal() {
  document.getElementById('action-modal-overlay').classList.remove('open');
}
function closeActionModalIfOutside(e) {
  if (e.target === e.currentTarget) closeActionModal();
}

function confirmAction() {
  const custId = document.getElementById('action-modal-overlay').dataset.custId;
  const checked = document.querySelectorAll('#am-actions input[type=checkbox]:checked').length;
  closeActionModal();
  showToast(`✓ ${checked || 'Retention'} action${checked !== 1 ? 's' : ''} logged for ${custId}`, 'success');
  actionedSet.add(custId);
  renderTable();
}
