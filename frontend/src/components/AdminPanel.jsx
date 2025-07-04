import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase-config';
import { EditUserModal } from './EditUserModal';
import { ReportView } from './ReportView';
import { PendingApprovals } from './PendingApprovals';
import { toast } from 'react-toastify';

function ManageUsersView() {
  const [reportingUser, setReportingUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao buscar usuários.');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (!reportingUser) { fetchUsers(); }
  }, [reportingUser, fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); setFormMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ displayName: newName, email: newEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success('Usuário criado com sucesso!');
      setFormMessage(
        <div>
          <p className="font-semibold text-green-700">✅ Link de convite gerado.</p>
          <p className="mt-2 text-xs text-gray-600">Copie e envie para o funcionário:</p>
          <input type="text" readOnly value={data.passwordResetLink} className="w-full p-1 mt-1 text-xs bg-gray-100 border rounded" onFocus={(e) => e.target.select()} />
        </div>
      );
      setNewName(''); setNewEmail(''); fetchUsers();
    } catch (err) {
      toast.error(err.message || "Falha ao criar usuário.");
      setFormMessage(<p className="font-semibold text-red-600">❌ {err.message}</p>);
    } finally { setIsSubmitting(false); }
  };

  const handleRemoveUser = async (uid, email) => {
    if (!window.confirm(`Tem certeza que deseja remover ${email}?`)) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/users/${uid}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.success); fetchUsers();
    } catch (err) { toast.error(`Erro: ${err.message}`); }
  };
  
  const handleOpenEditModal = (user) => { setEditingUser(user); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingUser(null); };
  const handleUpdateSuccess = () => { handleCloseModal(); fetchUsers(); };

  if (reportingUser) {
    return <ReportView user={reportingUser} onBack={() => setReportingUser(null)} />;
  }

  return (
    <>
      <div className="space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Cadastrar Novo Funcionário</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" required />
              <input type="email" placeholder="E-mail" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" required />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg">{isSubmitting ? 'Cadastrando...' : 'Criar e Enviar Convite'}</button>
            {formMessage && <div className="mt-4 p-3 bg-gray-50 rounded-lg border">{formMessage}</div>}
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700 p-6">Funcionários Cadastrados</h2>
          <div className="overflow-x-auto">
            {isLoading ? <p className="p-6 text-center text-gray-500">Carregando...</p> : error ? <p className="p-6 text-center text-red-500">{error}</p> : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider">Funcionário</th>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user.uid} className="hover:bg-gray-50">
                      <td className="px-6 py-4"><p className="font-medium text-gray-900">{user.displayName || '(Sem nome)'}</p><p className="text-gray-500">{user.email}</p></td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <button onClick={() => setReportingUser(user)} title="Ver Relatório" className="p-2 text-gray-500 rounded-full hover:bg-blue-100 hover:text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                        <button onClick={() => handleOpenEditModal(user)} title="Editar" className="p-2 text-gray-500 rounded-full hover:bg-indigo-100 hover:text-indigo-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                        <button onClick={() => handleRemoveUser(user.uid, user.email)} title="Remover" className="p-2 text-gray-500 rounded-full hover:bg-red-100 hover:text-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      <EditUserModal isOpen={isModalOpen} onClose={handleCloseModal} user={editingUser} onSuccess={handleUpdateSuccess} />
    </>
  );
}

export function AdminPanel({ onBack }) {
  const [view, setView] = useState('menu');

  const renderContent = () => {
    switch (view) {
      case 'users':
        return <ManageUsersView />;
      case 'approvals':
        return <PendingApprovals />;
      default:
        return (
          <div className="space-y-6">
            <p className="text-center text-gray-600">Selecione uma das opções abaixo para continuar.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => setView('approvals')} className="text-left p-6 bg-white hover:bg-gray-50 rounded-xl shadow-md border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <h3 className="text-lg font-semibold text-gray-800">Aprovações Pendentes</h3>
                <p className="text-sm text-gray-500">Valide os registros de ponto atrasados.</p>
              </button>
              <button onClick={() => setView('users')} className="text-left p-6 bg-white hover:bg-gray-50 rounded-xl shadow-md border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <h3 className="text-lg font-semibold text-gray-800">Gerenciar Funcionários</h3>
                <p className="text-sm text-gray-500">Adicione, remova, edite e veja relatórios.</p>
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Painel do Administrador</h1>
        <button onClick={view === 'menu' ? onBack : () => setView('menu')} className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-2 rounded-lg shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          {view === 'menu' ? 'Sair do Painel' : 'Voltar ao Menu'}
        </button>
      </div>
      {renderContent()}
    </div>
  );
}