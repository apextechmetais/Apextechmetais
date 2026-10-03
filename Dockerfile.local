FROM node:20-alpine

# Cria a pasta de trabalho
WORKDIR /usr/src/app

# Instala apenas as dependências de produção para ter uma imagem menor
COPY package*.json ./
RUN npm ci --only=production

# Copia o restante do código fonte
COPY . .

# Expõe a porta que a aplicação escuta
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["npm", "start"]
