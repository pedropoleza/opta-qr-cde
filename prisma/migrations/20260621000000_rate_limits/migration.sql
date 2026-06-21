-- Fase 5: rate limiting por janela fixa (Postgres, serverless-friendly).
CREATE TABLE IF NOT EXISTS "checkin_rate_limits" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "checkin_rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "checkin_rate_limits_window_start_idx" ON "checkin_rate_limits" ("window_start");
