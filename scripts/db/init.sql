CREATE TABLE IF NOT EXISTS functions (
  "name" TEXT NOT NULL,
  "env" TEXT NOT NULL,
  "memory" TEXT NOT NULL,
  "cpus" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "latestImageTag" TEXT,

  PRIMARY KEY ("name")
);