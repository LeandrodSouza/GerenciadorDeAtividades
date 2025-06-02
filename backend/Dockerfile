FROM node:18-alpine
WORKDIR /app

# Copia apenas o package.json primeiro.

# Se você tiver um package-lock.json no seu diretório backend e quiser que ele seja usado

# para ter builds mais determinísticos, copie-o também:

# COPY package-lock.json ./

COPY package.json ./

# Executa npm install.

# Se package-lock.json foi copiado, ele será usado.

# Caso contrário, as dependências serão instaladas com base no package.json

# e um package-lock.json será gerado dentro do container.

# Para o backend, geralmente instalamos apenas dependências de produção.

RUN npm install --only=production

# Copia o restante do código da aplicação

COPY . .

# Cria a pasta de dados onde o SQLite será armazenado

RUN mkdir -p /app/data

# Expõe a porta que o backend vai usar

EXPOSE 3001

# Comando para iniciar o servidor

CMD [ "node", "server.js" ]