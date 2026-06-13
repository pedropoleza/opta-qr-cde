-- CreateTable
CREATE TABLE "checkin_organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'organizer',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "location_name" TEXT,
    "address" TEXT,
    "capacity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "checker_token" TEXT NOT NULL,
    "checker_pin" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "checkin_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_guests" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "ghl_contact_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'csv',
    "status" TEXT NOT NULL DEFAULT 'pending_qr',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "checkin_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_tickets" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "checked_in_at" TIMESTAMPTZ,
    "checked_in_by" UUID,
    "checkin_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_scan_count" INTEGER NOT NULL DEFAULT 0,
    "last_scan_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_check_in_logs" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "guest_id" UUID,
    "ticket_id" UUID,
    "checker_user_id" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "scanned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_info" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "checkin_check_in_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_email_logs" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "ticket_id" UUID,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_ghl_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "location_id" TEXT NOT NULL,
    "scopes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_ghl_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_ghl_sync_jobs" (
    "id" UUID NOT NULL,
    "event_id" UUID,
    "guest_id" UUID,
    "ghl_contact_id" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "checkin_ghl_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkin_users_email_key" ON "checkin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_events_checker_token_key" ON "checkin_events"("checker_token");

-- CreateIndex
CREATE INDEX "checkin_events_organization_id_idx" ON "checkin_events"("organization_id");

-- CreateIndex
CREATE INDEX "checkin_guests_event_id_idx" ON "checkin_guests"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_tickets_guest_id_key" ON "checkin_tickets"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_tickets_token_key" ON "checkin_tickets"("token");

-- CreateIndex
CREATE INDEX "checkin_tickets_event_id_idx" ON "checkin_tickets"("event_id");

-- CreateIndex
CREATE INDEX "checkin_check_in_logs_event_id_scanned_at_idx" ON "checkin_check_in_logs"("event_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_email_logs_event_id_idx" ON "checkin_email_logs"("event_id");

-- CreateIndex
CREATE INDEX "checkin_ghl_connections_organization_id_idx" ON "checkin_ghl_connections"("organization_id");

-- CreateIndex
CREATE INDEX "checkin_ghl_sync_jobs_status_next_retry_at_idx" ON "checkin_ghl_sync_jobs"("status", "next_retry_at");

-- AddForeignKey
ALTER TABLE "checkin_users" ADD CONSTRAINT "checkin_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "checkin_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_events" ADD CONSTRAINT "checkin_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "checkin_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_guests" ADD CONSTRAINT "checkin_guests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_tickets" ADD CONSTRAINT "checkin_tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_tickets" ADD CONSTRAINT "checkin_tickets_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "checkin_guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_check_in_logs" ADD CONSTRAINT "checkin_check_in_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_check_in_logs" ADD CONSTRAINT "checkin_check_in_logs_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "checkin_guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_check_in_logs" ADD CONSTRAINT "checkin_check_in_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "checkin_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_email_logs" ADD CONSTRAINT "checkin_email_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_email_logs" ADD CONSTRAINT "checkin_email_logs_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "checkin_guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_email_logs" ADD CONSTRAINT "checkin_email_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "checkin_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_ghl_connections" ADD CONSTRAINT "checkin_ghl_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "checkin_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_ghl_sync_jobs" ADD CONSTRAINT "checkin_ghl_sync_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "checkin_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_ghl_sync_jobs" ADD CONSTRAINT "checkin_ghl_sync_jobs_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "checkin_guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
