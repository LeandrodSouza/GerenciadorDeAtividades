# Sistema de Gerenciamento de Tempo de Tickets (Dockerized com PostgreSQL)

## Descrição

Este é um sistema de gerenciamento de tempo projetado para ajudar no rastreamento do tempo gasto em diferentes tickets ou tarefas. Ele permite aos usuários criar tickets, iniciar e parar cronômetros para cada um, registrar motivos para pausas, manter um checklist de finalização e visualizar o histórico de atividades. A aplicação agora é **Dockerizada** e utiliza **PostgreSQL** para persistência de dados.

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
    * Utiliza **PostgreSQL** para armazenamento de dados. (Anteriormente Firebase Firestore)
* **Autenticação:**
    * **Simplificada para desenvolvimento local** (utiliza um identificador de usuário fixo, 'local-dev-user'). (Anteriormente Firebase Auth)
* **Interface de Usuário:**
    * Design limpo e responsivo, inspirado em aplicações de produtividade.
    * Uso de modais para interações (formulários, confirmações).
    * Ícones modernos (Lucide Icons).
    * **Nota:** A funcionalidade de atualização em tempo real foi simplificada para buscar os dados ao carregar a lista de tickets.

## Arquitetura (Primeiros Passos com PostgreSQL)

O projeto continua a evoluir para desacoplar a lógica de acesso a dados da interface do usuário:

* **Camada de Serviço (Adapter):** A lógica de interação com o banco de dados foi movida para um `postgresTicketService`.
* **Context API para Injeção de Dependência:** O `TicketRepositoryContext` é usado para fornecer o serviço de tickets (`postgresTicketService`) aos componentes.

## Tech Stack

* **Frontend:** React (com Hooks, Context API)
* **Banco de Dados:** PostgreSQL
* **Contêineres:** Docker, Docker Compose
* **Estilização:** Tailwind CSS (utilizado diretamente nas classes dos componentes)
* **Ícones:** Lucide Icons
* **Servidor Web (para build de produção):** Nginx (configurado no Dockerfile da aplicação)

## Configuração e Instalação

### Pré-requisitos

* Docker Engine
* Docker Compose

### 1. Clonar o Repositório
Clone este repositório para a sua máquina local:
```bash
git clone <URL_DO_REPOSITORIO>
cd <NOME_DO_DIRETORIO_CRIADO>
```

### 2. Variáveis de Ambiente e Configuração do Banco de Dados
As configurações de conexão com o banco de dados e outras variáveis de ambiente são definidas nos arquivos `docker-compose.yml`:
*   **`docker-compose.yml` (raiz):** Para rodar a aplicação completa (app + banco de dados).
*   **`app/docker-compose.yml`:** Para rodar apenas a aplicação (conectando-se a um banco de dados PostgreSQL externo).
*   **`database/docker-compose.yml`:** Para rodar apenas o serviço de banco de dados PostgreSQL.

As seguintes variáveis são usadas para configurar a conexão e o banco de dados:
*   Para o serviço de aplicação (`app`):
    *   `PGHOST`: Host do PostgreSQL (ex: `db` quando usado no compose principal, `localhost` se o DB está exposto na máquina host).
    *   `PGUSER`: Usuário do PostgreSQL.
    *   `PGPASSWORD`: Senha do PostgreSQL.
    *   `PGDATABASE`: Nome do banco de dados PostgreSQL.
    *   `PGPORT`: Porta do PostgreSQL (padrão `5432`).
*   Para o serviço de banco de dados (`db`):
    *   `POSTGRES_USER`: Usuário a ser criado no PostgreSQL.
    *   `POSTGRES_PASSWORD`: Senha para o usuário.
    *   `POSTGRES_DB`: Nome do banco de dados a ser criado.

**Valores Padrão (configurados nos arquivos `docker-compose.yml`):**
*   Usuário: `timemanager_user`
*   Senha: `timemanager_password`
*   Nome do Banco de Dados: `timemanager_db`

Você pode customizar esses valores diretamente nos arquivos `docker-compose.yml` se necessário. Para cenários de produção mais robustos, considere o uso de arquivos `.env` para gerenciar essas configurações (não implementado neste projeto).

### 3. Rodando com Docker Compose

As dependências da aplicação são gerenciadas dentro do processo de build do Docker.

**Opção A: Aplicação Completa (App + Banco de Dados)**
Esta é a forma recomendada para desenvolvimento e testes locais.
1.  No diretório raiz do projeto:
    ```bash
    docker-compose up -d --build
    ```
2.  A aplicação React estará disponível em `http://localhost:3000`.
3.  O banco de dados PostgreSQL estará acessível na porta `5432` da sua máquina host (para ferramentas de DB externas, se necessário).

Para parar todos os serviços:
```bash
docker-compose down
```
Para remover os volumes (atenção: isso apagará os dados do banco de dados):
```bash
docker-compose down -v
```

**Opção B: Apenas o Banco de Dados PostgreSQL**
Útil se você quer rodar apenas o banco e conectar-se a ele com outra instância da aplicação ou ferramenta de banco de dados.
1.  Navegue até o diretório `database/`:
    ```bash
    cd database
    docker-compose up -d --build
    ```
2.  O banco de dados PostgreSQL estará disponível na porta `5432` da sua máquina host.

Para parar o serviço do banco de dados:
```bash
docker-compose down
```
(Execute este comando de dentro do diretório `database/`)

**Opção C: Apenas a Aplicação React (conectando a um banco externo)**
Útil se você já possui um PostgreSQL rodando em outro lugar (seja localmente fora do Docker, em outro container Docker, ou um serviço de nuvem).
1.  Certifique-se que as variáveis de ambiente no arquivo `app/docker-compose.yml` (especialmente `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) estão configuradas para apontar para o seu banco de dados PostgreSQL externo.
2.  Navegue até o diretório `app/`:
    ```bash
    cd app
    docker-compose up -d --build
    ```
3.  A aplicação React estará disponível em `http://localhost:3000`.

Para parar o serviço da aplicação:
```bash
docker-compose down
```
(Execute este comando de dentro do diretório `app/`)

## Estrutura do Projeto (Principais Arquivos Docker)

*   `Dockerfile`: Define como construir a imagem Docker para a aplicação React (servida com Nginx).
*   `nginx.conf`: Configuração do Nginx usada pela imagem da aplicação.
*   `database/Dockerfile`: Define como construir a imagem Docker para o serviço PostgreSQL (baseada na imagem oficial `postgres`).
*   `docker-compose.yml`: Orquestra os serviços da aplicação e do banco de dados para um ambiente de desenvolvimento completo.
*   `app/docker-compose.yml`: Configuração para rodar apenas a aplicação, assumindo um banco de dados externo.
*   `database/docker-compose.yml`: Configuração para rodar apenas o serviço de banco de dados.
*   `.dockerignore`: Especifica arquivos e diretórios a serem ignorados durante o build das imagens Docker.

(O restante da estrutura do projeto, como `src/` para o código React, permanece similar).
```
