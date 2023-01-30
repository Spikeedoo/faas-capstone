FROM node:14-alpine3.17

RUN apk update \
  && apk add docker

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . ./

EXPOSE 3000

CMD [ "node", "app.js" ]