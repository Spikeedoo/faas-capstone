FROM postgres:15 as db

WORKDIR /app

COPY ./scripts/db/init.sh /docker-entrypoint-initdb.d

COPY ./scripts/db/init.sql ./scripts/db/init.sql

COPY ./scripts/db/seed.sql ./scripts/db/seed.sql