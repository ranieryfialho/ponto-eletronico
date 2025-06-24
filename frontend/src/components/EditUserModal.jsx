// src/components/EditUserModal.jsx (Completo e com fetch relativo)
import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { auth } from '../firebase-config';
import { toast } from 'react-toastify';

export function EditUserModal({ isOpen, onClose, user, onSuccess }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [cargo, setCargo] = useState('');
  const [workHours, setWorkHours] = useState({
    entry: '08:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    exit: '18:00',
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && isOpen) {
      const fetchProfile = async () => {
        setIsLoading(true);
        setDisplayName(user.displayName || '');
        setEmail(user.email || '');
        setError('');
        try {
          const token = await auth.currentUser.getIdToken();
          // fetch com caminho relativo
          const response = await fetch(`/api/admin/employees/${user.uid}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!response.ok) throw new Error('Falha ao buscar perfil.');
          const profileData = await response.json();
          setCpf(profileData.cpf || '');
          setCargo(profileData.cargo || '');
          if (profileData.workHours) {
            setWorkHours(profileData.workHours);
          } else {
             setWorkHours({ entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '18:00' });
          }
        } catch (err) {
          setError('Não foi possível carregar os dados do perfil. ' + err.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchProfile();
    }
  }, [user, isOpen]);

  const handleHourChange = (e) => {
    const { name, value } = e.target;
    setWorkHours(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const token = await auth.currentUser.getIdToken();
      // fetch com caminho relativo
      const response = await fetch(`/api/admin/users/${user.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ displayName, email, cpf, cargo, workHours }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Perfil do funcionário atualizado!");
      onSuccess();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="text-xl font-bold text-gray-800">Editar Perfil do Funcionário</Dialog.Title>
          <p className="mt-1 text-sm text-gray-500">Altere os dados do funcionário abaixo.</p>
          {isLoading ? <p className="mt-4 text-center">Carregando perfil...</p> : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Nome Completo</label>
                  <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-mail</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                </div>
                <div>
                  <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">CPF</label>
                  <input id="cpf" type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                </div>
                 <div>
                  <label htmlFor="cargo" className="block text-sm font-medium text-gray-700">Cargo</label>
                  <input id="cargo" type="text" placeholder="Ex: Professor(a)" value={cargo} onChange={(e) => setCargo(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                </div>
              </div>
              <div className="pt-4 border-t">
                <h3 className="text-md font-semibold text-gray-700">Jornada de Trabalho Padrão</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div>
                    <label htmlFor="entry" className="block text-xs font-medium text-gray-600">Entrada</label>
                    <input type="time" id="entry" name="entry" value={workHours.entry} onChange={handleHourChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                  </div>
                  <div>
                    <label htmlFor="breakStart" className="block text-xs font-medium text-gray-600">Início Pausa</label>
                    <input type="time" id="breakStart" name="breakStart" value={workHours.breakStart} onChange={handleHourChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                  </div>
                   <div>
                    <label htmlFor="breakEnd" className="block text-xs font-medium text-gray-600">Fim Pausa</label>
                    <input type="time" id="breakEnd" name="breakEnd" value={workHours.breakEnd} onChange={handleHourChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                  </div>
                   <div>
                    <label htmlFor="exit" className="block text-xs font-medium text-gray-600">Saída</label>
                    <input type="time" id="exit" name="exit" value={workHours.exit} onChange={handleHourChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                  </div>
                </div>
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onClose} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400">
                  {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}