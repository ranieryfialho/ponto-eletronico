import React, { useState } from 'react';

function App() {
  const [message, setMessage] = useState("Pronto para registrar o ponto.");
  const [location, setLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const userId = 'funcionario-01';

  const handleRegisterTime = () => {
    setIsLoading(true);
    setLocation(null);
    setMessage("Obtendo sua localização, por favor aguarde...");

    if (!("geolocation" in navigator)) {
      setMessage("Geolocalização não é suportada pelo seu navegador.");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userLocation = { lat: latitude, lon: longitude };

        setLocation(userLocation);
        setMessage("Localização obtida. Validando com o servidor...");
        sendDataToServer(userLocation);
      },
      (error) => {
        let errorMessage = "Ocorreu um erro ao obter a localização.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Você negou a permissão para acessar a localização.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Informações de localização não estão disponíveis.";
            break;
          case error.TIMEOUT:
            errorMessage = "A solicitação para obter a localização expirou.";
            break;
        }
        setMessage(errorMessage);
        setIsLoading(false);
      }
    );
  };

  const sendDataToServer = async (userLocation) => {
    try {
      const response = await fetch('http://localhost:3001/api/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, location: userLocation }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro do servidor.');
      }

      setMessage(`✅ ${data.success}`);
    } catch (error) {
      setMessage(`❌ Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-center p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">
        Ponto Eletrônico
      </h1>

      <p className="text-lg text-gray-700 mb-6 p-4 h-20 flex items-center justify-center bg-white rounded-lg shadow w-full max-w-sm">
        {message}
      </p>

      <button
        onClick={handleRegisterTime}
        disabled={isLoading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Registrando...' : 'Registrar Ponto'}
      </button>

      {location && (
        <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-800 rounded-lg shadow">
          <h2 className="font-bold">Coordenadas Capturadas:</h2>
          <p>Latitude: {location.lat}</p>
          <p>Longitude: {location.lon}</p>
        </div>
      )}
    </div>
  );
}

export default App;