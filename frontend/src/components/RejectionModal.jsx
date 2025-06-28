import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

export function RejectionModal({ isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Por favor, escreva o motivo da rejeição.');
      return;
    }
    setIsSubmitting(true);
    await onSubmit(reason);
    setIsSubmitting(false);
    setReason('');
  };

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
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">Motivo da Rejeição</Dialog.Title>
                <form onSubmit={handleSubmit} className="mt-4">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full h-24 p-2 border border-gray-300 rounded-md"
                    placeholder="Descreva o motivo para rejeitar este registro de ponto..."
                    required
                  />
                  <div className="mt-4 flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200">
                      Cancelar
                    </button>
                    <button type="submit" disabled={isSubmitting} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-400">
                      {isSubmitting ? 'Enviando...' : 'Confirmar Rejeição'}
                    </button>
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