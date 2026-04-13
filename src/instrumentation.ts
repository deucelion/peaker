import * as Sentry from "@sentry/nextjs";
import { runProductionEnvGate } from "@/lib/env/productionEnvGate";

export async function register() {
  runProductionEnvGate();
  if (process.env.NODE_ENV === "production") {
    console.info("[Peaker] instrumentation: production env gate completed");
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
