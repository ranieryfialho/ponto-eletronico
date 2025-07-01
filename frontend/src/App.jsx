import { useState, useEffect, useMemo } from "react"
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

function App() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [timeHistory, setTimeHistory] = useState([])
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [userStatus, setUserStatus] = useState(STATUS.LOADING)
  const [message, setMessage] = useState("Bem-vindo!")
  const [isLoading, setIsLoading] = useState(false)
  const [isJustificationModalOpen, setIsJustificationModalOpen] = useState(false)
  const [lateEntryLocation, setLateEntryLocation] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult()
        setIsAdmin(tokenResult.claims.admin === true)
      } else {
        setIsAdmin(false)
        setEmployeeProfile(null)
      }
    })
    return () => unsubscribe()
  }, [])

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
      setUserStatus(STATUS.CLOCKED_OUT)
      setTimeHistory([])
      return
    }

    const q = query(collection(db, "timeEntries"), where("userId", "==", user.uid), orderBy("timestamp", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setTimeHistory(entries)

        const lastValidEntry = entries.find((e) => e.status !== "rejeitado")
        if (!lastValidEntry) {
          setUserStatus(STATUS.CLOCKED_OUT)
        } else {
          const lastEntryType = lastValidEntry.type
          if (lastEntryType === ENTRY_TYPES.CLOCK_IN || lastEntryType === ENTRY_TYPES.BREAK_END) {
            setUserStatus(STATUS.WORKING)
          } else if (lastEntryType === ENTRY_TYPES.BREAK_START) {
            setUserStatus(STATUS.ON_BREAK)
          } else if (lastEntryType === ENTRY_TYPES.CLOCK_OUT) {
            setUserStatus(STATUS.CLOCKED_OUT)
          }
        }
      },
      (error) => {
        console.error("Erro ao buscar histórico de ponto:", error)
        toast.error("Não foi possível carregar seu histórico de ponto.")
      },
    )

    return () => unsubscribe()
  }, [user])

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
    setIsLoading(true)
    setMessage("Obtendo localização...")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setMessage("Validando com o servidor...")
        sendDataToServer({ lat: latitude, lon: longitude }, entryType)
      },
      (error) => {
        toast.error("É necessário permitir o acesso à localização.")
        setIsLoading(false)
      },
    )
  }

  const sendDataToServer = async (location, type, justification = null) => {
    setIsLoading(true)
    try {
      const token = await user.getIdToken()
      const response = await fetch("/api/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ location, type, justification }),
      })
      const data = await response.json()
      if (response.status === 422 && data.requiresJustification) {
        setLateEntryLocation(location)
        setIsJustificationModalOpen(true)
        return
      }
      if (!response.ok) throw new Error(data.error || "Ocorreu um erro desconhecido.")
      toast.success(data.success)
      setMessage(`✅ ${data.success}`)
    } catch (error) {
      toast.error(error.message)
      setMessage(`❌ Erro: ${error.message}`)
    } finally {
      if (!isJustificationModalOpen) {
        setIsLoading(false)
      }
    }
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
    if (isLoading) {
      return (
        <button disabled className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg">
          Aguarde...
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
            Carregando status...
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