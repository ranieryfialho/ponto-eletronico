import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-toastify';

export function KioskAuthorizationModal({ isOpen, onClose, onSubmit }) {
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      toast.error('Por favor, insira o token de autorização.');
      return;
    }
    setIsSubmitting(true);
    await onSubmit(token);
    setIsSubmitting(false);
    setToken('');
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                  Autorização de Kiosk
                </Dialog.Title>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Insira o Token de Autorização gerado no seu painel de admin.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="mt-4">
                  <textarea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full h-24 p-2 border border-gray-300 rounded-md font-mono text-sm"
                    placeholder="Cole o token de autorização aqui..."
                    required
                  />
                  <div className="mt-4 flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isSubmitting ? 'Autorizando...' : 'Autorizar'}
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