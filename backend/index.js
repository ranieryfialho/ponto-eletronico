const express = require('express');
const cors = require('cors');
const { db, admin } = require('./firebase-config.js');
const { getDistanceInMeters } = require('./haversine.js');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

const SCHOOL_COORDS = { lat: -3.7257216, lon: -38.5581056 };
const ALLOWED_RADIUS_METERS = 150;
const ALLOWED_IPS = ['::1', '127.0.0.1'];

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado. Token não fornecido.' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
};

app.post('/api/clock-in', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { location, type } = req.body;
    const requestIp = req.ip;

    const distance = getDistanceInMeters(
      location.lat, location.lon,
      SCHOOL_COORDS.lat, SCHOOL_COORDS.lon
    );

    if (distance > ALLOWED_RADIUS_METERS) {
      return res.status(400).json({ error: `Você está a ${distance.toFixed(0)}m de distância.` });
    }

    // Validação de IP
    if (!ALLOWED_IPS.includes(requestIp)) {
      return res.status(400).json({ error: 'Você não parece estar conectado na rede da escola.' });
    }

    const timeRecord = {
      userId: userId,
      timestamp: new Date(),
      location: location,
      type: type,
      validatedIp: requestIp,
    };

    const docRef = await db.collection('timeEntries').add(timeRecord);

    res.status(201).json({ success: `Registro de '${type}' realizado com sucesso!`, docId: docRef.id });

  } catch (error) {
    console.error("Erro no servidor ao registrar ponto:", error);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}.`);
});