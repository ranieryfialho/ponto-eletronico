import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { auth } from '../firebase-config';
import { toast } from 'react-toastify';

const daysOfWeek = [
  { key: 'sunday', label: 'Domingo' },
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
];

const defaultWorkHours = {
  sunday: { isWorkDay: false, entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '17:00' },
  monday: { isWorkDay: true, entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '18:00' },
  tuesday: { isWorkDay: true, entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '18:00' },
  wednesday: { isWorkDay: true, entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '18:00' },
  thursday: { isWorkDay: true, entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '18:00' },
  friday: { isWorkDay: true, entry: '08:00', breakStart: '12:00', breakEnd: '13:00', exit: '18:00' },
  saturday: { isWorkDay: false, entry: '08:00', breakStart: '12:00', breakEnd: '12:00', exit: '12:00' },
};


export function EditUserModal({ isOpen, onClose, user, onSuccess }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [cargo, setCargo] = useState('');
  const [allowedLocation, setAllowedLocation] = useState('matriz');
  const [status, setStatus] = useState('ativo');
  
  const [workHours, setWorkHours] = useState(defaultWorkHours);
  
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
          setStatus(profileData.status || 'ativo');

          if (profileData.workHours) {
            const newWorkHours = { ...defaultWorkHours };
            if (profileData.workHours.weekday) {
                ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
                    newWorkHours[day] = { ...newWorkHours[day], ...profileData.workHours.weekday, isWorkDay: true };
                });
            }
            // Sobrescreve com dados novos, se existirem
             Object.keys(newWorkHours).forEach(day => {
              if (profileData.workHours[day]) {
                newWorkHours[day] = { ...newWorkHours[day], ...profileData.workHours[day] };
              }
            });
            setWorkHours(newWorkHours);
          } else {
             setWorkHours(defaultWorkHours);
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

  const handleHourChange = (dayKey, field, value) => {
    setWorkHours(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value }
    }));
  };

  const handleDayToggle = (dayKey) => {
    setWorkHours(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], isWorkDay: !prev[dayKey].isWorkDay }
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
        body: JSON.stringify({ displayName, email, cpf, cargo, workHours, allowedLocation, status }),
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
              <Dialog.Panel className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl transition-all">
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
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700">Situação do Funcionário</label>
                      <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 pl-3 pr-10">
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                      <p className="mt-2 text-xs text-gray-500">Funcionários inativos são destacados na lista e não podem registrar ponto.</p>
                    </div>

                    <div className="pt-4 border-t">
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700">Local de Ponto Permitido</label>
                      <select id="location" name="location" value={allowedLocation} onChange={(e) => setAllowedLocation(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 pl-3 pr-10">
                        <option value="matriz">Apenas Matriz</option>
                        <option value="filial">Apenas Filial</option>
                        <option value="ambas">Ambas</option>
                        <option value="externo">Externo</option>
                      </select>
                      <p className="mt-2 text-xs text-gray-500">Colaboradores 'Externo' podem registrar o ponto em qualquer localização.</p>
                    </div>

                    <div className="pt-4 border-t">
                        <h3 className="text-md font-semibold text-gray-700">Jornada de Trabalho Semanal</h3>
                        <div className="space-y-4 mt-2">
                        {daysOfWeek.map(day => (
                            <div key={day.key} className="p-3 rounded-lg border">
                                <div className="flex items-center gap-3">
                                    <input id={`${day.key}-check`} type="checkbox" checked={workHours[day.key]?.isWorkDay} onChange={() => handleDayToggle(day.key)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                    <label htmlFor={`${day.key}-check`} className="font-medium text-gray-700">{day.label}</label>
                                </div>
                                {workHours[day.key]?.isWorkDay && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                    <div><label className="block text-xs font-medium text-gray-600">Entrada</label><input type="time" value={workHours[day.key].entry} onChange={(e) => handleHourChange(day.key, 'entry', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                                    <div><label className="block text-xs font-medium text-gray-600">Início Pausa</label><input type="time" value={workHours[day.key].breakStart} onChange={(e) => handleHourChange(day.key, 'breakStart', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                                    <div><label className="block text-xs font-medium text-gray-600">Fim Pausa</label><input type="time" value={workHours[day.key].breakEnd} onChange={(e) => handleHourChange(day.key, 'breakEnd', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                                    <div><label className="block text-xs font-medium text-gray-600">Saída</label><input type="time" value={workHours[day.key].exit} onChange={(e) => handleHourChange(day.key, 'exit', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"/></div>
                                </div>
                                )}
                            </div>
                        ))}
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
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}