import { useState, useEffect, useMemo, useCallback } from "react";
import { auth, db } from "./firebase-config";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { Auth } from "./components/Auth";
import { AdminPanel } from "./components/AdminPanel";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Footer } from "./components/Footer";
import { Disclosure, Transition } from "@headlessui/react";
import { JustificationModal } from "./components/JustificationModal";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { MySchedule } from "./components/MySchedule";
import { KioskAuthorizationModal } from "./components/KioskAuthorizationModal";

const STATUS = {
  LOADING: "carregando...",
  CLOCKED_OUT: "fora_do_expediente",
  WORKING: "trabalhando",
  ON_BREAK: "em_intervalo",
};
const ENTRY_TYPES = {
  CLOCK_IN: "Entrada",
  BREAK_START: "Início do Intervalo",
  BREAK_END: "Fim do Intervalo",
  CLOCK_OUT: "Saída",
};

const REGISTRATION_COOLDOWN_MS = 1 * 60 * 1000;
const ALLOWED_RADIUS_METERS = 200;

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null)
    return Infinity;
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const getOfflineQueue = () => {
  try {
    const queue = localStorage.getItem("offlineQueue");
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error("Erro ao ler a fila offline:", error);
    return [];
  }
};

const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem("offlineQueue", JSON.stringify(queue));
  } catch (error) {
    console.error("Erro ao salvar a fila offline:", error);
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [timeHistory, setTimeHistory] = useState([]);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [userStatus, setUserStatus] = useState(STATUS.LOADING);
  const [message, setMessage] = useState("Conectando...");
  const [isLoading, setIsLoading] = useState(false);
  const [isJustificationModalOpen, setIsJustificationModalOpen] =
    useState(false);
  const [lateEntryLocation, setLateEntryLocation] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [lastEntryTimestamp, setLastEntryTimestamp] = useState(null);
  const [timeToWait, setTimeToWait] = useState(0);

  const [offlineQueue, setOfflineQueue] = useState(getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentView, setCurrentView] = useState("punch");

  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState(null);

  const [kioskToken, setKioskToken] = useState(() =>
    localStorage.getItem("kioskToken") || null
  );

  const [isKioskModalOpen, setIsKioskModalOpen] = useState(false);

  const sendDataToServer = useCallback(
    async (
      location, 
      type,
      justification = null,
      kioskToken = null, 
      isOfflineSync = false,
      offlinePunch = null
    ) => {
      if (!isOfflineSync) setIsLoading(true);

      let punchData = {
        type,
        location,
        kioskToken,
        justification,
      };

      if (isOfflineSync && offlinePunch) {
        punchData = offlinePunch;
      } else if (!navigator.onLine) {
        punchData.id = `offline-${Date.now()}`;
        punchData.timestamp = new Date().toISOString();
      }

      try {
        if (!navigator.onLine && !isOfflineSync) {
          throw new Error("Offline. O registro será salvo localmente.");
        }

        const token = await user.getIdToken();
        const response = await fetch("/api/clock-in", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(punchData),
        });

        const data = await response.json();

        if (response.status === 422 && data.requiresJustification && !kioskToken) {
          setLateEntryLocation(location);
          setIsJustificationModalOpen(true);
          return { success: false, status: 422, error: data.error };
        }

        if (!response.ok) {
          throw {
            status: response.status,
            message: data.error || "Ocorreu um erro desconhecido.",
          };
        }

        if (!isOfflineSync) {
          toast.success(data.success);
          setMessage(`✅ ${data.success}`);
        }

        return { success: true, punchId: isOfflineSync ? punchData.id : null };
      } catch (error) {
        if (error && error.status) {
          if (!isOfflineSync) {
            toast.error(error.message || "O servidor rejeitou o registro.");
            setMessage(`❌ ${error.message || "Registro rejeitado."}`);
          }
          return { success: false, status: error.status, error: error.message };
        }

        if (!isOfflineSync) {
          const newQueue = [...getOfflineQueue(), punchData];
          saveOfflineQueue(newQueue);
          setOfflineQueue(newQueue);
          toast.warn(
            `Você está offline. Seu registro de ${type} foi salvo e será enviado assim que a conexão voltar.`
          );
          setMessage(`🕒 Registro de ${type} salvo localmente.`);
          return { success: false, offline: true, error: error.message };
        } else {
          return {
            success: false,
            status: 500,
            error: error.message || "Falha de conexão ao sincronizar.",
          };
        }
      } finally {
        if (!isJustificationModalOpen && !isOfflineSync) {
          setIsLoading(false);
        }
      }
    },
    [user, isJustificationModalOpen] 
  );

  const syncOfflineQueue = useCallback(async () => {
    if (isSyncing || !navigator.onLine || !user) return;

    let queue = getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    toast.info(`Sincronizando ${queue.length} registro(s) pendente(s)...`);

    let successfullySynced = 0;
    const punchesToRemove = [];
    const syncErrors = [];

    for (const punch of queue) {
      const result = await sendDataToServer(
        punch.location,
        punch.type,
        punch.justification,
        punch.kioskToken, 
        true,
        punch
      );

      if (result.success) {
        successfullySynced++;
        punchesToRemove.push(punch.id);
      } else {
        if (result.status >= 400 && result.status < 500) {
          punchesToRemove.push(punch.id);
          syncErrors.push(
            `Registro de '${punch.type}' foi descartado. Motivo: ${result.error}`
          );
        }
      }
    }

    if (punchesToRemove.length > 0) {
      let currentQueue = getOfflineQueue();
      let updatedQueue = currentQueue.filter(
        (p) => !punchesToRemove.includes(p.id)
      );
      saveOfflineQueue(updatedQueue);
      setOfflineQueue(updatedQueue);
    }

    if (syncErrors.length > 0) {
      syncErrors.forEach((errorMsg) =>
        toast.error(errorMsg, { autoClose: 10000 })
      );
    }
    if (successfullySynced > 0) {
      toast.success(
        `${successfullySynced} registro(s) foram sincronizados com sucesso!`
      );
    }

    setIsSyncing(false);
  }, [user, isSyncing, sendDataToServer]);

  useEffect(() => {
    if (timeToWait > 0) {
      const timer = setTimeout(() => {
        setTimeToWait((prev) => prev - 1000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeToWait]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult();
        setIsAdmin(tokenResult.claims.admin === true);
        if (navigator.onLine) {
          syncOfflineQueue();
        }
      } else {
        setIsAdmin(false);
        setEmployeeProfile(null);
      }
    });
    return () => unsubscribe();
  }, [syncOfflineQueue]);

  useEffect(() => {
    const goOnline = () => syncOfflineQueue();
    const goOffline = () =>
      toast.warn("Conexão perdida. Os registros serão salvos localmente.");

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncOfflineQueue]);

  useEffect(() => {
    if (!user) {
      setEmployeeProfile(null);
      return;
    }

    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`/api/admin/employees/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const profileData = await response.json();
          setEmployeeProfile(profileData);
        } else {
          console.error(
            "Falha ao buscar perfil do funcionário. Status:",
            response.status
          );
          setEmployeeProfile({ workHours: null });
        }
      } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        setEmployeeProfile({ workHours: null });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

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
        const entries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTimeHistory(entries);

        const lastValidEntry = entries.find((e) => e.status !== "rejeitado");
        let newStatus = STATUS.CLOCKED_OUT;
        let newMessage = kioskToken 
          ? "Kiosk pronto para registro." 
          : "Pronto para iniciar o expediente!";

        if (lastValidEntry) {
          setLastEntryTimestamp(lastValidEntry.timestamp.seconds * 1000);
          const lastEntryType = lastValidEntry.type;

          if (
            lastEntryType === ENTRY_TYPES.CLOCK_IN ||
            lastEntryType === ENTRY_TYPES.BREAK_END
          ) {
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
      }
    );

    return () => unsubscribe();
  }, [user, kioskToken]); 

  const groupedHistory = useMemo(() => {
    if (timeHistory.length === 0) return {};

    return timeHistory.reduce((acc, entry) => {
      const entryDate = new Date(entry.timestamp.seconds * 1000);
      const monthYear = entryDate.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      const day = entryDate.toLocaleDateString("pt-BR");

      if (!acc[monthYear]) {
        acc[monthYear] = { days: {} };
      }
      if (!acc[monthYear].days[day]) {
        acc[monthYear].days[day] = [];
      }

      acc[monthYear].days[day].push(entry);
      return acc;
    }, {});
  }, [timeHistory]);

  const handleRegister = (entryType) => {
    const messages = {
      [ENTRY_TYPES.CLOCK_IN]: {
        title: "Confirmar Entrada",
        message: "Você tem certeza que deseja iniciar o expediente?",
      },
      [ENTRY_TYPES.BREAK_START]: {
        title: "Confirmar Pausa",
        message: "Você tem certeza que deseja iniciar a pausa?",
      },
      [ENTRY_TYPES.BREAK_END]: {
        title: "Confirmar Retorno",
        message: "Você tem certeza que deseja retornar do intervalo?",
      },
      [ENTRY_TYPES.CLOCK_OUT]: {
        title: "Confirmar Saída",
        message: "Você tem certeza que deseja encerrar o expediente?",
      },
    };

    setConfirmationAction({ type: entryType, ...messages[entryType] });
    setIsConfirmationModalOpen(true);
  };

  const executeRegistration = () => {
    if (!confirmationAction) return;
    const entryType = confirmationAction.type;

    if (!employeeProfile || !employeeProfile.companyAddresses) {
      toast.error(
        "Dados da empresa ainda não foram carregados. Tente novamente em alguns segundos."
      );
      return;
    }

    if (lastEntryTimestamp) {
      const now = new Date().getTime();
      const diff = now - lastEntryTimestamp;
      
      if (diff < REGISTRATION_COOLDOWN_MS) {
        const remaining = REGISTRATION_COOLDOWN_MS - diff;
        setTimeToWait(remaining);
        toast.error(
          `Aguarde ${Math.ceil(
            remaining / 1000
          )} segundos para registrar novamente.`
        );
        return;
      }
    }

    if (kioskToken) {
      setIsLoading(true);
      setMessage("Enviando registro do Kiosk...");
      sendDataToServer(null, entryType, null, kioskToken);
      return; 
    }
    
    setIsLoading(true);
    setMessage("Obtendo localização...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userLocation = { lat: latitude, lon: longitude };

        const allowedLocations = employeeProfile.allowedLocations || [];

        if (!allowedLocations.includes("externo")) {
          const companyAddresses = employeeProfile.companyAddresses || [];

          const addressesToCheck = companyAddresses.filter((addr) =>
            allowedLocations.includes(addr.name)
          );

          if (addressesToCheck.length === 0) {
            toast.error(
              "Você não tem permissão para registrar o ponto em nenhum local. Contate o administrador."
            );
            setIsLoading(false);
            setMessage("Falha na validação de local.");
            return;
          }

          let isWithinRange = false;
          let closestDistance = Infinity;

          for (const address of addressesToCheck) {
            if (address.location) {
              const distance = getDistanceInMeters(
                userLocation.lat,
                userLocation.lon,
                address.location.lat,
                address.location.lon
              );
              if (distance < closestDistance) {
                closestDistance = distance;
              }
              if (distance <= ALLOWED_RADIUS_METERS) {
                isWithinRange = true;
                break;
              }
            }
          }

          if (!isWithinRange) {
            toast.error(
              `Você está fora do raio permitido. O local mais próximo está a ${closestDistance.toFixed(
                0
              )}m.`
            );
            setIsLoading(false);
            setMessage("Falha na validação de local.");
            return;
          }
        }

        setMessage("Localização validada. Enviando registro...");
        sendDataToServer(userLocation, entryType, null, null);
      },
      (error) => {
        const allowedLocations = employeeProfile.allowedLocations || [];
        if (allowedLocations.includes("externo")) {
          toast.warn(
            "Não foi possível obter a localização. Registrando como externo."
          );
          sendDataToServer({ lat: null, lon: null }, entryType, null, null);
        } else {
          toast.error(
            "Falha ao obter localização. Verifique as permissões do navegador."
          );
          setIsLoading(false);
          setMessage("Falha ao obter localização.");
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleConfirmAction = () => {
    setIsConfirmationModalOpen(false);
    
    if (!confirmationAction) return;

    if (confirmationAction.type === 'DEAUTHORIZE_KIOSK') {
      try {
        localStorage.removeItem('kioskToken');
        setKioskToken(null);
        toast.warn('Kiosk desautorizado.');
        setMessage('Pronto para iniciar o expediente!');
      } catch (err) {
        toast.error('Falha ao desautorizar.');
      }
    } else {
      executeRegistration();
    }
    
    setConfirmationAction(null); 
  };

  const handleSubmitJustification = async (justification) => {
    await sendDataToServer(lateEntryLocation, "Entrada", justification, null);
    setIsJustificationModalOpen(false);
    setLateEntryLocation(null);
    setIsLoading(false);
  };

  const handleLogout = () => {
    signOut(auth);
    setCurrentView("punch");
  };

  const handleAuthorizeKiosk = () => {
    setIsKioskModalOpen(true);
  };

  const handleSubmitKioskToken = (token) => {
    try {
      localStorage.setItem('kioskToken', token.trim());
      setKioskToken(token.trim()); 
      toast.success('Kiosk autorizado com sucesso!');
      setMessage('Kiosk autorizado. Pronto para registro.');
      setIsKioskModalOpen(false); 
    } catch (err) {
      toast.error('Não foi possível salvar o token. Verifique as permissões do navegador.');
    }
  };

  const handleDeauthorizeKiosk = () => {
    setConfirmationAction({
      type: 'DEAUTHORIZE_KIOSK',
      title: 'Desautorizar Kiosk',
      message: 'Tem certeza que deseja desautorizar este computador como um Kiosk?'
    });
    setIsConfirmationModalOpen(true);
  };

  const renderActionButtons = () => {
    if (timeToWait > 0) {
      return (
        <button
          disabled
          className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
        >
          Aguarde... ({Math.ceil(timeToWait / 1000)}s)
        </button>
      );
    }
    if (isLoading || isSyncing) {
      return (
        <button
          disabled
          className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
        >
          {isSyncing ? "Sincronizando..." : "Aguarde..."}
        </button>
      );
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
        );
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
        );
      case STATUS.ON_BREAK:
        return (
          <button
            onClick={() => handleRegister(ENTRY_TYPES.BREAK_END)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-sm transition-colors"
          >
            ▶️ Retornar do Intervalo
          </button>
        );
      default:
        return (
          <button
            disabled
            className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
          >
            Verificando status...
          </button>
        );
    }
  };

  const renderMainContent = () => {
    if (showAdminPanel) {
      return <AdminPanel onBack={() => setShowAdminPanel(false)} />;
    }

    if (currentView === "schedule" && employeeProfile) {
      return (
        <MySchedule
          workHours={employeeProfile.workHours}
          onBack={() => setCurrentView("punch")}
        />
      );
    }

    return (
      <div className="w-full max-w-md">
        <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200">
          <p className="mb-4 capitalize text-xl text-center font-bold text-gray-800">
            Bem-vindo, {user.displayName || user.email}! 👋
          </p>

          {kioskToken && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-sm font-semibold text-blue-700">
                Este terminal está autorizado como Kiosk.
              </p>
            </div>
          )}

          {offlineQueue.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-center animate-pulse">
              <p className="text-sm font-semibold text-orange-700">
                {offlineQueue.length}{" "}
                {offlineQueue.length === 1
                  ? "registro pendente"
                  : "registros pendentes"}{" "}
                de sincronização.
              </p>
            </div>
          )}

          <div className="space-y-2 mb-4">
            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors"
              >
                Painel do Administrador
              </button>
            )}

            <button
              onClick={() => setCurrentView("schedule")}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors"
            >
              Ver Minha Jornada de Trabalho
            </button>
          </div>

          <div className="text-lg text-gray-700 mb-6 p-4 h-20 flex items-center justify-center bg-gray-50 rounded-lg border">
            {message}
          </div>

          <div className="space-y-4">{renderActionButtons()}</div>

          <button
            onClick={handleLogout}
            className="w-full mt-6 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
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

          {isAdmin && (
            <div className="mt-8 border-t pt-6">
              {!kioskToken ? (
                <button
                  type="button"
                  onClick={handleAuthorizeKiosk} 
                  className="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors shadow-sm border border-gray-300"
                >
                  Autorizar este Kiosk
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeauthorizeKiosk}
                  className="w-full text-sm bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 px-4 rounded-lg transition-colors shadow-sm border border-red-300"
                >
                  Desautorizar este Kiosk
                </button>
              )}
            </div>
          )}

        </div>

        {Object.keys(groupedHistory).length > 0 && (
          <div className="mt-8 w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Seu Histórico de Ponto
            </h2>

            {profileLoading && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-sm">
                  Carregando informações do perfil...
                </p>
              </div>
            )}

            <div className="w-full rounded-2xl bg-white p-2 space-y-2 shadow-lg border border-gray-200">
              {Object.entries(groupedHistory).map(([monthYear, monthData]) => {
                return (
                  <Disclosure key={monthYear} as="div" className="w-full">
                    {({ open }) => (
                      <>
                        <Disclosure.Button className="flex w-full justify-between items-center rounded-lg bg-blue-100 px-4 py-3 text-left text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring focus-visible:ring-blue-500/75 transition-colors">
                          <span className="capitalize font-semibold">
                            {monthYear}
                          </span>
                          <div className="flex items-center gap-2 sm:gap-4">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-5 w-5 text-blue-500 transition-transform ${
                                open ? "rotate-180" : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
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
                                  new Date(
                                    dayB.split("/").reverse().join("-")
                                  ) -
                                  new Date(dayA.split("/").reverse().join("-"))
                              )
                              .map(([day, entries]) => (
                                <div key={day}>
                                  <h4 className="text-left font-semibold text-gray-800 bg-gray-100 p-2 rounded-t-lg border-b">
                                    {day}
                                  </h4>
                                  <ul className="bg-white rounded-b-lg text-left overflow-hidden">
                                    {entries
                                      .sort(
                                        (a, b) =>
                                          a.timestamp.seconds -
                                          b.timestamp.seconds
                                      )
                                      .map((entry) => {
                                        const isRejected =
                                          entry.status === "rejeitado";
                                        return (
                                          <li
                                            key={entry.id}
                                            className={`px-3 py-2 border-b border-gray-100 last:border-b-0 ${
                                              isRejected ? "bg-red-50" : ""
                                            }`}
                                          >
                                            <div className="flex justify-between items-center">
                                              <span
                                                className={`font-medium text-gray-700 text-sm ${
                                                  isRejected
                                                    ? "line-through text-red-500"
                                                    : ""
                                                }`}
                                              >
                                                {entry.type}
                                              </span>
                                              <span
                                                className={`text-sm text-gray-500 font-mono ${
                                                  isRejected
                                                    ? "line-through text-red-500"
                                                    : ""
                                                }`}
                                              >
                                                {new Date(
                                                  entry.timestamp.seconds * 1000
                                                ).toLocaleTimeString("pt-BR")}
                                              </span>
                                            </div>
                                            {isRejected &&
                                              entry.rejectionReason && (
                                                <p className="text-xs text-red-700 mt-1 pl-1">
                                                  Motivo:{" "}
                                                  {entry.rejectionReason}
                                                </p>
                                              )}
                                            {entry.justification && (
                                              <p className="text-xs text-blue-700 mt-1 pl-1">
                                                Justificativa:{" "}
                                                {entry.justification}
                                              </p>
                                            )}
                                          </li>
                                        );
                                      })}
                                  </ul>
                                </div>
                              ))}
                          </Disclosure.Panel>
                        </Transition>
                      </>
                    )}
                  </Disclosure>
                );
              })}
            </div>
          </div>
        )}

        {timeHistory.length === 0 && (
          <div className="mt-8 w-full">
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-600">
                Nenhum registro de ponto encontrado ainda.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Seus registros aparecerão aqui após o primeiro ponto.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

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
          setIsJustificationModalOpen(false);
          setIsLoading(false);
        }}
        onSubmit={handleSubmitJustification}
      />
      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        onConfirm={handleConfirmAction}
        title={confirmationAction?.title || "Confirmar Ação"}
        message={confirmationAction?.message || "Você tem certeza?"}
      />
      
      <KioskAuthorizationModal
        isOpen={isKioskModalOpen}
        onClose={() => setIsKioskModalOpen(false)}
        onSubmit={handleSubmitKioskToken}
      />

      <div className="min-h-screen flex flex-col bg-gray-50">
        <main className="flex-grow flex flex-col items-center justify-center p-4">
          {!user ? <Auth /> : renderMainContent()}
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;