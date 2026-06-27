CREATE TABLE IF NOT EXISTS "season_player_points" (
  "season_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "accumulated_points" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "season_player_points_pk" PRIMARY KEY("season_id","player_id"),
  CONSTRAINT "season_player_points_non_negative" CHECK ("accumulated_points" >= 0)
);

CREATE TABLE IF NOT EXISTS "organizer_magic_token" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(254) NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "organizer_session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(254) NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "audit_event" ALTER COLUMN "edition_id" DROP NOT NULL;
ALTER TABLE "audit_event" ADD COLUMN IF NOT EXISTS "season_id" uuid;

DO $$ BEGIN
 ALTER TABLE "season_player_points" ADD CONSTRAINT "season_player_points_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "season_player_points" ADD CONSTRAINT "season_player_points_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "organizer_magic_token_hash_unique" ON "organizer_magic_token" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "organizer_magic_token_email_idx" ON "organizer_magic_token" USING btree ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "organizer_session_token_hash_unique" ON "organizer_session" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "organizer_session_email_idx" ON "organizer_session" USING btree ("email");
CREATE INDEX IF NOT EXISTS "audit_event_season_created_at_idx" ON "audit_event" USING btree ("season_id","created_at");

DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_scope_required" CHECK ("edition_id" IS NOT NULL OR "season_id" IS NOT NULL);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
