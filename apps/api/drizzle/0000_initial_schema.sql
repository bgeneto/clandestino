CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
 CREATE TYPE "public"."edition_status" AS ENUM('RASCUNHO', 'INSCRICOES_ABERTAS', 'SORTEIO_PUBLICADO', 'EM_ANDAMENTO', 'FASE_COLOCACAO', 'ENCERRADA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."match_status" AS ENUM('AGENDADA', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADA', 'CONTESTADA', 'CORRIGIDA', 'CANCELADA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "player" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "season" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "scoring_table" jsonb DEFAULT '[{"position":1,"points":200},{"position":2,"points":180},{"position":3,"points":160},{"position":4,"points":140},{"position":5,"points":100},{"position":6,"points":90},{"position":7,"points":80},{"position":8,"points":70},{"position":9,"points":50},{"position":10,"points":45},{"position":11,"points":40},{"position":12,"points":35},{"position":13,"points":20},{"position":14,"points":15},{"position":15,"points":10},{"position":16,"points":5},{"position":17,"points":4},{"position":18,"points":3},{"position":19,"points":2},{"position":20,"points":1}]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "season_scoring_table_is_array" CHECK (jsonb_typeof("scoring_table") = 'array')
);

CREATE TABLE IF NOT EXISTS "edition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "season_id" uuid NOT NULL,
  "name" varchar(120) NOT NULL,
  "date" date NOT NULL,
  "rules" jsonb DEFAULT '{"minimumGroupSize":4,"preferredGroupSize":5,"maximumGroupSize":6,"participantThresholdForBestOfThree":24,"normalMatchBestOf":5,"protectedSeedCount":3,"seedingMethod":"fixed-heads","groupRankingCriteria":["SETS_WON","SET_DIFF","MATCHES_WON"],"placementStageFormat":"round-robin"}'::jsonb NOT NULL,
  "status" "edition_status" DEFAULT 'RASCUNHO' NOT NULL,
  "auto_confirm_minutes" integer DEFAULT 15 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "edition_rules_is_object" CHECK (jsonb_typeof("rules") = 'object'),
  CONSTRAINT "edition_auto_confirm_minutes_positive" CHECK ("auto_confirm_minutes" > 0)
);

CREATE TABLE IF NOT EXISTS "edition_registration" (
  "edition_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "registered_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "edition_registration_pk" PRIMARY KEY("edition_id","player_id")
);

CREATE TABLE IF NOT EXISTS "draw_snapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "accumulated_points" integer NOT NULL,
  "rank_position" integer NOT NULL,
  "is_seed" boolean DEFAULT false NOT NULL,
  "algorithm" varchar(120) NOT NULL,
  "random_seed" varchar(120) NOT NULL,
  "drawn_at" timestamp with time zone DEFAULT now() NOT NULL,
  "drawn_by" varchar(120) NOT NULL,
  CONSTRAINT "draw_snapshot_accumulated_points_non_negative" CHECK ("accumulated_points" >= 0),
  CONSTRAINT "draw_snapshot_rank_position_positive" CHECK ("rank_position" > 0)
);

CREATE TABLE IF NOT EXISTS "group" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL,
  "name" varchar(32) NOT NULL,
  "phase" varchar(64) NOT NULL,
  CONSTRAINT "group_id_edition_unique" UNIQUE("id","edition_id"),
  CONSTRAINT "group_id_edition_phase_unique" UNIQUE("id","edition_id","phase")
);

CREATE TABLE IF NOT EXISTS "group_player" (
  "group_id" uuid NOT NULL,
  "edition_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "is_seed" boolean DEFAULT false NOT NULL,
  CONSTRAINT "group_player_pk" PRIMARY KEY("group_id","player_id")
);

CREATE TABLE IF NOT EXISTS "match" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "phase" varchar(64) NOT NULL,
  "player_one_id" uuid NOT NULL,
  "player_two_id" uuid NOT NULL,
  "status" "match_status" DEFAULT 'AGENDADA' NOT NULL,
  "best_of" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "match_best_of_valid" CHECK ("best_of" in (3, 5)),
  CONSTRAINT "match_players_ordered" CHECK ("player_one_id" < "player_two_id")
);

CREATE TABLE IF NOT EXISTS "match_participant" (
  "match_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "sets_won" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "match_participant_pk" PRIMARY KEY("match_id","player_id"),
  CONSTRAINT "match_participant_sets_won_non_negative" CHECK ("sets_won" >= 0)
);

CREATE TABLE IF NOT EXISTS "standing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "sets_won" integer DEFAULT 0 NOT NULL,
  "set_diff" integer DEFAULT 0 NOT NULL,
  "matches_won" integer DEFAULT 0 NOT NULL,
  "rank_in_group" integer NOT NULL,
  CONSTRAINT "standing_sets_won_non_negative" CHECK ("sets_won" >= 0),
  CONSTRAINT "standing_matches_won_non_negative" CHECK ("matches_won" >= 0),
  CONSTRAINT "standing_rank_in_group_positive" CHECK ("rank_in_group" > 0)
);

CREATE TABLE IF NOT EXISTS "final_placement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "points_awarded" integer NOT NULL,
  CONSTRAINT "final_placement_position_positive" CHECK ("position" > 0),
  CONSTRAINT "final_placement_points_awarded_non_negative" CHECK ("points_awarded" >= 0)
);

CREATE TABLE IF NOT EXISTS "audit_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL,
  "match_id" uuid,
  "event_type" varchar(80) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(120) NOT NULL,
  CONSTRAINT "audit_event_payload_is_object" CHECK (jsonb_typeof("payload") = 'object')
);

DO $$ BEGIN
 ALTER TABLE "edition" ADD CONSTRAINT "edition_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "edition_registration" ADD CONSTRAINT "edition_registration_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "edition_registration" ADD CONSTRAINT "edition_registration_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "draw_snapshot" ADD CONSTRAINT "draw_snapshot_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "draw_snapshot" ADD CONSTRAINT "draw_snapshot_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "group" ADD CONSTRAINT "group_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "group_player" ADD CONSTRAINT "group_player_group_edition_fk" FOREIGN KEY ("group_id","edition_id") REFERENCES "public"."group"("id","edition_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "group_player" ADD CONSTRAINT "group_player_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "match" ADD CONSTRAINT "match_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "match" ADD CONSTRAINT "match_group_edition_phase_fk" FOREIGN KEY ("group_id","edition_id","phase") REFERENCES "public"."group"("id","edition_id","phase") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "match" ADD CONSTRAINT "match_player_one_id_player_id_fk" FOREIGN KEY ("player_one_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "match" ADD CONSTRAINT "match_player_two_id_player_id_fk" FOREIGN KEY ("player_two_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "standing" ADD CONSTRAINT "standing_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "standing" ADD CONSTRAINT "standing_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "final_placement" ADD CONSTRAINT "final_placement_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "final_placement" ADD CONSTRAINT "final_placement_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "player_name_unique" ON "player" USING btree ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "season_name_unique" ON "season" USING btree ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "edition_season_name_unique" ON "edition" USING btree ("season_id","name");
CREATE UNIQUE INDEX IF NOT EXISTS "draw_snapshot_edition_player_unique" ON "draw_snapshot" USING btree ("edition_id","player_id");
CREATE UNIQUE INDEX IF NOT EXISTS "draw_snapshot_edition_rank_unique" ON "draw_snapshot" USING btree ("edition_id","rank_position");
CREATE UNIQUE INDEX IF NOT EXISTS "group_edition_phase_name_unique" ON "group" USING btree ("edition_id","phase","name");
CREATE UNIQUE INDEX IF NOT EXISTS "group_player_edition_player_unique" ON "group_player" USING btree ("edition_id","player_id");
CREATE UNIQUE INDEX IF NOT EXISTS "match_edition_phase_players_unique" ON "match" USING btree ("edition_id","phase","player_one_id","player_two_id");
CREATE INDEX IF NOT EXISTS "match_edition_status_idx" ON "match" USING btree ("edition_id","status");
CREATE UNIQUE INDEX IF NOT EXISTS "standing_group_player_unique" ON "standing" USING btree ("group_id","player_id");
CREATE UNIQUE INDEX IF NOT EXISTS "standing_group_rank_unique" ON "standing" USING btree ("group_id","rank_in_group");
CREATE UNIQUE INDEX IF NOT EXISTS "final_placement_edition_player_unique" ON "final_placement" USING btree ("edition_id","player_id");
CREATE UNIQUE INDEX IF NOT EXISTS "final_placement_edition_position_unique" ON "final_placement" USING btree ("edition_id","position");
CREATE INDEX IF NOT EXISTS "audit_event_edition_created_at_idx" ON "audit_event" USING btree ("edition_id","created_at");
