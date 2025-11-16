import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase-config';
import { toast } from 'react-toastify';
import { ClipboardDocumentIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline';

export function KioskManagement() {
  const [kiosks, setKiosks] = useState([]);
  const [newKioskName, setNewKioskName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [generatedToken, setGeneratedToken] = useState(null);

  const fetchKiosks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/kiosks', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao buscar kiosks.');
      }
      const data = await response.json();
      setKiosks(data);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKiosks();
  }, [fetchKiosks]);

  const handleCreateKiosk = async (e) => {
    e.preventDefault();
    if (!newKioskName) {
      toast.error('O nome do Kiosk é obrigatório.');
      return;
    }
    setIsSubmitting(true);
    setGeneratedToken(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/kiosks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newKioskName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      toast.success('Kiosk criado com sucesso! Guarde o token em local seguro.');
      setGeneratedToken(data.authToken);
      setNewKioskName('');
      fetchKiosks();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKiosk = async (kioskId, kioskName) => {
    if (!window.confirm(`Tem certeza que deseja remover o kiosk "${kioskName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/kiosks/${kioskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast.success(data.success);
      fetchKiosks();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) {
      toast.error('Token não encontrado para copiar.');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Token copiado para a área de transferência!');
    }, (err) => {
      toast.error('Falha ao copiar o token.');
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Criar Novo Kiosk
        </h2>
        <form onSubmit={handleCreateKiosk} className="space-y-4">
          <div>
            <label htmlFor="kiosk-name" className="block text-sm font-medium text-gray-700">
              Nome do Kiosk (Ex: Recepção, Entrada Fábrica)
            </label>
            <input
              type="text"
              id="kiosk-name"
              placeholder="Nome de identificação"
              value={newKioskName}
              onChange={(e) => setNewKioskName(e.target.value)}
              className="w-full p-3 mt-1 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-400"
          >
            {isSubmitting ? "Criando..." : "Criar Kiosk e Gerar Token"}
          </button>
        </form>

        {generatedToken && (
          <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400">
            <h3 className="font-bold text-blue-800">Token Gerado (Copie Agora!)</h3>
            <p className="text-sm text-blue-700 mt-1">
              Este token é secreto e não será mostrado novamente. Cole-o no navegador do computador que servirá como Kiosk.
            </p>
            <div className="mt-2 relative">
              <input
                type="text"
                readOnly
                value={generatedToken}
                className="w-full p-2 pr-10 bg-white border border-blue-300 rounded-md font-mono text-sm"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => copyToClipboard(generatedToken)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-blue-600"
                title="Copiar"
              >
                <ClipboardDocumentIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700">
            Kiosks Cadastrados
          </h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-center text-gray-500">Carregando kiosks...</p>
          ) : error ? (
            <p className="p-6 text-center text-red-500">{error}</p>
          ) : kiosks.length === 0 ? (
            <p className="p-6 text-center text-gray-500">Nenhum kiosk cadastrado.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {kiosks.map((kiosk) => (
                  <tr key={kiosk.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{kiosk.name}</p>
                      <p className="text-gray-500 text-xs mt-1">ID: {kiosk.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      {kiosk.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => copyToClipboard(kiosk.authToken)}
                        title="Copiar Token"
                        className="p-2 text-gray-500 rounded-full hover:bg-blue-100 hover:text-blue-600"
                      >
                        <KeyIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteKiosk(kiosk.id, kiosk.name)}
                        title="Remover Kiosk"
                        className="p-2 text-gray-500 rounded-full hover:bg-red-100 hover:text-red-600"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}