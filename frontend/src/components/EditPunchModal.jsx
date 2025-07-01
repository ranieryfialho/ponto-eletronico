import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { auth } from '../firebase-config';
import { toast } from 'react-toastify';

const ENTRY_TYPES = ['Entrada', 'Início do Intervalo', 'Fim do Intervalo', 'Saída'];

export function EditPunchModal({ isOpen, onClose, entry, onSuccess }) {
  const [newType, setNewType] = useState('');
  const [newDateTime, setNewDateTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      const entryDate = new Date(entry.time);
      const year = entryDate.getFullYear();
      const month = String(entryDate.getMonth() + 1).padStart(2, '0');
      const day = String(entryDate.getDate()).padStart(2, '0');
      const hours = String(entryDate.getHours()).padStart(2, '0');
      const minutes = String(entryDate.getMinutes()).padStart(2, '0');
      const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

      setNewDateTime(localDateTime);
      setNewType(entry.type);
      setReason('');
    }
  }, [entry]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('A justificativa é obrigatória para a alteração.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ newTimestamp: newDateTime, newType, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success('Registro atualizado com sucesso!');
      onSuccess();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">Editar Registro de Ponto</Dialog.Title>
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo de Registro</label>
                    <select value={newType} onChange={(e) => setNewType(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                      {ENTRY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nova Data e Hora</label>
                    <input type="datetime-local" value={newDateTime} onChange={(e) => setNewDateTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Justificativa da Alteração</label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="mt-4 flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="rounded-md bg-gray-100 px-4 py-2">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="rounded-md bg-blue-600 px-4 py-2 text-white">{isSubmitting ? 'Salvando...' : 'Salvar'}</button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}