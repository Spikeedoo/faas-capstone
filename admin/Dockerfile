FROM node:14-alpine3.17

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . ./

EXPOSE 3000

CMD ["node", "app.js"]