import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase-config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Auth } from './components/Auth';
import { AdminPanel } from './components/AdminPanel';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const STATUS = {
  LOADING: 'carregando...',
  CLOCKED_OUT: 'fora_do_expediente',
  WORKING: 'trabalhando',
  ON_BREAK: 'em_intervalo',
};

const ENTRY_TYPES = {
  CLOCK_IN: 'Entrada',
  BREAK_START: 'Início do Intervalo',
  BREAK_END: 'Fim do Intervalo',
  CLOCK_OUT: 'Saída',
};

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [timeHistory, setTimeHistory] = useState([]);
  const [userStatus, setUserStatus] = useState(STATUS.LOADING);
  const [message, setMessage] = useState("Bem-vindo!");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult();
        setIsAdmin(tokenResult.claims.admin === true);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserStatus(STATUS.CLOCKED_OUT);
      setTimeHistory([]);
      return;
    }
    const q = query(collection(db, "timeEntries"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTimeHistory(entries);
      if (entries.length === 0) {
        setUserStatus(STATUS.CLOCKED_OUT);
      } else {
        const lastEntryType = entries[0].type;
        if (lastEntryType === ENTRY_TYPES.CLOCK_IN || lastEntryType === ENTRY_TYPES.BREAK_END) {
          setUserStatus(STATUS.WORKING);
        } else if (lastEntryType === ENTRY_TYPES.BREAK_START) {
          setUserStatus(STATUS.ON_BREAK);
        } else if (lastEntryType === ENTRY_TYPES.CLOCK_OUT) {
          setUserStatus(STATUS.CLOCKED_OUT);
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleRegister = (entryType) => {
    setIsLoading(true);
    setMessage("Obtendo localização...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMessage("Validando com o servidor...");
        sendDataToServer({ lat: latitude, lon: longitude }, entryType);
      },
      (error) => {
        setMessage("Erro ao obter localização.");
        setIsLoading(false);
      }
    );
  };

  const sendDataToServer = async (location, type) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch('http://localhost:3001/api/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ location, type }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`✅ ${data.success}`);
    } catch (error) {
      setMessage(`❌ Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const renderActionButtons = () => {
    if (isLoading) {
      return <button disabled className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg">Aguarde...</button>;
    }
    switch (userStatus) {
      case STATUS.CLOCKED_OUT:
        return <button onClick={() => handleRegister(ENTRY_TYPES.CLOCK_IN)} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg">▶️ Iniciar Expediente</button>;
      case STATUS.WORKING:
        return (
          <div className="flex gap-4">
            <button onClick={() => handleRegister(ENTRY_TYPES.BREAK_START)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg">⏸️ Iniciar Intervalo</button>
            <button onClick={() => handleRegister(ENTRY_TYPES.CLOCK_OUT)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg">⏹️ Encerrar Expediente</button>
          </div>
        );
      case STATUS.ON_BREAK:
        return <button onClick={() => handleRegister(ENTRY_TYPES.BREAK_END)} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg">▶️ Retornar do Intervalo</button>;
      default:
        return <button disabled className="w-full bg-gray-400 text-white font-bold py-3 px-6 rounded-lg">Carregando status...</button>;
    }
  };

  const renderMainContent = () => {
    if (showAdminPanel) {
      return <AdminPanel onBack={() => setShowAdminPanel(false)} />;
    }
    return (
      <div className="w-full max-w-md">
        <div className="p-6 bg-white rounded-lg shadow-lg">
          <p className="mb-2">Bem-vindo, {user.displayName || user.email}!</p>
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="w-full mb-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            >
              Painel do Administrador
            </button>
          )}
          <p className="text-lg text-gray-700 mb-6 p-4 h-20 flex items-center justify-center bg-gray-50 rounded-lg">{message}</p>
          <div className="space-y-4">{renderActionButtons()}</div>
          <button
            onClick={handleLogout}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sair
          </button>
        </div>
        {timeHistory.length > 0 && (
          <div className="mt-8 w-full">
            <h2 className="text-2xl font-bold mb-4">Seu Histórico Recente</h2>
            <ul className="bg-white rounded-lg shadow-lg text-left overflow-hidden">
              {timeHistory.map((entry) => (
                <li key={entry.id} className="p-4 border-b border-gray-200 last:border-b-0 flex justify-between items-center">
                  <span className="font-semibold text-gray-700">{entry.type}</span>
                  <span className="text-sm text-gray-500">{entry.timestamp.toDate().toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-center p-4">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Ponto Eletrônico</h1>
        {!user ? <Auth /> : renderMainContent()}
      </div>
    </>
  );
}

export default App;