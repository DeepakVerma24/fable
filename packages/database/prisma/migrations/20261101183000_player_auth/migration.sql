-- Player auth columns and server-side sessions.
-- The init migration's ledger triggers are left untouched.
-- password_hash stores a scrypt string. There is no raw password column and no balance column.

ALTER TABLE "users" ADD COLUMN "display_name" TEXT;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

ALTER TABLE "users" ALTER COLUMN "display_name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "csrf_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
