import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase-config';

export function AdminPanel({ onBack }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('http://localhost:3001/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao buscar usuários.');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('http://localhost:3001/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao criar usuário.');
      }
      setFormMessage(`✅ ${data.success}`);
      setNewEmail('');
      setNewPassword('');
      fetchUsers();
    } catch (err) {
      setFormMessage(`❌ ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Painel do Administrador</h2>
        <button onClick={onBack} className="text-sm text-blue-500 hover:underline">Voltar</button>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">Cadastrar Novo Funcionário</h3>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <input
            type="email"
            placeholder="E-mail do funcionário"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Senha provisória (mín. 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
          <button type="submit" disabled={isSubmitting} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
            {isSubmitting ? 'Cadastrando...' : 'Cadastrar Funcionário'}
          </button>
          {formMessage && <p className={`mt-2 text-sm ${formMessage.includes('❌') ? 'text-red-500' : 'text-green-500'}`}>{formMessage}</p>}
        </form>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Funcionários Cadastrados</h3>
        {isLoading ? <p>Carregando...</p> : error ? <p className="text-red-500">{error}</p> : (
          <div className="bg-white rounded-lg shadow-lg text-left overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {users.map(user => (
                <li key={user.uid} className="p-4">
                  <p className="font-semibold">{user.email}</p>
                  <p className="text-sm text-gray-500">UID: {user.uid}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}