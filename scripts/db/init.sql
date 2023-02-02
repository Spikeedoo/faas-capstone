CREATE TABLE IF NOT EXISTS functions (
  "name" TEXT NOT NULL,
  "env" TEXT NOT NULL,
  "memory" INT NOT NULL DEFAULT 256,
  "cpus" INT NOT NULL DEFAULT 1,
  "type" TEXT NOT NULL DEFAULT 'http',
  "latestImageTag" TEXT,

  PRIMARY KEY ("name")
);