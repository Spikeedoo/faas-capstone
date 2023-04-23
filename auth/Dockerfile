FROM node:14-alpine3.17

# Add C build tools & python to compile bcrypt properly
RUN apk --no-cache add --virtual build-essential build-base python3

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npm rebuild bcrypt --build-from-source

COPY . ./

EXPOSE 3000

CMD [ "node", "app.js" ]