import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { Application } from "express";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export interface AppOptions {
  clientOrigin?: string;
}

export function createApp(options?: AppOptions): Application {
  const app = express();
  const { clientOrigin } = options ?? {};

  app.use(
    cors({
      origin: clientOrigin ?? true,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get("/", (_req, res) => {
    res.json({
      name: "YouTube Analysis API",
      status: "ok",
      version: "0.1.0",
    });
  });

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
