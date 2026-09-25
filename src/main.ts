import Fastify from "fastify";
import cors from "@fastify/cors";
import cron from "node-cron";
import { env } from "./config.js";
import { EPOCH_MINUTES } from "./constants.js";
import { routes } from "./api/routes.js";
import { runEpochTurn } from "./services/crank.js";

const app = Fastify({ logger: { level: "info", redact: ["req.headers.authorization"] } });
await app.register(cors, { origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()) });
await app.register(routes);
app.setErrorHandler((err, _req, reply) => { app.log.error(err); reply.code((err as { statusCode?: number }).statusCode ?? 400).send({ error: err.message }); });

if (env.CRANK_ENABLED === "true") {
  let running = false;
  cron.schedule(`*/${EPOCH_MINUTES} * * * *`, async () => {
    if (running) return; running = true;
    try { await runEpochTurn(); } catch (e) { app.log.error(e, "crank turn failed"); } finally { running = false; }
  });
  app.log.info(`crank scheduled every ${EPOCH_MINUTES} minutes (executes only inside the market window)`);
}

await app.listen({ port: env.PORT, host: "0.0.0.0" });
