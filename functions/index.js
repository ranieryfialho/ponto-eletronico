const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { db, admin } = require('./firebase-config.js');
const { getDistanceInMeters } = require('./haversine.js');

process.env.TZ = 'America/Fortaleza';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const SCHOOL_COORDS = { lat: -3.7337448439285126, lon: -38.557118899994045 };
const NEW_BRANCH_COORDS = { lat: -3.8357003292097605, lon: -38.485334159487145 };
const ALLOWED_RADIUS_METERS = 300;
const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) { return res.status(401).json({ error: 'Acesso não autorizado. Token não fornecido.' }); }
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

const verifyAdmin = async (req, res, next) => {
    try {
        const user = await admin.auth().getUser(req.user.uid);
        if (user.customClaims && user.customClaims.admin === true) {
            req.user.admin = true;
            return next();
        }
        return res.status(403).json({ error: 'Acesso negado. Requer privilégios de administrador.' });
    } catch (error) {
        console.error('Erro ao verificar permissões de admin:', error);
        return res.status(500).json({ error: 'Erro ao verificar permissões.' });
    }
};

app.post('/api/clock-in', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { location, type, justification } = req.body;
    const requestIp = req.ip;
    const now = new Date();
    
    const employeeDoc = await db.collection('employees').doc(userId).get();
    if (!employeeDoc.exists) {
        return res.status(404).json({ error: 'Perfil de funcionário não encontrado.' });
    }
    const employeeProfile = employeeDoc.data();
    const allowedLocation = employeeProfile.allowedLocation || 'matriz';

    const lastEntryQuery = await db.collection('timeEntries').where('userId', '==', userId).orderBy('timestamp', 'desc').limit(1).get();
    if (!lastEntryQuery.empty) {
      const lastTimestamp = lastEntryQuery.docs[0].data().timestamp.toDate().getTime();
      const diff = now.getTime() - lastTimestamp;
      if (diff < TEN_MINUTES_IN_MS) {
        return res.status(429).json({ error: `Aguarde mais ${Math.ceil((TEN_MINUTES_IN_MS - diff) / 1000)} segundos para registrar novamente.` });
      }
    }

    let isValidLocation = false;
    let locationName = null;

    if (allowedLocation === 'externo') {
        isValidLocation = true;
        locationName = 'Externo';
    } else {
        const distanceToMatriz = getDistanceInMeters(location.lat, location.lon, SCHOOL_COORDS.lat, SCHOOL_COORDS.lon);
        const distanceToFilial = getDistanceInMeters(location.lat, location.lon, NEW_BRANCH_COORDS.lat, NEW_BRANCH_COORDS.lon);

        switch (allowedLocation) {
          case 'matriz':
            if (distanceToMatriz <= ALLOWED_RADIUS_METERS) {
              isValidLocation = true;
              locationName = 'Matriz';
            }
            break;
          case 'filial':
            if (distanceToFilial <= ALLOWED_RADIUS_METERS) {
              isValidLocation = true;
              locationName = 'Filial';
            }
            break;
          case 'ambas':
            if (distanceToMatriz <= ALLOWED_RADIUS_METERS) {
              isValidLocation = true;
              locationName = 'Matriz';
            } else if (distanceToFilial <= ALLOWED_RADIUS_METERS) {
              isValidLocation = true;
              locationName = 'Filial';
            }
            break;
          default:
            if (distanceToMatriz <= ALLOWED_RADIUS_METERS) {
              isValidLocation = true;
              locationName = 'Matriz';
            }
        }
        
        if (!isValidLocation) {
          const minDistance = Math.min(distanceToMatriz, distanceToFilial);
          return res.status(400).json({ 
            error: `Você não tem permissão para esta unidade ou está fora do raio permitido. Unidade mais próxima a ${minDistance.toFixed(0)}m.` 
          });
        }
    }

    let entryStatus = 'aprovado';
    let successMessage = `Registro de '${type}' realizado com sucesso!`;

    if (type === 'Entrada') {
      if (employeeProfile.workHours) {
        const schedule = employeeProfile.workHours;
        const dayOfWeek = now.getDay();
        let scheduledTimeString = null;

        if (dayOfWeek === 6 && schedule.saturday?.isWorkDay) {
          scheduledTimeString = schedule.saturday.entry;
        } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          scheduledTimeString = schedule.weekday?.entry;
        }

        if (scheduledTimeString) {
          const [hours, minutes] = scheduledTimeString.split(':').map(Number);
          const scheduledTimeToday = new Date();
          scheduledTimeToday.setHours(hours, minutes, 0, 0);
          
          const latenessMinutes = Math.floor((now.getTime() - scheduledTimeToday.getTime()) / 60000);

          if (latenessMinutes > 120) {
            if (!justification) {
              return res.status(422).json({ error: 'Justificativa necessária.', requiresJustification: true });
            }
            entryStatus = 'pendente_aprovacao';
            successMessage = 'Registro de entrada realizado, mas aguardando aprovação do gestor devido a atraso.';
          }
        }
      }
    }

    const timeRecord = {
      userId: userId,
      displayName: req.user.name || employeeProfile.displayName || req.user.email,
      timestamp: now,
      location: location,
      locationName: locationName,
      type: type,
      validatedIp: requestIp,
      status: entryStatus,
      justification: justification || null,
    };

    await db.collection('timeEntries').add(timeRecord);
    res.status(201).json({ success: successMessage });

  } catch (error) {
    console.error("Erro no servidor ao registrar ponto:", error);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
  }
});

app.get('/api/admin/users', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const listUsersResult = await admin.auth().listUsers(1000);
    
    const usersWithProfile = await Promise.all(listUsersResult.users.map(async (userRecord) => {
      const employeeDoc = await db.collection('employees').doc(userRecord.uid).get();
      const profileData = employeeDoc.exists ? employeeDoc.data() : {};
      
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        status: profileData.status || 'ativo', 
        location: profileData.allowedLocation || 'matriz'
      };
    }));
    
    res.status(200).json(usersWithProfile);
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
    const { email, displayName, cpf, cargo, workHours, allowedLocation, status } = req.body;
    if (!email || !displayName) { return res.status(400).json({ error: 'E-mail e Nome são obrigatórios.' }); }
    await admin.auth().updateUser(uid, { email: email, displayName: displayName, });
    
    const employeeProfile = { 
        displayName, 
        email, 
        cpf: cpf || null, 
        cargo: cargo || null, 
        workHours: workHours || null,
        allowedLocation: allowedLocation || 'matriz',
        status: status || 'ativo'
    };

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
    const pendingQuery = db.collection('timeEntries').where('status', '==', 'pendente_aprovacao').orderBy('timestamp', 'asc');
    const snapshot = await pendingQuery.get();
    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, timestamp: data.timestamp.toDate().toISOString() };
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
    if (!reason) { return res.status(400).json({ error: 'O motivo da rejeição é obrigatório.' }); }
    await db.collection('timeEntries').doc(entryId).update({ status: 'rejeitado', rejectionReason: reason });
    res.status(200).json({ success: 'Registro de ponto rejeitado.' });
  } catch (error) {
    console.error("Erro ao rejeitar registro:", error);
    res.status(500).json({ error: 'Erro interno ao rejeitar registro.' });
  }
});

app.put('/api/admin/entries/:entryId', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { entryId } = req.params;
    const { newTimestamp, newType, reason } = req.body;

    if (!newTimestamp || !newType || !reason) {
      return res.status(400).json({ error: 'Nova data/hora, tipo e justificativa são obrigatórios.' });
    }

    const entryRef = db.collection('timeEntries').doc(entryId);
    const doc = await entryRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Registro de ponto não encontrado.' });
    }

    const originalTimestamp = doc.data().timestamp;

    const correctedTimestamp = new Date(newTimestamp + "-03:00");

    await entryRef.update({
      timestamp: correctedTimestamp,
      type: newType,
      isEdited: true,
      editReason: reason,
      originalTimestamp: originalTimestamp
    });

    res.status(200).json({ success: 'Registro de ponto atualizado com sucesso!' });
  } catch (error) {
    console.error("Erro ao atualizar registro de ponto:", error);
    res.status(500).json({ error: 'Erro interno ao atualizar registro.' });
  }
});

app.post('/api/admin/users/:uid/resend-password', verifyFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await admin.auth().getUser(uid);
    const email = user.email;

    if (!email) {
      return res.status(400).json({ error: 'Usuário não possui um e-mail para redefinição de senha.' });
    }

    const resetLink = await admin.auth().generatePasswordResetLink(email);

    res.status(200).json({
      success: 'Novo link de redefinição de senha gerado com sucesso!',
      passwordResetLink: resetLink
    });

  } catch (error) {
    console.error('Erro ao reenviar link de redefinição de senha:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});

exports.api = functions.https.onRequest(app);