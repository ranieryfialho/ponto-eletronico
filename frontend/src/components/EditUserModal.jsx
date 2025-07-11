import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { auth } from '../firebase-config';
import { toast } from 'react-toastify';

export function EditUserModal({ isOpen, onClose, user, onSuccess }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [cargo, setCargo] = useState('');
  const [allowedLocation, setAllowedLocation] = useState('matriz');

  const [workHours, setWorkHours] = useState({
    weekday: { entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '18:00' },
    saturday: { isWorkDay: false, entry: '08:00', breakStart: '12:00', breakEnd: '12:00', exit: '12:00' }
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
          const response = await fetch(`/api/admin/employees/${user.uid}`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!response.ok) throw new Error('Falha ao buscar perfil.');
          const profileData = await response.json();
          setCpf(profileData.cpf || '');
          setCargo(profileData.cargo || '');
          setAllowedLocation(profileData.allowedLocation || 'matriz');

          if (profileData.workHours) {
            setWorkHours({
              weekday: profileData.workHours.weekday || { entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '18:00' },
              saturday: profileData.workHours.saturday || { isWorkDay: false, entry: '08:00', breakStart: '12:00', breakEnd: '12:00', exit: '12:00' }
            });
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

  const handleHourChange = (dayType, field, value) => {
    setWorkHours(prev => ({
      ...prev,
      [dayType]: { ...prev[dayType], [field]: value }
    }));
  };

  const handleSaturdayToggle = () => {
    setWorkHours(prev => ({
      ...prev,
      saturday: { ...prev.saturday, isWorkDay: !prev.saturday.isWorkDay }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`/api/admin/users/${user.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ displayName, email, cpf, cargo, workHours, allowedLocation }),
      });
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
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-xl font-bold text-gray-800">Editar Perfil do Funcionário</Dialog.Title>
                <p className="mt-1 text-sm text-gray-500">Altere os dados e a jornada de trabalho do funcionário.</p>
                
                {isLoading ? <p className="mt-8 text-center">Carregando perfil...</p> : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Nome Completo</label><input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"/></div>
                      <div><label htmlFor="email" className="block text-sm font-medium text-gray-700">E-mail</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"/></div>
                      <div><label htmlFor="cpf" className="block text-sm font-medium text-gray-700">CPF</label><input id="cpf" type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                      <div><label htmlFor="cargo" className="block text-sm font-medium text-gray-700">Cargo</label><input id="cargo" type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                    </div>

                    <div className="pt-4 border-t">
                      <h3 className="text-md font-semibold text-gray-700">Local de Ponto Permitido</h3>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
                        <div className="flex items-center">
                          <input id="loc-matriz" name="location" type="radio" value="matriz" checked={allowedLocation === 'matriz'} onChange={(e) => setAllowedLocation(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                          <label htmlFor="loc-matriz" className="ml-2 block text-sm text-gray-900">Apenas Matriz</label>
                        </div>
                        <div className="flex items-center">
                          <input id="loc-filial" name="location" type="radio" value="filial" checked={allowedLocation === 'filial'} onChange={(e) => setAllowedLocation(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                          <label htmlFor="loc-filial" className="ml-2 block text-sm text-gray-900">Apenas Filial</label>
                        </div>
                        <div className="flex items-center">
                          <input id="loc-ambas" name="location" type="radio" value="ambas" checked={allowedLocation === 'ambas'} onChange={(e) => setAllowedLocation(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                          <label htmlFor="loc-ambas" className="ml-2 block text-sm text-gray-900">Ambas</label>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <h3 className="text-md font-semibold text-gray-700">Jornada de Segunda a Sexta</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div><label className="block text-xs font-medium text-gray-600">Entrada</label><input type="time" value={workHours.weekday.entry} onChange={(e) => handleHourChange('weekday', 'entry', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                        <div><label className="block text-xs font-medium text-gray-600">Início Pausa</label><input type="time" value={workHours.weekday.breakStart} onChange={(e) => handleHourChange('weekday', 'breakStart', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                        <div><label className="block text-xs font-medium text-gray-600">Fim Pausa</label><input type="time" value={workHours.weekday.breakEnd} onChange={(e) => handleHourChange('weekday', 'breakEnd', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                        <div><label className="block text-xs font-medium text-gray-600">Saída</label><input type="time" value={workHours.weekday.exit} onChange={(e) => handleHourChange('weekday', 'exit', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-3">
                        <input id="saturday-check" type="checkbox" checked={workHours.saturday.isWorkDay} onChange={handleSaturdayToggle} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                        <label htmlFor="saturday-check" className="text-md font-semibold text-gray-700">Jornada de Sábado</label>
                      </div>
                      {workHours.saturday.isWorkDay && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div><label className="block text-xs font-medium text-gray-600">Entrada</label><input type="time" value={workHours.saturday.entry} onChange={(e) => handleHourChange('saturday', 'entry', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                          <div><label className="block text-xs font-medium text-gray-600">Início Pausa</label><input type="time" value={workHours.saturday.breakStart} onChange={(e) => handleHourChange('saturday', 'breakStart', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                          <div><label className="block text-xs font-medium text-gray-600">Fim Pausa</label><input type="time" value={workHours.saturday.breakEnd} onChange={(e) => handleHourChange('saturday', 'breakEnd', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                          <div><label className="block text-xs font-medium text-gray-600">Saída</label><input type="time" value={workHours.saturday.exit} onChange={(e) => handleHourChange('saturday', 'exit', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                        </div>
                      )}
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
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}