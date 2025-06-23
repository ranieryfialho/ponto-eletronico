const express = require('express');
const cors = require('cors');
const { db } = require('./firebase-config.js');
const { getDistanceInMeters } = require('./haversine.js');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const SCHOOL_COORDS = { lat: -3.7257216, lon: -38.5581056 }; // -3.733713050367986, -38.557086761106206
const ALLOWED_RADIUS_METERS = 150;
const ALLOWED_IPS = ['::1', '127.0.0.1', '72.14.201.202' /*, '200.123.45.67'*/]; 

app.post('/api/clock-in', async (req, res) => {
  try {
    const { userId, location } = req.body;
    const requestIp = req.ip;

    const distance = getDistanceInMeters(
      location.lat,
      location.lon,
      SCHOOL_COORDS.lat,
      SCHOOL_COORDS.lon
    );

    if (distance > ALLOWED_RADIUS_METERS) {
      console.log(`Validação falhou: Usuário a ${distance.toFixed(0)}m de distância.`);
      return res.status(400).json({ error: `Você está a ${distance.toFixed(0)} metros de distância. Aproxime-se da escola para registrar.` });
    }
    console.log('Validação de distância: OK');

    if (!ALLOWED_IPS.includes(requestIp)) {
      console.log(`Validação falhou: IP ${requestIp} não permitido.`);
      return res.status(400).json({ error: 'Você não parece estar conectado na rede da escola.' });
    }
    console.log('Validação de IP: OK');

    const timeRecord = {
      userId: userId,
      timestamp: new Date(),
      location: location,
      validatedIp: requestIp,
      distanceFromCenter: `${distance.toFixed(2)}m`,
    };

    const docRef = await db.collection('timeEntries').add(timeRecord);
    console.log('Ponto registrado com sucesso no documento:', docRef.id);

    res.status(201).json({ success: 'Ponto registrado com sucesso!', docId: docRef.id });

  } catch (error) {
    console.error("Erro no servidor ao registrar ponto:", error);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}.`);
});