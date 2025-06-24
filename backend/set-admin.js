const { admin } = require('./firebase-config');
const userEmail = process.argv[2];

if (!userEmail) {
  console.log("Por favor, forneça um e-mail. Ex: node set-admin.js seu-email@exemplo.com");
  process.exit(1);
}

console.log(`Procurando pelo usuário: ${userEmail}`);

admin.auth().getUserByEmail(userEmail)
  .then((user) => {
    console.log(`Usuário encontrado com UID: ${user.uid}. Aplicando claim de admin...`);

    return admin.auth().setCustomUserClaims(user.uid, { admin: true });
  })
  .then(() => {
    console.log("Sucesso! O usuário agora é um administrador.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Ocorreu um erro:", error.message);
    process.exit(1);
  });