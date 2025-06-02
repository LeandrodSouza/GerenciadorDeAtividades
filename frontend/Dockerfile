# frontend/Dockerfile

# Etapa 1: Build da aplicação React

FROM node:18-alpine AS build
WORKDIR /app

COPY package.json ./

# Se você tiver um package-lock.json na sua pasta frontend (o que é recomendado

# para builds consistentes com npm), DESCOMENTE a linha abaixo para copiá-lo.

# Se não tiver, 'npm install' irá gerar um dentro do container.

# COPY package-lock.json ./

# Se você copiou o package-lock.json, 'npm ci' é geralmente preferido.

# Caso contrário, 'npm install' é mais flexível.

RUN npm install

# RUN npm ci \# Use esta linha em vez de 'npm install' se você copiou o package-lock.json

COPY . .

# Disponibiliza o ARG para o processo de build do npm.

# O nome da variável deve ser REACT\_APP\_API\_URL (sem barras invertidas)

ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

RUN npm run build

# Etapa 2: Servir a aplicação com Nginx

FROM nginx:1.25-alpine
COPY --from=build /app/build /usr/share/nginx/html

# Certifique-se que este arquivo existe na pasta frontend

# e que o caminho está correto.

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]