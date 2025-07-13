# 🚀 Ponto Eletrônico Inteligente (Multi-Empresa)

Um sistema de ponto eletrônico full-stack robusto, desenvolvido para que qualquer empresa possa gerenciar a jornada de trabalho de seus funcionários com um sistema de validação por geolocalização dinâmico e um painel administrativo completo.

A plataforma foi arquitetada para ser **multi-tenant**, permitindo que cada administrador cadastre sua própria empresa, suas filiais e gerencie seus funcionários de forma isolada e segura.

## ✨ Funcionalidades

### 🏢 Plataforma Multi-Empresa

- **Cadastro Dinâmico de Empresas**: Cada administrador pode cadastrar o perfil da sua própria empresa, incluindo Nome, CNPJ e múltiplos locais de trabalho.
- **Geocodificação Automática**: Utiliza o serviço gratuito Nominatim (OpenStreetMap) para converter endereços de texto (ex: "Avenida da Universidade, 2932") em coordenadas geográficas precisas para a validação do ponto.
- **Isolamento de Dados**: Cada funcionário é estritamente vinculado à sua empresa, garantindo total privacidade e segurança dos dados.

### 👤 Para Funcionários

- **Login Seguro**: Autenticação com e-mail e senha gerenciada pelo Firebase Authentication.
- **Registro de Ponto Inteligente**: Sistema de "máquina de estados" que apresenta a ação correta (Entrada, Início/Fim do Intervalo, Saída) de acordo com o status atual.
- **Validação por Geolocalização Dinâmica**: O registro de ponto é validado com base nos endereços (matriz e filiais) cadastrados pelo administrador da empresa.
- **Permissões de Localização**: Funcionários só podem registrar o ponto nos locais permitidos em seu perfil (Apenas Matriz, Apenas Filial, Ambas). A permissão "Externo" desabilita a validação de GPS.
- **Bloqueio de Usuário Inativo**: Funcionários com status "Inativo" são impedidos de registrar o ponto.
- **Justificativa de Atraso**: Funcionários que se atrasam por mais de 2 horas devem fornecer uma justificativa, que fica visível para o gestor.

### 👨‍💼 Para Administradores

- **Painel de Administrador Seguro**: Acesso restrito a usuários com permissão de administrador (Custom Claim).
- **Gestão de Empresa**: Tela para cadastrar e editar o perfil da empresa e seus locais de ponto (matriz e filiais).
- **Gestão de Funcionários Completa**:
  - Criação, edição e remoção de funcionários
  - Edição do perfil completo, incluindo a permissão de local de ponto
- **Sistema de Aprovação de Atrasos**:
  - Registros de entrada com atraso e justificativa são marcados como "pendente"
  - Tela de gestão para aprovar ou rejeitar esses registros
- **Relatório de Ponto Detalhado**:
  - Geração de relatórios por funcionário e período
  - Exibição de justificativas de atraso e de edições manuais feitas pelo gestor
  - Somatório de horas e feedback visual de pontualidade
- **Exportação de Relatórios**:
  - Exportação para PDF em formato profissional de folha de ponto
  - Exportação para CSV, compatível com Excel

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React** (com Vite)
- **Tailwind CSS**
- **Headless UI**
- **react-toastify**, **jspdf**, **jspdf-autotable**

### Backend
- **Node.js** & **Express.js**
- **Cloud Functions for Firebase**
- **axios** para chamadas a APIs externas (Nominatim)

### Plataforma e Banco de Dados
- **Firebase Authentication** (com Custom Claims)
- **Cloud Firestore**
- **Firebase Hosting**


## 🚀 Como Executar

### Pré-requisitos
- Node.js instalado
- Firebase CLI instalado (`npm install -g firebase-tools`)
- Conta no Firebase com projeto criado