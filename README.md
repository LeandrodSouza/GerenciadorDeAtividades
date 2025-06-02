# Sistema de Gerenciamento de Tempo de Tickets

## Descrição

Este é um sistema de gerenciamento de tempo projetado para ajudar no rastreamento do tempo gasto em diferentes tickets ou tarefas. Ele permite aos usuários criar tickets, iniciar e parar cronômetros para cada um, registrar motivos para pausas, manter um checklist de finalização e visualizar o histórico de atividades. A aplicação utiliza Firebase para persistência de dados em tempo real e autenticação anônima/customizada.

A interface é inspirada em aplicações de produtividade, com foco na clareza e facilidade de uso. O projeto está estruturado para iniciar um desacoplamento da lógica de acesso a dados, visando uma arquitetura mais flexível e testável (inspirada em Clean Architecture / Ports and Adapters).

## Funcionalidades Principais

* **Gerenciamento de Tickets:**
    * Criar, editar e excluir tickets.
    * Atribuir ID do ticket (manual ou automático), assunto, nome da conta, prioridade e dificuldade.
    * Definir data de criação.
* **Controle de Tempo:**
    * Cronômetro individual para cada ticket (iniciar, pausar, retomar).
    * Apenas um ticket pode ser cronometrado por vez; iniciar um novo ticket pausa automaticamente o anterior.
    * Cálculo e exibição do tempo total gasto por ticket.
* **Log de Atividades e Checklist:**
    * **Motivo da Pausa Obrigatório:** Ao pausar um ticket, o usuário deve fornecer um motivo.
    * **Checklist de Finalização:** Ao completar um ticket, é obrigatório confirmar se o ticket foi respondido na plataforma principal e se a planilha de controle foi atualizada.
    * **Histórico Detalhado:** Cada ticket possui um log com registros de início, pausa (com motivo), retomada e conclusão (com o estado do checklist no momento).
* **Priorização e Filtragem:**
    * **Prioridades:** Inclui "Solicitado por Terceiros", "Alto Impacto", "Médio Impacto", "Baixo Impacto".
    * **Filtros:** Permite visualizar tickets "Abertos", "Concluídos" ou "Todos".
    * **Ordenação Inteligente:** Os tickets são ordenados por: ticket ativo > status > prioridade > data da última atualização.
* **Relatórios (Estrutura Inicial):**
    * Visualização para relatórios diários e semanais (atualmente com lógica de sumarização simplificada).
    * Seleção de data para os relatórios.
* **Persistência de Dados:**
    * Utiliza Firebase Firestore para armazenamento de dados em tempo real.
* **Autenticação:**
    * Autenticação anônima ou com token customizado via Firebase Auth.
* **Interface de Usuário:**
    * Design limpo e responsivo, inspirado em aplicações de produtividade.
    * Uso de modais para interações (formulários, confirmações).
    * Ícones modernos (Lucide Icons).

## Arquitetura (Primeiros Passos)

O projeto iniciou uma refatoração para desacoplar a lógica de acesso a dados da interface do usuário, como um primeiro passo em direção a uma arquitetura mais limpa e hexagonal:

* **Camada de Serviço (Adapter):** A lógica de interação com o Firebase foi movida para um `firebaseTicketService`.
* **Context API para Injeção de Dependência:** O `TicketRepositoryContext` é usado para fornecer o serviço de tickets aos componentes, facilitando futuras substituições por outros adaptadores de persistência (ex: SQLite).

## Tech Stack

* **Frontend:** React (com Hooks, Context API)
* **Persistência de Dados:** Firebase Firestore
* **Autenticação:** Firebase Authentication
* **Estilização:** Tailwind CSS (utilizado diretamente nas classes dos componentes)
* **Ícones:** Lucide Icons

## Configuração e Instalação

### Pré-requisitos

* Node.js (versão LTS recomendada)
* npm ou yarn

### 1. Configurar o Firebase

1.  Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2.  Adicione um aplicativo Web ao seu projeto Firebase.
3.  Copie o objeto de configuração do Firebase (`firebaseConfig`). Ele se parecerá com:
    ```javascript
    const firebaseConfig = {
      apiKey: "SUA_API_KEY",
      authDomain: "SEU_AUTH_DOMAIN",
      projectId: "SEU_PROJECT_ID",
      storageBucket: "SEU_STORAGE_BUCKET",
      messagingSenderId: "SEU_MESSAGING_SENDER_ID",
      appId: "SEU_APP_ID"
    };
    ```
4.  No Firebase Console, vá para a seção "Authentication" e habilite o provedor "Anônimo". Se planeja usar tokens customizados, certifique-se de que sua lógica de backend para gerar esses tokens esteja implementada.
5.  Vá para a seção "Firestore Database" e crie um banco de dados. Comece no modo de teste para regras de segurança ou configure-as conforme necessário.

### 2. Configurar o Projeto

1.  Clone o repositório (ou salve o código em um arquivo, por exemplo, `TimeManagerApp.jsx` dentro de um projeto React).
2.  **Integre a configuração do Firebase:**
    * No código fornecido, localize a seção de configuração do Firebase:
        ```javascript
        // Firebase Configuration
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
            apiKey: "YOUR_API_KEY", 
            // ... outros campos ...
        };
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-time-manager-app-refactored';
        ```
    * **Se estiver rodando em um ambiente que injeta `__firebase_config` e `__app_id`:** Não é necessário alterar.
    * **Caso contrário (para rodar localmente como um projeto React padrão):** Substitua os valores `YOUR_API_KEY`, etc., pelo objeto `firebaseConfig` que você copiou do seu projeto Firebase. Você também pode definir um `appId` customizado se desejar.

### 3. Instalar Dependências

Se você estiver configurando um novo projeto React para usar este código:
```bash
npx create-react-app meu-gerenciador-de-tempo
cd meu-gerenciador-de-tempo
npm install firebase lucide-react
# ou com yarn
# yarn add firebase lucide-react
