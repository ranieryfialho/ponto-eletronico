import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase-config';
import { toast } from 'react-toastify';

export function CompanyProfile() {
  const [company, setCompany] = useState({
    name: '',
    cnpj: '',
    addresses: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fetchCompanyProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/company', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Falha ao carregar os dados da empresa.');
      }
      const data = await response.json();
      if (!data.addresses || data.addresses.length === 0) {
        data.addresses = [{ name: 'Matriz', fullAddress: '', isMain: true }];
      }
      setCompany(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanyProfile();
  }, [fetchCompanyProfile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCompany(prev => ({ ...prev, [name]: value }));
  };

  const handleAddressChange = (index, e) => {
    const { name, value } = e.target;
    const newAddresses = [...company.addresses];
    newAddresses[index] = { ...newAddresses[index], [name]: value };
    setCompany(prev => ({ ...prev, addresses: newAddresses }));
  };

  const addAddress = () => {
    setCompany(prev => ({
      ...prev,
      addresses: [
        ...prev.addresses, 
        { name: `Filial ${prev.addresses.length}`, fullAddress: '', isMain: false }
      ],
    }));
  };

  const removeAddress = (index) => {
    if (company.addresses[index].isMain) {
      toast.warn('A Matriz não pode ser removida.');
      return;
    }
    const newAddresses = company.addresses.filter((_, i) => i !== index);
    setCompany(prev => ({ ...prev, addresses: newAddresses }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(company),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ocorreu um erro ao salvar.');
      }
      toast.success('Dados da empresa salvos com sucesso!');
      if(data.companyProfile) {
        setCompany(data.companyProfile);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Carregando dados da empresa...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800">Perfil da Empresa</h2>
      <p className="mt-1 text-sm text-gray-500">
        Preencha os dados da sua empresa. Os endereços cadastrados aqui serão usados para validar o registro de ponto dos funcionários.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Dados Gerais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
              <input type="text" name="name" id="name" value={company.name} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
            </div>
            <div>
              <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700">CNPJ</label>
              <input type="text" name="cnpj" id="cnpj" value={company.cnpj} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Locais de Ponto</h3>
          <div className="space-y-6">
            {company.addresses.map((address, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-4 relative">
                 {!address.isMain && (
                   <button
                     type="button"
                     onClick={() => removeAddress(index)}
                     className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-7 w-7 flex items-center justify-center hover:bg-red-600"
                     title="Remover Filial"
                   >
                     &times;
                   </button>
                 )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label htmlFor={`addr-name-${index}`} className="block text-sm font-medium text-gray-700">Nome do Local</label>
                    <input type="text" name="name" id={`addr-name-${index}`} value={address.name} onChange={(e) => handleAddressChange(index, e)} placeholder={address.isMain ? "Ex: Matriz" : "Ex: Filial Centro"} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor={`addr-full-${index}`} className="block text-sm font-medium text-gray-700">Endereço Completo</label>
                    <input type="text" name="fullAddress" id={`addr-full-${index}`} value={address.fullAddress} onChange={(e) => handleAddressChange(index, e)} placeholder="Rua, Número, Bairro, Cidade - Estado" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                    {address.location && (
                       <p className="text-xs text-green-600 mt-1">
                         Coordenadas: {address.location.lat.toFixed(5)}, {address.location.lon.toFixed(5)}
                       </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addAddress}
            className="mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg text-sm"
          >
            + Adicionar Filial
          </button>
        </div>

        <div className="flex justify-end pt-6 border-t">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-400"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}