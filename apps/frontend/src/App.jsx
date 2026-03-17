import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiPost } from './api';

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

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

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

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    loadMembers(1);
  }, [status, loadMembers]);

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
    </main>
  );
}

function isValidInvoiceNumber(value) {
  return /^T\d{13}$/i.test(String(value || '').trim());
}

