import React from 'react';
import { useEffect, useState } from 'react';
import { apiGet } from './api';

export function App() {
  const [health, setHealth] = useState('');
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMembers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiGet('/api/v1/members?status=all&page=1&limit=20');
      setMembers(response?.data?.items || []);
    } catch (e) {
      setError(e.message || 'メンバー取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiGet('/health')
      .then((response) => {
        const status = response?.data?.status || 'up';
        setHealth(String(status));
      })
      .catch(() => {
        setHealth('down');
      });
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>hakobin-re frontend</h1>
      <p>backend health: <strong>{health || '...'}</strong></p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button type="button" onClick={loadMembers} disabled={loading}>
          {loading ? '読み込み中...' : 'メンバー取得'}
        </button>
        <span>件数: {members.length}</span>
      </div>
      {error ? (
        <p style={{ color: '#b91c1c' }}>{error}</p>
      ) : null}
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {members.map((member) => (
          <li key={member.id}>
            {member.name} ({member.account_user_id || 'no-account'}) / {member.active ? 'active' : 'inactive'}
          </li>
        ))}
      </ul>
    </main>
  );
}
