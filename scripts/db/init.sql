CREATE TABLE IF NOT EXISTS functions (
  "name" TEXT NOT NULL,
  "env" TEXT NOT NULL,
  "memory" INT NOT NULL DEFAULT 256,
  "cpus" INT NOT NULL DEFAULT 1,
  "type" TEXT NOT NULL DEFAULT 'http',
  "latest_image_tag" TEXT,
  "latestDeployDate" TIMESTAMP,

  PRIMARY KEY ("name")
);

CREATE TABLE IF NOT EXISTS users (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,

  PRIMARY KEY ("id")
);