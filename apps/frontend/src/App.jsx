import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './api';

const initialForm = {
  name: '',
  accountUserId: '',
  driverIds: '',
  officeNames: '',
  workOffice: '',
  position: '',
  invoiceNumber: '',
  vehicleOwnership: '',
  cargoInsuranceStatus: ''
};
const initialPayrollEntryForm = {
  id: '',
  driverId: '',
  month: '',
  content: '',
  unitPrice: 0,
  quantity: 0,
  total: 0,
  status: 'pending'
};

const parseCsvText = (value) => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

export function App() {
  const [health, setHealth] = useState('...');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [createForm, setCreateForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [payrollEntries, setPayrollEntries] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState({
    count: 0,
    total_amount: 0,
    pending_count: 0,
    needs_change_count: 0
  });
  const [payrollMonth, setPayrollMonth] = useState('');
  const [payrollDriverId, setPayrollDriverId] = useState('all');
  const [payrollStatus, setPayrollStatus] = useState('all');
  const [payrollQuery, setPayrollQuery] = useState('');
  const [payrollPage, setPayrollPage] = useState(1);
  const [payrollLimit] = useState(20);
  const [payrollTotal, setPayrollTotal] = useState(0);
  const [detailImportInfo, setDetailImportInfo] = useState('');
  const [salesImportInfo, setSalesImportInfo] = useState('');
  const [deductionItems, setDeductionItems] = useState([]);
  const [taxSettings, setTaxSettings] = useState({ mode: 'none', rate: 10 });
  const [deductionMessage, setDeductionMessage] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit] = useState(20);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditAction, setAuditAction] = useState('');
  const [auditTargetType, setAuditTargetType] = useState('');
  const [auditQuery, setAuditQuery] = useState('');
  const [payrollEntryForm, setPayrollEntryForm] = useState(initialPayrollEntryForm);
  const [editingPayrollId, setEditingPayrollId] = useState('');

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const payrollPages = useMemo(
    () => Math.max(1, Math.ceil(payrollTotal / payrollLimit)),
    [payrollTotal, payrollLimit]
  );
  const auditPages = useMemo(
    () => Math.max(1, Math.ceil(auditTotal / auditLimit)),
    [auditTotal, auditLimit]
  );

  const fetchHealth = useCallback(async () => {
    try {
      const response = await apiGet('/health');
      setHealth(response?.data?.status || 'up');
    } catch {
      setHealth('down');
    }
  }, []);

  const loadMembers = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        status,
        page: String(nextPage),
        limit: String(limit)
      });
      if (query.trim()) params.set('q', query.trim());
      const response = await apiGet(`/api/v1/members?${params.toString()}`);
      setMembers(response?.data?.items || []);
      setTotal(Number(response?.data?.total || 0));
      setPage(nextPage);
    } catch (e) {
      setError(e.message || 'メンバー取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [limit, page, query, status]);

  const loadPayroll = useCallback(async (nextPage = payrollPage) => {
    setLoading(true);
    setError('');
    try {
      const entriesParams = new URLSearchParams({
        page: String(nextPage),
        limit: String(payrollLimit),
        status: payrollStatus || 'all'
      });
      if (payrollMonth.trim()) entriesParams.set('month', payrollMonth.trim());
      if (payrollDriverId && payrollDriverId !== 'all') entriesParams.set('driverId', payrollDriverId);
      if (payrollQuery.trim()) entriesParams.set('q', payrollQuery.trim());

      const summaryParams = new URLSearchParams();
      if (payrollMonth.trim()) summaryParams.set('month', payrollMonth.trim());
      if (payrollDriverId && payrollDriverId !== 'all') summaryParams.set('driverId', payrollDriverId);

      const [entriesResponse, summaryResponse] = await Promise.all([
        apiGet(`/api/v1/payroll/entries?${entriesParams.toString()}`),
        apiGet(`/api/v1/payroll/summary?${summaryParams.toString()}`)
      ]);

      setPayrollEntries(entriesResponse?.data?.items || []);
      setPayrollTotal(Number(entriesResponse?.data?.total || 0));
      setPayrollPage(nextPage);
      setPayrollSummary(summaryResponse?.data || {
        count: 0,
        total_amount: 0,
        pending_count: 0,
        needs_change_count: 0
      });
    } catch (e) {
      setError(e.message || '明細取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [payrollDriverId, payrollLimit, payrollMonth, payrollPage, payrollQuery, payrollStatus]);

  const loadDeductions = useCallback(async () => {
    if (!payrollMonth.trim() || payrollDriverId === 'all') {
      setDeductionItems([]);
      setTaxSettings({ mode: 'none', rate: 10 });
      return;
    }
    try {
      const params = new URLSearchParams({
        driverId: payrollDriverId,
        month: payrollMonth.trim(),
        statementId: 'default'
      });
      const response = await apiGet(`/api/v1/payroll/deductions?${params.toString()}`);
      const nextItems = Array.isArray(response?.data?.items) ? response.data.items : [];
      setDeductionItems(nextItems.map((item, idx) => ({
        id: item?.id || `row-${idx + 1}`,
        label: String(item?.label || ''),
        amount: Number(item?.amount || 0)
      })));
      const nextTax = response?.data?.tax_settings && typeof response.data.tax_settings === 'object'
        ? response.data.tax_settings
        : { mode: 'none', rate: 10 };
      setTaxSettings({
        mode: String(nextTax.mode || 'none'),
        rate: Number(nextTax.rate || 10)
      });
    } catch (e) {
      setError(e.message || '天引き取得に失敗しました。');
    }
  }, [payrollDriverId, payrollMonth]);

  const loadAuditLogs = useCallback(async (nextPage = auditPage) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(auditLimit)
      });
      if (auditAction.trim()) params.set('action', auditAction.trim());
      if (auditTargetType.trim()) params.set('targetType', auditTargetType.trim());
      if (auditQuery.trim()) params.set('q', auditQuery.trim());
      const response = await apiGet(`/api/v1/audit-logs?${params.toString()}`);
      setAuditLogs(response?.data?.items || []);
      setAuditTotal(Number(response?.data?.total || 0));
      setAuditPage(nextPage);
    } catch (e) {
      setError(e.message || '操作ログ取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [auditAction, auditLimit, auditPage, auditQuery, auditTargetType]);

  useEffect(() => {
    fetchHealth();
    loadPayroll(1);
    loadAuditLogs(1);
  }, [fetchHealth]);

  useEffect(() => {
    loadMembers(1);
  }, [status, loadMembers]);

  useEffect(() => {
    loadDeductions();
  }, [loadDeductions]);

  useEffect(() => {
    if (editingPayrollId) return;
    setPayrollEntryForm((prev) => ({
      ...prev,
      driverId: payrollDriverId !== 'all' ? payrollDriverId : prev.driverId,
      month: payrollMonth || prev.month
    }));
  }, [editingPayrollId, payrollDriverId, payrollMonth]);

  const toPayload = (form) => ({
    name: form.name.trim(),
    accountUserId: form.accountUserId.trim(),
    driverIds: parseCsvText(form.driverIds),
    officeNames: parseCsvText(form.officeNames),
    workOffice: form.workOffice.trim(),
    position: form.position.trim(),
    invoiceNumber: form.invoiceNumber.trim(),
    vehicleOwnership: form.vehicleOwnership.trim(),
    cargoInsuranceStatus: form.cargoInsuranceStatus.trim()
  });

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await apiPost('/api/v1/members', toPayload(createForm));
      setCreateForm(initialForm);
      await loadMembers(1);
    } catch (e) {
      setError(e.message || '作成に失敗しました。');
    }
  };

  const startEdit = (member) => {
    setEditingId(member.id);
    setEditForm({
      name: member.name || '',
      accountUserId: member.account_user_id || '',
      driverIds: Array.isArray(member.driver_ids) ? member.driver_ids.join(',') : '',
      officeNames: Array.isArray(member.office_names) ? member.office_names.join(',') : '',
      workOffice: member.work_office || '',
      position: member.position || '',
      invoiceNumber: member.invoice_number || '',
      vehicleOwnership: member.vehicle_ownership || '',
      cargoInsuranceStatus: member.cargo_insurance_status || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setError('');
    try {
      await apiPatch(`/api/v1/members/${editingId}`, toPayload(editForm));
      setEditingId(null);
      await loadMembers(page);
    } catch (e) {
      setError(e.message || '更新に失敗しました。');
    }
  };

  const toggleActive = async (member) => {
    setError('');
    try {
      if (member.active) {
        await apiPost(`/api/v1/members/${member.id}/deactivate`, { reason: '管理画面から変更' });
      } else {
        await apiPost(`/api/v1/members/${member.id}/activate`, {});
      }
      await loadMembers(page);
    } catch (e) {
      setError(e.message || '状態変更に失敗しました。');
    }
  };

  const importDetailCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      const normalized = rows
        .map((row) => normalizeDetailRow(row))
        .filter(Boolean);
      if (normalized.length === 0) {
        throw new Error('個人明細CSVの有効行がありません。');
      }
      const response = await apiPost('/api/v1/payroll/import/details', {
        rows: normalized,
        replaceCsvForMonths: true
      });
      const importedCount = Number(response?.data?.importedCount || normalized.length);
      setDetailImportInfo(`${file.name} / ${importedCount}件`);
      await loadPayroll(1);
    } catch (e) {
      setError(e.message || '個人明細CSV取り込みに失敗しました。');
    } finally {
      event.target.value = '';
    }
  };

  const importSalesCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      const normalized = rows
        .map((row) => normalizeSalesRow(row))
        .filter(Boolean);
      if (normalized.length === 0) {
        throw new Error('売上合計CSVの有効行がありません。');
      }
      const response = await apiPost('/api/v1/payroll/import/sales-summary', { rows: normalized });
      const importedCount = Number(response?.data?.importedCount || normalized.length);
      setSalesImportInfo(`${file.name} / ${importedCount}件`);
      await loadPayroll(1);
    } catch (e) {
      setError(e.message || '売上合計CSV取り込みに失敗しました。');
    } finally {
      event.target.value = '';
    }
  };

  const addDeductionRow = () => {
    setDeductionItems((prev) => ([
      ...prev,
      { id: `manual-${Date.now()}`, label: '', amount: 0 }
    ]));
  };

  const saveDeductions = async () => {
    if (!payrollMonth.trim() || payrollDriverId === 'all') {
      setError('天引き保存には対象月とドライバー選択が必要です。');
      return;
    }
    setError('');
    setDeductionMessage('');
    try {
      const payloadItems = deductionItems
        .map((item) => ({
          id: item.id,
          label: String(item.label || '').trim(),
          amount: Number(item.amount || 0)
        }))
        .filter((item) => item.label || item.amount);
      await apiPut('/api/v1/payroll/deductions', {
        driverId: payrollDriverId,
        month: payrollMonth.trim(),
        statementId: 'default',
        items: payloadItems,
        taxSettings: {
          mode: taxSettings.mode || 'none',
          rate: Number(taxSettings.rate || 10)
        }
      });
      setDeductionMessage('天引きを保存しました。');
      await loadPayroll(1);
    } catch (e) {
      setError(e.message || '天引き保存に失敗しました。');
    }
  };

  const startEditPayrollEntry = (entry) => {
    setEditingPayrollId(entry.id);
    setPayrollEntryForm({
      id: entry.id,
      driverId: entry.driver_id || '',
      month: entry.month || '',
      content: entry.content || '',
      unitPrice: Number(entry.unit_price || 0),
      quantity: Number(entry.quantity || 0),
      total: Number(entry.total || 0),
      status: entry.status || 'pending'
    });
  };

  const resetPayrollEntryForm = () => {
    setEditingPayrollId('');
    setPayrollEntryForm({
      ...initialPayrollEntryForm,
      driverId: payrollDriverId !== 'all' ? payrollDriverId : '',
      month: payrollMonth || ''
    });
  };

  const savePayrollEntry = async () => {
    if (!payrollEntryForm.driverId || !payrollEntryForm.month || !payrollEntryForm.content.trim()) {
      setError('明細の保存には driverId / month / content が必要です。');
      return;
    }
    setError('');
    try {
      const payload = {
        driverId: payrollEntryForm.driverId,
        month: payrollEntryForm.month,
        content: payrollEntryForm.content.trim(),
        unitPrice: Number(payrollEntryForm.unitPrice || 0),
        quantity: Number(payrollEntryForm.quantity || 0),
        total: Number(payrollEntryForm.total || 0),
        status: payrollEntryForm.status || 'pending'
      };
      if (editingPayrollId) {
        await apiPatch(`/api/v1/payroll/entries/${editingPayrollId}`, payload);
      } else {
        await apiPost('/api/v1/payroll/entries', payload);
      }
      resetPayrollEntryForm();
      await loadPayroll(1);
    } catch (e) {
      setError(e.message || '明細保存に失敗しました。');
    }
  };

  const deletePayrollEntry = async (id) => {
    if (!window.confirm('この明細を削除します。よろしいですか？')) return;
    setError('');
    try {
      await apiDelete(`/api/v1/payroll/entries/${id}`);
      await loadPayroll(1);
    } catch (e) {
      setError(e.message || '明細削除に失敗しました。');
    }
  };

  return (
    <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif', maxWidth: 1280, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>hakobin-re / ドライバー管理</h1>
      <p style={{ marginTop: 0 }}>backend health: <strong>{health}</strong></p>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 36 }}>
            <option value="all">全状態</option>
            <option value="active">アクティブ</option>
            <option value="inactive">ノンアクティブ</option>
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前 / accountUserId"
            style={{ height: 34, minWidth: 280, padding: '0 8px' }}
          />
          <button type="button" onClick={() => loadMembers(1)} disabled={loading}>
            {loading ? '読み込み中...' : '検索'}
          </button>
          <span>表示: {members.length} / 総件数: {total}</span>
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>ドライバー追加</h3>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <input required placeholder="名前" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
          <input placeholder="accountUserId" value={createForm.accountUserId} onChange={(e) => setCreateForm((p) => ({ ...p, accountUserId: e.target.value }))} />
          <input placeholder="driverIds(,区切り)" value={createForm.driverIds} onChange={(e) => setCreateForm((p) => ({ ...p, driverIds: e.target.value }))} />
          <input placeholder="officeNames(,区切り)" value={createForm.officeNames} onChange={(e) => setCreateForm((p) => ({ ...p, officeNames: e.target.value }))} />
          <input placeholder="workOffice" value={createForm.workOffice} onChange={(e) => setCreateForm((p) => ({ ...p, workOffice: e.target.value }))} />
          <input placeholder="position" value={createForm.position} onChange={(e) => setCreateForm((p) => ({ ...p, position: e.target.value }))} />
          <input placeholder="invoiceNumber (T+13桁)" value={createForm.invoiceNumber} onChange={(e) => setCreateForm((p) => ({ ...p, invoiceNumber: e.target.value }))} />
          <select value={createForm.vehicleOwnership} onChange={(e) => setCreateForm((p) => ({ ...p, vehicleOwnership: e.target.value }))}>
            <option value="">車両保有</option>
            <option value="owned">自己所有</option>
            <option value="lease">リース</option>
          </select>
          <select value={createForm.cargoInsuranceStatus} onChange={(e) => setCreateForm((p) => ({ ...p, cargoInsuranceStatus: e.target.value }))}>
            <option value="">貨物保険</option>
            <option value="joined">加入</option>
            <option value="not_joined">未加入</option>
          </select>
          <div>
            <button type="submit">追加</button>
          </div>
        </form>
      </section>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      <section style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f6f6f6' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>ID</th>
              <th style={{ textAlign: 'left', padding: 8 }}>名前</th>
              <th style={{ textAlign: 'left', padding: 8 }}>accountUserId</th>
              <th style={{ textAlign: 'left', padding: 8 }}>営業所</th>
              <th style={{ textAlign: 'left', padding: 8 }}>インボイス</th>
              <th style={{ textAlign: 'left', padding: 8 }}>状態</th>
              <th style={{ textAlign: 'left', padding: 8 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{member.id}</td>
                <td style={{ padding: 8 }}>{member.name}</td>
                <td style={{ padding: 8 }}>{member.account_user_id || '-'}</td>
                <td style={{ padding: 8 }}>{Array.isArray(member.office_names) ? member.office_names.join(', ') : '-'}</td>
                <td style={{ padding: 8 }}>{isValidInvoiceNumber(member.invoice_number) ? member.invoice_number : '-'}</td>
                <td style={{ padding: 8 }}>{member.active ? 'アクティブ' : 'ノンアクティブ'}</td>
                <td style={{ padding: 8, display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => startEdit(member)}>編集</button>
                  <button type="button" onClick={() => toggleActive(member)}>
                    {member.active ? 'ノンアクティブ化' : 'アクティブ化'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <button type="button" disabled={page <= 1} onClick={() => loadMembers(page - 1)}>前へ</button>
        <span>{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => loadMembers(page + 1)}>次へ</button>
      </div>

      {editingId ? (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>ドライバー編集: {editingId}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <input placeholder="名前" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            <input placeholder="accountUserId" value={editForm.accountUserId} onChange={(e) => setEditForm((p) => ({ ...p, accountUserId: e.target.value }))} />
            <input placeholder="driverIds(,区切り)" value={editForm.driverIds} onChange={(e) => setEditForm((p) => ({ ...p, driverIds: e.target.value }))} />
            <input placeholder="officeNames(,区切り)" value={editForm.officeNames} onChange={(e) => setEditForm((p) => ({ ...p, officeNames: e.target.value }))} />
            <input placeholder="workOffice" value={editForm.workOffice} onChange={(e) => setEditForm((p) => ({ ...p, workOffice: e.target.value }))} />
            <input placeholder="position" value={editForm.position} onChange={(e) => setEditForm((p) => ({ ...p, position: e.target.value }))} />
            <input placeholder="invoiceNumber (T+13桁)" value={editForm.invoiceNumber} onChange={(e) => setEditForm((p) => ({ ...p, invoiceNumber: e.target.value }))} />
            <select value={editForm.vehicleOwnership} onChange={(e) => setEditForm((p) => ({ ...p, vehicleOwnership: e.target.value }))}>
              <option value="">車両保有</option>
              <option value="owned">自己所有</option>
              <option value="lease">リース</option>
            </select>
            <select value={editForm.cargoInsuranceStatus} onChange={(e) => setEditForm((p) => ({ ...p, cargoInsuranceStatus: e.target.value }))}>
              <option value="">貨物保険</option>
              <option value="joined">加入</option>
              <option value="not_joined">未加入</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={handleSaveEdit}>保存</button>
            <button type="button" onClick={() => setEditingId(null)}>キャンセル</button>
          </div>
        </section>
      ) : null}

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>明細管理（payroll）</h2>
        <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>{editingPayrollId ? `明細編集: ${editingPayrollId}` : '明細追加'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 140px 1fr 110px 110px 120px 140px', gap: 8 }}>
            <input
              placeholder="driverId"
              value={payrollEntryForm.driverId}
              onChange={(e) => setPayrollEntryForm((prev) => ({ ...prev, driverId: e.target.value }))}
            />
            <input
              placeholder="YYYY-MM"
              value={payrollEntryForm.month}
              onChange={(e) => setPayrollEntryForm((prev) => ({ ...prev, month: e.target.value }))}
            />
            <input
              placeholder="内容"
              value={payrollEntryForm.content}
              onChange={(e) => setPayrollEntryForm((prev) => ({ ...prev, content: e.target.value }))}
            />
            <input
              type="number"
              placeholder="単価"
              value={payrollEntryForm.unitPrice}
              onChange={(e) => setPayrollEntryForm((prev) => ({ ...prev, unitPrice: Number(e.target.value || 0) }))}
            />
            <input
              type="number"
              placeholder="件数"
              value={payrollEntryForm.quantity}
              onChange={(e) => setPayrollEntryForm((prev) => ({ ...prev, quantity: Number(e.target.value || 0) }))}
            />
            <input
              type="number"
              placeholder="合計"
              value={payrollEntryForm.total}
              onChange={(e) => setPayrollEntryForm((prev) => ({ ...prev, total: Number(e.target.value || 0) }))}
            />
            <select
              value={payrollEntryForm.status}
              onChange={(e) => setPayrollEntryForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="pending">未承認</option>
              <option value="needs_change">差し戻し</option>
              <option value="driver_approved">承認済み</option>
              <option value="admin_approved">管理者承認済み</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={savePayrollEntry}>{editingPayrollId ? '更新保存' : '明細追加'}</button>
            <button type="button" onClick={resetPayrollEntryForm}>クリア</button>
          </div>
        </section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <label style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>
            <p style={{ margin: 0, marginBottom: 6, fontSize: 13, fontWeight: 600 }}>個人明細CSV取り込み</p>
            <input type="file" accept=".csv" onChange={importDetailCsv} />
            {detailImportInfo ? <p style={{ margin: '6px 0 0', fontSize: 12, color: '#166534' }}>完了: {detailImportInfo}</p> : null}
          </label>
          <label style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>
            <p style={{ margin: 0, marginBottom: 6, fontSize: 13, fontWeight: 600 }}>売上合計CSV取り込み</p>
            <input type="file" accept=".csv" onChange={importSalesCsv} />
            {salesImportInfo ? <p style={{ margin: '6px 0 0', fontSize: 12, color: '#166534' }}>完了: {salesImportInfo}</p> : null}
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <input
            placeholder="対象月 (例: 2026-03)"
            value={payrollMonth}
            onChange={(e) => setPayrollMonth(e.target.value)}
          />
          <select value={payrollDriverId} onChange={(e) => setPayrollDriverId(e.target.value)}>
            <option value="all">全ドライバー</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
          <select value={payrollStatus} onChange={(e) => setPayrollStatus(e.target.value)}>
            <option value="all">全ステータス</option>
            <option value="pending">未承認</option>
            <option value="needs_change">差し戻し</option>
            <option value="driver_approved">承認済み</option>
            <option value="admin_approved">管理者承認済み</option>
          </select>
          <input
            placeholder="内容 / driverId"
            value={payrollQuery}
            onChange={(e) => setPayrollQuery(e.target.value)}
          />
          <button type="button" onClick={() => loadPayroll(1)} disabled={loading}>
            {loading ? '読み込み中...' : '明細検索'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <SummaryCard label="表示件数" value={payrollSummary.count} />
          <SummaryCard label="合計金額" value={`¥${formatNumber(payrollSummary.total_amount)}`} />
          <SummaryCard label="未承認" value={payrollSummary.pending_count} />
          <SummaryCard label="差し戻し" value={payrollSummary.needs_change_count} />
        </div>

        <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>天引き設定（選択中ドライバー・月）</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={addDeductionRow}>＋項目追加</button>
              <button type="button" onClick={saveDeductions}>保存</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 120px 120px', gap: 8, marginBottom: 8 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              税区分
              <select
                value={taxSettings.mode}
                onChange={(e) => setTaxSettings((prev) => ({ ...prev, mode: e.target.value }))}
              >
                <option value="none">なし</option>
                <option value="inclusive">内税</option>
                <option value="exclusive">外税</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              税率
              <input
                type="number"
                value={taxSettings.rate}
                onChange={(e) => setTaxSettings((prev) => ({ ...prev, rate: Number(e.target.value || 0) }))}
              />
            </label>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {deductionItems.map((item) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px', gap: 8 }}>
                <input
                  placeholder="内容"
                  value={item.label}
                  onChange={(e) => setDeductionItems((prev) => prev.map((row) => (
                    row.id === item.id ? { ...row, label: e.target.value } : row
                  )))}
                />
                <input
                  type="number"
                  value={item.amount}
                  onChange={(e) => setDeductionItems((prev) => prev.map((row) => (
                    row.id === item.id ? { ...row, amount: Number(e.target.value || 0) } : row
                  )))}
                />
                <button
                  type="button"
                  onClick={() => setDeductionItems((prev) => prev.filter((row) => row.id !== item.id))}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          {deductionMessage ? (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#166534' }}>{deductionMessage}</p>
          ) : null}
        </section>

        <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f6f6f6' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>ID</th>
                <th style={{ textAlign: 'left', padding: 8 }}>driverId</th>
                <th style={{ textAlign: 'left', padding: 8 }}>対象月</th>
                <th style={{ textAlign: 'left', padding: 8 }}>内容</th>
                <th style={{ textAlign: 'right', padding: 8 }}>単価</th>
                <th style={{ textAlign: 'right', padding: 8 }}>件数</th>
                <th style={{ textAlign: 'right', padding: 8 }}>合計</th>
                <th style={{ textAlign: 'left', padding: 8 }}>状態</th>
                <th style={{ textAlign: 'left', padding: 8 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {payrollEntries.map((entry) => (
                <tr key={entry.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{entry.id}</td>
                  <td style={{ padding: 8 }}>{entry.driver_id}</td>
                  <td style={{ padding: 8 }}>{entry.month}</td>
                  <td style={{ padding: 8 }}>{entry.content}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{formatNumber(entry.unit_price)}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{formatNumber(entry.quantity)}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{formatNumber(entry.total)}</td>
                  <td style={{ padding: 8 }}>{entry.status}</td>
                  <td style={{ padding: 8, display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => startEditPayrollEntry(entry)}>編集</button>
                    <button type="button" onClick={() => deletePayrollEntry(entry.id)}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button type="button" disabled={payrollPage <= 1} onClick={() => loadPayroll(payrollPage - 1)}>前へ</button>
          <span>{payrollPage} / {payrollPages}</span>
          <span>表示: {payrollEntries.length} / 総件数: {payrollTotal}</span>
          <button type="button" disabled={payrollPage >= payrollPages} onClick={() => loadPayroll(payrollPage + 1)}>次へ</button>
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>操作ログ（audit logs）</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 1fr 120px', gap: 8, marginBottom: 10 }}>
          <input
            placeholder="action (例: update)"
            value={auditAction}
            onChange={(e) => setAuditAction(e.target.value)}
          />
          <input
            placeholder="targetType (例: member)"
            value={auditTargetType}
            onChange={(e) => setAuditTargetType(e.target.value)}
          />
          <input
            placeholder="actor_uid / actor_email / target_id"
            value={auditQuery}
            onChange={(e) => setAuditQuery(e.target.value)}
          />
          <button type="button" onClick={() => loadAuditLogs(1)} disabled={loading}>
            {loading ? '読み込み中...' : 'ログ検索'}
          </button>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f6f6f6' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>日時</th>
                <th style={{ textAlign: 'left', padding: 8 }}>actor</th>
                <th style={{ textAlign: 'left', padding: 8 }}>role</th>
                <th style={{ textAlign: 'left', padding: 8 }}>action</th>
                <th style={{ textAlign: 'left', padding: 8 }}>target</th>
                <th style={{ textAlign: 'left', padding: 8 }}>target_id</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{formatDateTime(log.created_at)}</td>
                  <td style={{ padding: 8 }}>{log.actor_email || log.actor_uid || '-'}</td>
                  <td style={{ padding: 8 }}>{log.actor_role || '-'}</td>
                  <td style={{ padding: 8 }}>{log.action}</td>
                  <td style={{ padding: 8 }}>{log.target_type}</td>
                  <td style={{ padding: 8 }}>{log.target_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button type="button" disabled={auditPage <= 1} onClick={() => loadAuditLogs(auditPage - 1)}>前へ</button>
          <span>{auditPage} / {auditPages}</span>
          <span>表示: {auditLogs.length} / 総件数: {auditTotal}</span>
          <button type="button" disabled={auditPage >= auditPages} onClick={() => loadAuditLogs(auditPage + 1)}>次へ</button>
        </div>
      </section>
    </main>
  );
}

function isValidInvoiceNumber(value) {
  return /^T\d{13}$/i.test(String(value || '').trim());
}

function formatNumber(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('ja-JP');
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ja-JP');
}

function parseCsvRows(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => normalizeHeader(h));
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = String(cells[idx] || '').trim();
    });
    return row;
  });
}

function normalizeHeader(value) {
  return String(value || '').replace(/^"|"$/g, '').replace(/\s+/g, '').replace(/　/g, '').trim().toLowerCase();
}

function toMonth(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length >= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  }
  return raw;
}

function normalizeDetailRow(row) {
  const driverId = row.driverid || row.driver_id || row.委託社員番号 || row.社員番号 || '';
  const month = toMonth(row.month || row.対象月 || row.稼働月 || row.稼働日 || '');
  const content = row.content || row.内容 || row.description || '';
  const unitPrice = row.unitprice || row.単価 || row.業務委託費用 || '0';
  const quantity = row.quantity || row.件数 || row.個数 || '0';
  if (!String(driverId).trim() || !String(month).trim()) return null;
  return {
    driverId: String(driverId).trim(),
    month: String(month).trim(),
    content: String(content || '').trim(),
    unitPrice: Number(String(unitPrice || '').replace(/,/g, '')) || 0,
    quantity: Number(String(quantity || '').replace(/,/g, '')) || 0
  };
}

function normalizeSalesRow(row) {
  const month = toMonth(row.month || row.対象月 || row.稼働日 || row.日付 || '');
  const total = row.total || row.合計金額 || row.売上合計 || row.金額 || '';
  if (!String(month).trim()) return null;
  return {
    month: String(month).trim(),
    total: Number(String(total || '').replace(/,/g, '')) || 0
  };
}

function SummaryCard({ label, value }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', minWidth: 140 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{label}</p>
      <p style={{ margin: 0, marginTop: 4, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
