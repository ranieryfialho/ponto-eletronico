import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase-config';
import { toast } from 'react-toastify';

export function PendingApprovals() {
  const [pendingEntries, setPendingEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPendingEntries = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/pending-entries', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao buscar pendências.');
      }
      const data = await response.json();
      setPendingEntries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingEntries();
  }, [fetchPendingEntries]);

  const handleAction = async (entryId, action) => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/entries/${entryId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.success);
      fetchPendingEntries();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <p className="text-center text-gray-500">Carregando aprovações pendentes...</p>;
  if (error) return <p className="text-center text-red-500">Erro: {error}</p>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Aprovações de Ponto Pendentes</h2>
      {pendingEntries.length === 0 ? (
        <p className="text-gray-500">Nenhum registro pendente no momento.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {pendingEntries.map(entry => (
            <li key={entry.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-bold text-gray-800">{entry.displayName}</p>
                <p className="text-sm text-gray-600">
                  Tentativa de <span className="font-semibold">{entry.type}</span> em {new Date(entry.timestamp).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleAction(entry.id, 'approve')} className="bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-full hover:bg-green-600">Aprovar</button>
                <button onClick={() => handleAction(entry.id, 'reject')} className="bg-red-500 text-white text-xs font-bold py-1 px-3 rounded-full hover:bg-red-600">Rejeitar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}