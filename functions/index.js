const functions = require('firebase-functions'); 
const express = require('express');
const cors = require('cors');
const { db, admin } = require('./firebase-config.js');
const { getDistanceInMeters } = require('./haversine.js');

const app = express();

app.use(cors({ origin: 'https://ponto-eletronico-senior-81a53.web.app' }));
app.use(express.json());

const SCHOOL_COORDS = { lat: -3.7337448439285126, lon: -38.557118899994045 };
const ALLOWED_RADIUS_METERS = 500;
const ALLOWED_IPS = ['::1', '127.0.0.1'];

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) { return res.status(401).json({ error: 'Acesso não autorizado. Token não fornecido.' }); }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user.admin === true) { return next(); }
  return res.status(403).json({ error: 'Acesso negado. Requer privilégios de administrador.' });
};

app.post('/api/clock-in', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { location, type } = req.body;
    const requestIp = req.ip;
    const now = new Date();

    const distance = getDistanceInMeters(location.lat, location.lon, SCHOOL_COORDS.lat, SCHOOL_COORDS.lon);
    if (distance > ALLOWED_RADIUS_METERS) { return res.status(400).json({ error: `Você está a ${distance.toFixed(0)}m de distância.` }); }
    if (!ALLOWED_IPS.includes(requestIp)) { return res.status(400).json({ error: 'Você não parece estar conectado na rede da escola.' }); }
    const timeRecord = { userId: userId, timestamp: new Date(), location: location, type: type, validatedIp: requestIp, };
    const docRef = await db.collection('timeEntries').add(timeRecord);
    res.status(201).json({ success: `Registro de '${type}' realizado com sucesso!`, docId: docRef.id });
  } catch (error) {
    console.error("Erro no servidor ao registrar ponto:", error);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
  }
});

// ROTAS DE ADMINISTRAÇÃO
app.get('/api/admin/users', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const listUsersResult = await admin.auth().listUsers(1000);
    const users = listUsersResult.users.map(userRecord => ({ uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName, }));
    res.status(200).json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno ao buscar lista de usuários.' });
  }
});

app.post('/api/admin/create-user', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email || !displayName) { return res.status(400).json({ error: 'E-mail e Nome são obrigatórios.' }); }
    const userRecord = await admin.auth().createUser({ email: email, displayName: displayName, });
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    res.status(201).json({ success: 'Usuário criado! Envie o link a seguir para ele criar a senha.', uid: userRecord.uid, passwordResetLink: resetLink });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') { return res.status(409).json({ error: 'Este e-mail já está em uso.' }); }
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro interno ao criar usuário.' });
  }
});

app.delete('/api/admin/users/:uid', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.user.uid === uid) { return res.status(400).json({ error: 'Você não pode remover sua própria conta de administrador.' }); }
    await admin.auth().deleteUser(uid);
    await db.collection('employees').doc(uid).delete();
    res.status(200).json({ success: 'Usuário removido com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    if (error.code === 'auth/user-not-found') { return res.status(404).json({ error: 'Usuário não encontrado.' }); }
    res.status(500).json({ error: 'Erro interno ao remover usuário.' });
  }
});

app.get('/api/admin/employees/:uid', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const employeeDoc = await db.collection('employees').doc(uid).get();
    if (!employeeDoc.exists) { return res.status(200).json({}); }
    res.status(200).json(employeeDoc.data());
  } catch (error) {
    console.error('Erro ao buscar perfil do funcionário:', error);
    res.status(500).json({ error: 'Erro interno ao buscar perfil do funcionário.' });
  }
});

app.put('/api/admin/users/:uid', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { email, displayName, cpf, cargo, workHours } = req.body;
    if (!email || !displayName) { return res.status(400).json({ error: 'E-mail e Nome são obrigatórios.' }); }
    await admin.auth().updateUser(uid, { email: email, displayName: displayName, });
    const employeeProfile = { displayName, email, cpf: cpf || null, cargo: cargo || null, workHours: workHours || null, };
    await db.collection('employees').doc(uid).set(employeeProfile, { merge: true });
    res.status(200).json({ success: 'Usuário atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    if (error.code === 'auth/email-already-exists') { return res.status(409).json({ error: 'Este e-mail já está em uso por outro usuário.' }); }
    res.status(500).json({ error: 'Erro interno ao atualizar usuário.' });
  }
});

app.get('/api/admin/reports/time-entries', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    if (!userId || !startDate || !endDate) { return res.status(400).json({ error: 'ID do usuário, data de início e data de fim são obrigatórios.' }); }
    const start = new Date(`${startDate}T00:00:00.000-03:00`);
    const end = new Date(`${endDate}T23:59:59.999-03:00`);
    const entriesQuery = db.collection('timeEntries').where('userId', '==', userId).where('timestamp', '>=', start).where('timestamp', '<=', end).orderBy('timestamp', 'asc');
    const snapshot = await entriesQuery.get();
    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, timestamp: data.timestamp.toDate().toISOString(), };
    });
    res.status(200).json(entries);
  } catch (error) {
    console.error('Erro ao buscar registros para relatório:', error);
    res.status(500).json({ error: 'Erro interno ao buscar registros.' });
  }
});

app.get('/api/admin/pending-entries', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const pendingQuery = db.collection('timeEntries')
      .where('status', '==', 'pendente_aprovacao')
      .orderBy('timestamp', 'asc');
    const snapshot = await pendingQuery.get();
    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp.toDate().toISOString(),
      };
    });
    res.status(200).json(entries);
  } catch (error) {
    console.error("Erro ao buscar registros pendentes:", error);
    res.status(500).json({ error: error.message || 'Erro interno ao buscar registros pendentes.' });
  }
});

app.post('/api/admin/entries/:entryId/approve', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { entryId } = req.params;
    await db.collection('timeEntries').doc(entryId).update({ status: 'aprovado' });
    res.status(200).json({ success: 'Registro de ponto aprovado com sucesso!' });
  } catch (error) {
    console.error("Erro ao aprovar registro:", error);
    res.status(500).json({ error: 'Erro interno ao aprovar registro.' });
  }
});

app.post('/api/admin/entries/:entryId/reject', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { entryId } = req.params;
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'O motivo da rejeição é obrigatório.' });
    }
    await db.collection('timeEntries').doc(entryId).update({ 
      status: 'rejeitado',
      rejectionReason: reason 
    });
    res.status(200).json({ success: 'Registro de ponto rejeitado com sucesso.' });
  } catch (error) {
    console.error("Erro ao rejeitar registro:", error);
    res.status(500).json({ error: 'Erro interno ao rejeitar registro.' });
  }
});


exports.api = functions.https.onRequest(app);