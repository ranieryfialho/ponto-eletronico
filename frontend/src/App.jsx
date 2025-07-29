import { useState, useEffect, useMemo, useCallback } from "react" // Adicionado useCallback
import { auth, db } from "./firebase-config"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore"
import { Auth } from "./components/Auth"
import { AdminPanel } from "./components/AdminPanel"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { Footer } from "./components/Footer"
import { Disclosure, Transition } from "@headlessui/react"
import { JustificationModal } from "./components/JustificationModal"

const STATUS = {
  LOADING: "carregando...",
  CLOCKED_OUT: "fora_do_expediente",
  WORKING: "trabalhando",
  ON_BREAK: "em_intervalo",
}
const ENTRY_TYPES = {
  CLOCK_IN: "Entrada",
  BREAK_START: "Início do Intervalo",
  BREAK_END: "Fim do Intervalo",
  CLOCK_OUT: "Saída",
}

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

// Funções para gerenciar a fila de registros offline
const getOfflineQueue = () => {
  try {
    const queue = localStorage.getItem('offlineQueue');
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error("Erro ao ler a fila offline:", error);
    return [];
  }
};

const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
  } catch (error) {
    console.error("Erro ao salvar a fila offline:", error);
  }
};
// Fim das funções da fila

function App() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [timeHistory, setTimeHistory] = useState([])
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [userStatus, setUserStatus] = useState(STATUS.LOADING)
  const [message, setMessage] = useState("Conectando...")
  const [isLoading, setIsLoading] = useState(false)
  const [isJustificationModalOpen, setIsJustificationModalOpen] = useState(false)
  const [lateEntryLocation, setLateEntryLocation] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [lastEntryTimestamp, setLastEntryTimestamp] = useState(null);
  const [timeToWait, setTimeToWait] = useState(0);

  // Estado para a fila de registros pendentes
  const [offlineQueue, setOfflineQueue] = useState(getOfflineQueue());
  // NOVO: Estado para controlar se a sincronização está em andamento
  const [isSyncing, setIsSyncing] = useState(false);


  const sendDataToServer = useCallback(async (location, type, justification = null, isOfflineSync = false, offlinePunch = null) => {
    // Para evitar múltiplas submissões enquanto uma já está em andamento
    if (!isOfflineSync) setIsLoading(true);

    const punchData = offlinePunch || {
      id: `offline-${Date.now()}`,
      type,
      location,
      justification,
      timestamp: new Date().toISOString(),
    };

    try {
      // Se não for uma sincronização, checa se está online antes de tentar.
      if (!navigator.onLine && !isOfflineSync) {
        throw new Error("Offline. O registro será salvo localmente.");
      }

      const token = await user.getIdToken();
      const response = await fetch("/api/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(punchData),
      });

      const data = await response.json();

      if (response.status === 422 && data.requiresJustification) {
        setLateEntryLocation(location);
        setIsJustificationModalOpen(true);
        return { success: false, needsJustification: true }; 
      }

      if (!response.ok) throw new Error(data.error || "Ocorreu um erro desconhecido.");

      if (!isOfflineSync) {
        toast.success(data.success);
        setMessage(`✅ ${data.success}`);
      }
      
      return { success: true, punchId: punchData.id };

    } catch (error) {
      if (!isOfflineSync) {
        const newQueue = [...getOfflineQueue(), punchData];
        saveOfflineQueue(newQueue);
        setOfflineQueue(newQueue);
        toast.warn(`Você está offline. Seu registro de ${type} foi salvo e será enviado assim que a conexão voltar.`);
        setMessage(`🕒 Registro de ${type} salvo localmente.`);
      } else {
        console.error(`Falha ao sincronizar o registro ${punchData.id}:`, error.message);
      }
      return { success: false, punchId: punchData.id };
    } finally {
      if (!isJustificationModalOpen && !isOfflineSync) {
        setIsLoading(false);
      }
    }
  }, [user, isJustificationModalOpen]); // Adiciona dependências ao useCallback

  // NOVO: Função para sincronizar a fila
  const syncOfflineQueue = useCallback(async () => {
    if (isSyncing || !navigator.onLine || !user) return; // Não sincroniza se já estiver sincronizando, offline ou deslogado

    let queue = getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    toast.info(`Sincronizando ${queue.length} registro(s) pendente(s)...`);

    for (const punch of queue) {
      const result = await sendDataToServer(punch.location, punch.type, punch.justification, true, punch);
      
      if (result.success) {
        // Se sucesso, remove o item da fila
        let currentQueue = getOfflineQueue();
        let updatedQueue = currentQueue.filter(p => p.id !== punch.id);
        saveOfflineQueue(updatedQueue);
        setOfflineQueue(updatedQueue); // Atualiza o estado
      }
    }

    const finalQueue = getOfflineQueue();
    if (finalQueue.length === 0) {
      toast.success("Todos os registros foram sincronizados com sucesso!");
    } else {
      toast.warn(`${finalQueue.length} registro(s) não puderam ser sincronizados. Tentaremos novamente mais tarde.`);
    }

    setIsSyncing(false);
  }, [user, isSyncing, sendDataToServer]);


  useEffect(() => {
    if (timeToWait > 0) {
      const timer = setTimeout(() => {
        setTimeToWait(prev => prev - 1000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeToWait]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult()
        setIsAdmin(tokenResult.claims.admin === true)
        // NOVO: Tenta sincronizar ao carregar a página se estiver online
        if (navigator.onLine) {
            syncOfflineQueue();
        }
      } else {
        setIsAdmin(false)
        setEmployeeProfile(null)
      }
    })
    return () => unsubscribe()
  }, [syncOfflineQueue]) // Adiciona syncOfflineQueue às dependências

  // NOVO: Listeners de status da conexão
  useEffect(() => {
    const goOnline = () => syncOfflineQueue();
    const goOffline = () => toast.warn("Conexão perdida. Os registros serão salvos localmente.");

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
    };
  }, [syncOfflineQueue]); // Adiciona syncOfflineQueue às dependências

  useEffect(() => {
    if (!user) {
      setEmployeeProfile(null)
      return
    }

    const fetchProfile = async () => {
      setProfileLoading(true)
      try {
        const token = await auth.currentUser.getIdToken()
        const response = await fetch(`/api/admin/employees/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const profileData = await response.json()
          setEmployeeProfile(profileData)
        } else {
          console.error("Falha ao buscar perfil do funcionário. Status:", response.status)
          setEmployeeProfile({ workHours: null })
        }
      } catch (error) {
        console.error("Erro ao buscar perfil:", error)
        setEmployeeProfile({ workHours: null })
      } finally {
        setProfileLoading(false)
      }
    }

    fetchProfile()
  }, [user])

  useEffect(() => {
    if (!user) {
      setUserStatus(STATUS.CLOCKED_OUT);
      setTimeHistory([]);
      setMessage("Por favor, faça o login.");
      return;
    }

    setUserStatus(STATUS.LOADING);
    setMessage("Buscando seu último registro...");

    const q = query(
        collection(db, "timeEntries"),
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setTimeHistory(entries);

        const lastValidEntry = entries.find((e) => e.status !== "rejeitado");
        let newStatus = STATUS.CLOCKED_OUT;
        let newMessage = "Pronto para iniciar o expediente!"; 

        if (lastValidEntry) {
          setLastEntryTimestamp(lastValidEntry.timestamp.seconds * 1000);
          const lastEntryType = lastValidEntry.type;
          
          if (lastEntryType === ENTRY_TYPES.CLOCK_IN || lastEntryType === ENTRY_TYPES.BREAK_END) {
            newStatus = STATUS.WORKING;
            newMessage = "Em expediente. Bom trabalho!";
          } else if (lastEntryType === ENTRY_TYPES.BREAK_START) {
            newStatus = STATUS.ON_BREAK;
            newMessage = "Em intervalo.";
          } else if (lastEntryType === ENTRY_TYPES.CLOCK_OUT) {
            newStatus = STATUS.CLOCKED_OUT;
            newMessage = "Expediente encerrado. Até a próxima!";
          }
        } else {
            setLastEntryTimestamp(null);
        }
        
        setUserStatus(newStatus);
        setMessage(newMessage);
      },
      (error) => {
        console.error("Erro ao buscar histórico de ponto:", error);
        toast.error("Não foi possível carregar seu histórico de ponto.");
        setUserStatus(STATUS.CLOCKED_OUT);
        setMessage("❌ Erro ao buscar histórico.");
      },
    );

    return () => unsubscribe();
  }, [user]);

  const groupedHistory = useMemo(() => {
    if (timeHistory.length === 0) return {}

    return timeHistory.reduce((acc, entry) => {
      const entryDate = new Date(entry.timestamp.seconds * 1000)
      const monthYear = entryDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      const day = entryDate.toLocaleDateString("pt-BR")

      if (!acc[monthYear]) {
        acc[monthYear] = { days: {} }
      }
      if (!acc[monthYear].days[day]) {
        acc[monthYear].days[day] = []
      }

      acc[monthYear].days[day].push(entry)
      return acc
    }, {})
  }, [timeHistory])

  const handleRegister = (entryType) => {
    if (navigator.connection && navigator.connection.rtt > 300) {
        toast.warn("Seu sinal de Wi-Fi parece fraco. Por favor, aproxime-se do roteador ou verifique sua conexão antes de registrar o ponto.");
        return;
    }
    
    if (lastEntryTimestamp) {
      const now = new Date().getTime();
      const diff = now - lastEntryTimestamp;
      if (diff < TEN_MINUTES_IN_MS) {
        const remaining = TEN_MINUTES_IN_MS - diff;
        setTimeToWait(remaining);
        toast.error(`Aguarde ${Math.ceil(remaining / 1000)} segundos para registrar novamente.`);
        return;
      }
    }
    setIsLoading(true)
    setMessage("Obtendo localização...")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setMessage("Validando com o servidor...")
        sendDataToServer({ lat: latitude, lon: longitude }, entryType)
      },
      (error) => {
        toast.warn("Não foi possível obter a localização. O registro será salvo para envio posterior.");
        sendDataToServer({ lat: null, lon: null }, entryType);
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  const handleSubmitJustification = async (justification) => {
    await sendDataToServer(lateEntryLocation, "Entrada", justification)
    setIsJustificationModalOpen(false)
    setLateEntryLocation(null)
    setIsLoading(false)
  }

  const handleLogout = () => {
    signOut(auth)
  }

  const renderActionButtons = () => {
    if (timeToWait > 0) {
      return (
        <button disabled className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg">
          Aguarde... ({Math.ceil(timeToWait / 1000)}s)
        </button>
      );
    }
    if (isLoading || isSyncing) { // NOVO: Desabilita botões durante a sincronização
      return (
        <button disabled className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg">
          {isSyncing ? 'Sincronizando...' : 'Aguarde...'}
        </button>
      )
    }
    switch (userStatus) {
      case STATUS.CLOCKED_OUT:
        return (
          <button
            onClick={() => handleRegister(ENTRY_TYPES.CLOCK_IN)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-sm transition-colors"
          >
            ▶️ Iniciar Expediente
          </button>
        )
      case STATUS.WORKING:
        return (
          <div className="flex gap-4">
            <button
              onClick={() => handleRegister(ENTRY_TYPES.BREAK_START)}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg shadow-sm transition-colors"
            >
              ⏸️ Iniciar Intervalo
            </button>
            <button
              onClick={() => handleRegister(ENTRY_TYPES.CLOCK_OUT)}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg shadow-sm transition-colors"
            >
              ⏹️ Encerrar Expediente
            </button>
          </div>
        )
      case STATUS.ON_BREAK:
        return (
          <button
            onClick={() => handleRegister(ENTRY_TYPES.BREAK_END)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-sm transition-colors"
          >
            ▶️ Retornar do Intervalo
          </button>
        )
      default:
        return (
          <button disabled className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg">
            Verificando status...
          </button>
        )
    }
  }

  const renderMainContent = () => {
    if (showAdminPanel) {
      return <AdminPanel onBack={() => setShowAdminPanel(false)} />
    }

    return (
      <div className="w-full max-w-md">
        <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200">
          <p className="mb-4 capitalize text-xl text-center font-bold text-gray-800">
            Bem-vindo, {user.displayName || user.email}! 👋
          </p>

          {/* Indicador de Fila Offline */}
          {offlineQueue.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-center animate-pulse">
                <p className="text-sm font-semibold text-orange-700">
                  {offlineQueue.length} {offlineQueue.length === 1 ? 'registro pendente' : 'registros pendentes'} de sincronização.
                </p>
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="w-full mb-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors"
            >
              Painel do Administrador
            </button>
          )}

          <div className="text-lg text-gray-700 mb-6 p-4 h-20 flex items-center justify-center bg-gray-50 rounded-lg border">
            {message}
          </div>

          <div className="space-y-4">{renderActionButtons()}</div>

          <button
            onClick={handleLogout}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sair
          </button>
        </div>

        {Object.keys(groupedHistory).length > 0 && (
          <div className="mt-8 w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Seu Histórico de Ponto</h2>

            {profileLoading && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-sm">Carregando informações do perfil...</p>
              </div>
            )}

            <div className="w-full rounded-2xl bg-white p-2 space-y-2 shadow-lg border border-gray-200">
              {Object.entries(groupedHistory).map(([monthYear, monthData]) => {
                return (
                  <Disclosure key={monthYear} as="div" className="w-full">
                    {({ open }) => (
                      <>
                        <Disclosure.Button className="flex w-full justify-between items-center rounded-lg bg-blue-100 px-4 py-3 text-left text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring focus-visible:ring-blue-500/75 transition-colors">
                          <span className="capitalize font-semibold">{monthYear}</span>
                          <div className="flex items-center gap-2 sm:gap-4">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-5 w-5 text-blue-500 transition-transform ${open ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </Disclosure.Button>
                        <Transition
                          enter="transition duration-100 ease-out"
                          enterFrom="transform scale-95 opacity-0"
                          enterTo="transform scale-100 opacity-100"
                          leave="transition duration-75 ease-out"
                          leaveFrom="transform scale-100 opacity-100"
                          leaveTo="transform scale-95 opacity-0"
                        >
                          <Disclosure.Panel className="px-2 sm:px-4 pt-4 pb-2 text-sm text-gray-600 space-y-4">
                            {Object.entries(monthData.days)
                              .sort(
                                ([dayA], [dayB]) =>
                                  new Date(dayB.split("/").reverse().join("-")) -
                                  new Date(dayA.split("/").reverse().join("-")),
                              )
                              .map(([day, entries]) => (
                                <div key={day}>
                                  <h4 className="text-left font-semibold text-gray-800 bg-gray-100 p-2 rounded-t-lg border-b">
                                    {day}
                                  </h4>
                                  <ul className="bg-white rounded-b-lg text-left overflow-hidden">
                                    {entries
                                      .sort((a, b) => a.timestamp.seconds - b.timestamp.seconds)
                                      .map((entry) => {
                                        const isRejected = entry.status === "rejeitado"
                                        return (
                                          <li
                                            key={entry.id}
                                            className={`px-3 py-2 border-b border-gray-100 last:border-b-0 ${isRejected ? "bg-red-50" : ""}`}
                                          >
                                            <div className="flex justify-between items-center">
                                              <span
                                                className={`font-medium text-gray-700 text-sm ${isRejected ? "line-through text-red-500" : ""}`}
                                              >
                                                {entry.type}
                                              </span>
                                              <span
                                                className={`text-sm text-gray-500 font-mono ${isRejected ? "line-through text-red-500" : ""}`}
                                              >
                                                {new Date(entry.timestamp.seconds * 1000).toLocaleTimeString("pt-BR")}
                                              </span>
                                            </div>
                                            {isRejected && entry.rejectionReason && (
                                              <p className="text-xs text-red-700 mt-1 pl-1">
                                                Motivo: {entry.rejectionReason}
                                              </p>
                                            )}
                                            {entry.justification && (
                                              <p className="text-xs text-blue-700 mt-1 pl-1">
                                                Justificativa: {entry.justification}
                                              </p>
                                            )}
                                          </li>
                                        )
                                      })}
                                  </ul>
                                </div>
                              ))}
                          </Disclosure.Panel>
                        </Transition>
                      </>
                    )}
                  </Disclosure>
                )
              })}
            </div>

          </div>
        )}

        {timeHistory.length === 0 && (
          <div className="mt-8 w-full">
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-600">Nenhum registro de ponto encontrado ainda.</p>
              <p className="text-sm text-gray-500 mt-2">Seus registros aparecerão aqui após o primeiro ponto.</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <JustificationModal
        isOpen={isJustificationModalOpen}
        onClose={() => {
          setIsJustificationModalOpen(false)
          setIsLoading(false)
        }}
        onSubmit={handleSubmitJustification}
      />
      <div className="min-h-screen flex flex-col bg-gray-50">
        <main className="flex-grow flex flex-col items-center justify-center p-4">
          {!user ? <Auth /> : renderMainContent()}
        </main>
        <Footer />
      </div>
    </>
  )
}

export default App