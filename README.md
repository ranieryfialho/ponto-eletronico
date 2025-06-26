# 🚀 Ponto Eletrônico Inteligente

Um sistema de ponto eletrônico full-stack desenvolvido para registrar a jornada de trabalho de funcionários com validação por geolocalização. A aplicação conta com um painel administrativo completo para gestão de funcionários, sistema de aprovação de ponto e geração de relatórios detalhados com exportação para PDF e CSV.

---

## ✨ Funcionalidades

### Para Funcionários
- **Login Seguro:** Autenticação com e-mail e senha gerenciada pelo Firebase Authentication.
- **Registro de Ponto Inteligente:** Sistema de "máquina de estados" que apresenta a ação correta (Entrada, Início/Fim do Intervalo, Saída) de acordo com o status atual do funcionário.
- **Validação por Geolocalização:** O registro de ponto só é permitido se o funcionário estiver dentro de um raio pré-definido da localização da empresa.
- **Histórico de Registros:** Visualização do histórico de pontos agrupado por mês e por dia em um formato "sanfona" (accordion) para uma interface limpa e escalável.

### Para Administradores
- **Painel de Administrador Seguro:** Acesso restrito a usuários com permissão de administrador, validado por Custom Claims do Firebase.
- **Gestão de Funcionários Completa:**
    - Visualização de todos os funcionários cadastrados.
    - Criação de novos funcionários com envio de link para definição de senha.
    - Edição do perfil completo do funcionário (Nome, E-mail, CPF, Cargo, Jornada de Trabalho Padrão).
    - Remoção de funcionários.
- **Sistema de Aprovação de Atrasos:**
    - Registros de entrada com mais de 2 horas de atraso são marcados como "pendente de aprovação".
    - Tela de gestão para o administrador visualizar, aprovar ou rejeitar esses registros.
- **Relatório de Ponto Detalhado:**
    - Geração de relatórios por funcionário e por período de datas.
    - Somatório de horas trabalhadas e horas em intervalo para cada dia e para o período total.
    - Feedback visual (verde/vermelho) para pontualidade, comparando o horário do registro com a jornada padrão (com tolerância de 10 minutos).
- **Exportação de Relatórios:**
    - Exportação para **PDF** em formato de folha de ponto, com layout profissional e campos para assinatura.
    - Exportação para **CSV**, compatível com Excel e Google Sheets.

## 🛠️ Tecnologias Utilizadas

- **Frontend:**
  - **React** (com Vite)
  - **Tailwind CSS** para estilização utilitária
  - **Headless UI** para componentes de UI acessíveis (Modal, Accordion)
  - **`react-toastify`** para notificações (Toasts)
  - **`jspdf`** & **`jspdf-autotable`** para geração de PDFs

- **Backend:**
  - **Node.js**
  - **Express.js**
  - **Cloud Functions for Firebase** para ambiente serverless

- **Plataforma e Banco de Dados:**
  - **Firebase Authentication**
  - **Cloud Firestore**
  - **Firebase Hosting**

## 📁 Estrutura do Projeto

ponto-eletronico/
├── frontend/         # Código da aplicação React
│   ├── src/
│   └── vite.config.js
├── functions/        # Código do backend Node.js/Express
│   ├── index.js
│   └── package.json
├── firebase.json     # Arquivo principal de configuração do Firebase
└── .firebaserc       # Aponta para o ID do seu projeto Firebase

## ⚙️ Configuração e Instalação Local

Para rodar este projeto na sua máquina, siga os passos abaixo.

**Pré-requisitos:**
- [Node.js](https://nodejs.org/) (versão 18 ou 20)
- `npm`
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`

**Passos:**

1.  **Clone o repositório** e entre na pasta raiz.

2.  **Configure o Firebase:**
    - Crie um projeto no [Console do Firebase](https://console.firebase.google.com/).
    - Ative os serviços **Authentication** (com provedor E-mail/Senha) e **Firestore Database**.
    - Gere uma **chave de conta de serviço** (Service Account) e salve o arquivo `.json` como `firebase-service-account.json` dentro da pasta `functions/`.
    - Crie um app da Web nas configurações do projeto e copie as credenciais para um novo arquivo `frontend/src/firebase-config.js`.

3.  **Instale as Dependências:**
    - Para o backend: `cd functions` e `npm install`. Depois `cd ..`.
    - Para o frontend: `cd frontend` e `npm install`. Depois `cd ..`.

4.  **Designe um Administrador:**
    - Crie um usuário no Firebase Auth para ser o admin.
    - Crie e execute o script `set-admin.js` na pasta `functions` para dar a ele a permissão de admin: `node set-admin.js email-do-admin@email.com`.

5.  **Rode Localmente com o Emulador:**
    - A partir da pasta raiz (`ponto-eletronico`), inicie o ambiente de simulação do Firebase:
      ```bash
      firebase emulators:start
      ```
    - Abra seu navegador e acesse **`http://localhost:5000`**.

## 🚀 Deploy em Produção

1.  **Faça o build do Frontend:**
    ```bash
    cd frontend
    npm run build
    cd ..
    ```
2.  **Faça o Deploy:** A partir da pasta raiz, execute:
    ```bash
    firebase deploy
    ```
    Este comando publicará o frontend no Firebase Hosting e o backend no Cloud Functions.

---
