FROM node:14-alpine3.17

WORKDIR /function

COPY package*.json ./

RUN npm install

COPY . ./

ARG module
ENV module=${module}

ARG target_function
ENV target_function=${target_function}

ENTRYPOINT [ "node", "index.js" ]