import { Pool } from "pg";
import { config } from "../config/env";

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error", error);
});

