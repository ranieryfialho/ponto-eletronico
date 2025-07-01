import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

export function JustificationModal({ isOpen, onClose, onSubmit }) {
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!justification.trim()) {
      alert('Por favor, escreva sua justificativa para o atraso.');
      return;
    }
    setIsSubmitting(true);
    await onSubmit(justification);
    setIsSubmitting(false);
    setJustification('');
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                  Justificativa de Atraso
                </Dialog.Title>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Seu registro de entrada excedeu o tempo de tolerância. Por favor, forneça uma justificativa para que seu gestor possa analisar.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="mt-4">
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    className="w-full h-28 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Descreva o motivo do atraso..."
                    required
                  />
                  <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400">
                      {isSubmitting ? 'Enviando...' : 'Enviar Justificativa'}
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