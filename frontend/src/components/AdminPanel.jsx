import React, { useState, useEffect, useCallback, useMemo } from "react";
import { auth } from "../firebase-config";
import { EditUserModal } from "./EditUserModal";
import { ReportView } from "./ReportView";
import { PendingApprovals } from "./PendingApprovals";
import { CompanyProfile } from "./CompanyProfile";
import { KioskManagement } from "./KioskManagement";
import { toast } from "react-toastify";

const Tag = ({ text, color }) => {
  const colorClasses = {
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    purple: "bg-purple-100 text-purple-800",
    yellow: "bg-yellow-100 text-yellow-800",
    orange: "bg-orange-100 text-orange-800",
    gray: "bg-gray-100 text-gray-800",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}
    >
      {text}
    </span>
  );
};

function ManageUsersView() {
  const [reportingUser, setReportingUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [linkMessage, setLinkMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("ativo");

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao buscar usuários.");
      }
      const data = await response.json();
      data.sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || "")
      );
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!reportingUser) {
      fetchUsers();
    }
  }, [reportingUser, fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => {
        if (statusFilter === "todos") return true;
        return user.status === statusFilter;
      })
      .filter((user) => {
        const search = searchTerm.toLowerCase();
        if (!search) return true;
        return (
          (user.displayName &&
            user.displayName.toLowerCase().includes(search)) ||
          (user.email &&
            user.email.toLowerCase().includes(search))
        );
      });
  }, [users, searchTerm, statusFilter]);

  const getLocationTag_Fallback = (location) => {
    switch (location) {
      case "matriz":
        return <Tag text="Matriz" color="blue" />;
      case "filial":
        return <Tag text="Filial" color="purple" />;
      case "ambas":
        return <Tag text="Ambas" color="yellow" />;
      case "externo":
        return <Tag text="Externo" color="orange" />;
      default:
        return <Tag text="Matriz" color="blue" />;
    }
  };

  const renderLocationTags = (locationData) => {
    if (Array.isArray(locationData)) {
      if (locationData.length === 0) {
        return <Tag text="Nenhum Local" color="red" />;
      }
      return locationData.map((locName) => {
        let color = "purple";
        if (locName.toLowerCase().includes("matriz")) color = "blue";
        if (locName.toLowerCase().includes("externo")) color = "orange";
        if (locName.toLowerCase().includes("kiosk")) color = "gray";
        return <Tag key={locName} text={locName} color={color} />;
      });
    }
    return getLocationTag_Fallback(locationData);
  };
  

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: newName, email: newEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Usuário criado com sucesso!");
      setFormMessage(
        <div>
          <p className="font-semibold text-green-700">
            ✅ Link de convite gerado.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Copie e envie para o funcionário:
          </p>
          <input
            type="text"
            readOnly
            value={data.passwordResetLink}
            className="w-full p-1 mt-1 text-xs bg-gray-100 border rounded"
            onFocus={(e) => e.target.select()}
          />
        </div>
      );
      setNewName("");
      setNewEmail("");
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Falha ao criar usuário.");
      setFormMessage(
        <p className="font-semibold text-red-600">❌ {err.message}</p>
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveUser = async (uid, email) => {
    if (!window.confirm(`Tem certeza que deseja remover ${email}?`)) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/users/${uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.success);
      fetchUsers();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleResendPassword = async (uid, email) => {
    if (
      !window.confirm(
        `Deseja gerar um novo link de redefinição de senha para ${email}?`
      )
    )
      return;
    setLinkMessage("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/users/${uid}/resend-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast.success(data.success);
      setLinkMessage(
        <div>
          <p className="font-semibold text-green-700">
            ✅ Novo link gerado para {email}.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Copie e envie para o funcionário:
          </p>
          <input
            type="text"
            readOnly
            value={data.passwordResetLink}
            className="w-full p-1 mt-1 text-xs bg-gray-100 border rounded"
            onFocus={(e) => e.target.select()}
          />
        </div>
      );
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
      setLinkMessage(
        <p className="font-semibold text-red-600">❌ {err.message}</p>
      );
    }
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };
  const handleUpdateSuccess = () => {
    handleCloseModal();
    fetchUsers();
  };

  if (reportingUser) {
    return (
      <ReportView user={reportingUser} onBack={() => setReportingUser(null)} />
    );
  }

  return (
    <>
      <div className="space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Cadastrar Novo Funcionário
          </h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nome completo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              />
              <input
                type="email"
                placeholder="E-mail"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
            >
              {isSubmitting ? "Cadastrando..." : "Criar e Enviar Convite"}
            </button>
            {formMessage && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                {formMessage}
              </div>
            )}
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-700 shrink-0">
              Funcionários Cadastrados
            </h2>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto">
              <div className="flex items-center space-x-3 sm:space-x-4 p-2 bg-gray-50 rounded-lg border">
                <span className="text-sm font-medium text-gray-700 pl-2">Status:</span>
                <label className="flex items-center text-sm cursor-pointer">
                  <input type="radio" name="statusFilter" value="ativo" checked={statusFilter === "ativo"} onChange={(e) => setStatusFilter(e.target.value)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <span className="ml-2 text-gray-700">Ativos</span>
                </label>
                <label className="flex items-center text-sm cursor-pointer">
                  <input type="radio" name="statusFilter" value="inativo" checked={statusFilter === "inativo"} onChange={(e) => setStatusFilter(e.target.value)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <span className="ml-2 text-gray-700">Inativos</span>
                </label>
                <label className="flex items-center text-sm cursor-pointer">
                  <input type="radio" name="statusFilter" value="todos" checked={statusFilter === "todos"} onChange={(e) => setStatusFilter(e.target.value)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <span className="ml-2 text-gray-700">Todos</span>
                </label>
              </div>
              
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {linkMessage && (
            <div className="mx-6 mt-4 p-3 bg-gray-50 rounded-lg border">
              {linkMessage}
            </div>
          )}
          <div className="overflow-x-auto">
            {isLoading ? (
              <p className="p-6 text-center text-gray-500">Carregando...</p>
            ) : error ? (
              <p className="p-6 text-center text-red-500">{error}</p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider">
                      Funcionário
                    </th>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">
                            {user.displayName || "(Sem nome)"}
                          </p>
                          {user.status === "ativo" ? (
                            <Tag text="Ativo" color="green" />
                          ) : (
                            <Tag text="Inativo" color="red" />
                          )}
                          {renderLocationTags(user.location)}
                        </div>
                        <p className="text-gray-500 mt-1">{user.email}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => setReportingUser(user)}
                          title="Ver Relatório"
                          className="p-2 text-gray-500 rounded-full hover:bg-blue-100 hover:text-blue-600"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          title="Editar"
                          className="p-2 text-gray-500 rounded-full hover:bg-indigo-100 hover:text-indigo-600"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() =>
                            handleResendPassword(user.uid, user.email)
                          }
                          title="Reenviar Redefinição de Senha"
                          className="p-2 text-gray-500 rounded-full hover:bg-yellow-100 hover:text-yellow-600"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2l-1.5-1.5L6 16v-2h2l1.5-1.5a6 6 0 015.257-5.257"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRemoveUser(user.uid, user.email)}
                          title="Remover"
                          className="p-2 text-gray-500 rounded-full hover:bg-red-100 hover:text-red-600"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      <EditUserModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        user={editingUser}
        onSuccess={handleUpdateSuccess}
      />
    </>
  );
}

export function AdminPanel({ onBack }) {
  const [view, setView] = useState("menu");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (view === "menu") {
      const fetchCount = async () => {
        try {
          const token = await auth.currentUser.getIdToken();
          const response = await fetch("/api/admin/pending-entries", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setPendingCount(data.length);
          } else {
            console.error("Falha ao buscar contagem de pendências.");
            setPendingCount(0);
          }
        } catch (error) {
          console.error("Erro ao buscar contagem de pendências:", error);
          setPendingCount(0);
        }
      };

      fetchCount();
    }
  }, [view]);

  const renderContent = () => {
    switch (view) {
      case "users":
        return <ManageUsersView />;
      case "approvals":
        return <PendingApprovals />;
      case "company":
        return <CompanyProfile />;
      case "kiosks": 
        return <KioskManagement />;
      default:
        return (
          <div className="space-y-6">
            <p className="text-center text-gray-600">
              Selecione uma das opções abaixo para continuar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => setView("approvals")}
                className="relative text-left p-6 bg-white hover:bg-gray-50 rounded-xl shadow-md border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                    {pendingCount}
                  </span>
                )}
                <h3 className="text-lg font-semibold text-gray-800">
                  Aprovações Pendentes
                </h3>
                <p className="text-sm text-gray-500">
                  Valide os registros de ponto atrasados.
                </p>
              </button>

              <button
                onClick={() => setView("users")}
                className="text-left p-6 bg-white hover:bg-gray-50 rounded-xl shadow-md border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  Gerenciar Funcionários
                </h3>
                <p className="text-sm text-gray-500">
                  Adicione, remova, edite e veja relatórios.
                </p>
              </button>
              <button
                onClick={() => setView("company")}
                className="text-left p-6 bg-white hover:bg-gray-50 rounded-xl shadow-md border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  Minha Empresa
                </h3>
                <p className="text-sm text-gray-500">
                  Cadastre os dados e os locais de ponto.
                </p>
              </button>

              <button
                onClick={() => setView("kiosks")}
                className="text-left p-6 bg-white hover:bg-gray-50 rounded-xl shadow-md border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  Gerenciar Kiosks
                </h3>
                <p className="text-sm text-gray-500">
                  Cadastre os terminais de ponto (computadores).
                </p>
              </button>

            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">
          Painel do Administrador
        </h1>
        <button
          onClick={view === "menu" ? onBack : () => setView("menu")}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-2 rounded-lg shadow-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          {view === "menu" ? "Sair do Painel" : "Voltar ao Menu"}
        </button>
      </div>
      {renderContent()}
    </div>
  );
}