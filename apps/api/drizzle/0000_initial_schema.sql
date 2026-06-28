CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TYPE "public"."edition_status" AS ENUM('RASCUNHO', 'INSCRICOES_ABERTAS', 'SORTEIO_PUBLICADO', 'EM_ANDAMENTO', 'FASE_COLOCACAO', 'ENCERRADA');
--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('AGENDADA', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADA', 'CONTESTADA', 'CORRIGIDA', 'CANCELADA');
--> statement-breakpoint
CREATE TABLE "player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "championship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"scoring_table" jsonb DEFAULT '[{"position":1,"points":200},{"position":2,"points":180},{"position":3,"points":160},{"position":4,"points":140},{"position":5,"points":100},{"position":6,"points":90},{"position":7,"points":80},{"position":8,"points":70},{"position":9,"points":50},{"position":10,"points":45},{"position":11,"points":40},{"position":12,"points":35},{"position":13,"points":20},{"position":14,"points":15},{"position":15,"points":10},{"position":16,"points":5},{"position":17,"points":4},{"position":18,"points":3},{"position":19,"points":2},{"position":20,"points":1}]'::jsonb NOT NULL,
	"default_edition_rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "championship_scoring_table_is_array" CHECK (jsonb_typeof("scoring_table") = 'array')
);
--> statement-breakpoint
CREATE TABLE "edition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"championship_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"date" date NOT NULL,
	"rules" jsonb DEFAULT '{"minimumGroupSize":4,"preferredGroupSize":5,"maximumGroupSize":6,"participantThresholdForBestOfThree":24,"normalMatchBestOf":5,"protectedSeedCount":3,"seedingMethod":"fixed-heads","groupRankingCriteria":["SETS_WON","SET_DIFF","MATCHES_WON"],"placementStageFormat":"round-robin"}'::jsonb NOT NULL,
	"status" "edition_status" DEFAULT 'RASCUNHO' NOT NULL,
	"auto_confirm_minutes" integer DEFAULT 15 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edition_rules_is_object" CHECK (jsonb_typeof("rules") = 'object'),
	CONSTRAINT "edition_auto_confirm_minutes_positive" CHECK ("auto_confirm_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "edition_registration" (
	"edition_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edition_registration_pk" PRIMARY KEY("edition_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "draw_snapshot" (
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
--> statement-breakpoint
CREATE TABLE "group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"name" varchar(32) NOT NULL,
	"phase" varchar(64) NOT NULL,
	CONSTRAINT "group_id_edition_unique" UNIQUE("id","edition_id"),
	CONSTRAINT "group_id_edition_phase_unique" UNIQUE("id","edition_id","phase")
);
--> statement-breakpoint
CREATE TABLE "group_player" (
	"group_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "group_player_pk" PRIMARY KEY("group_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "match" (
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
--> statement-breakpoint
CREATE TABLE "match_participant" (
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"sets_won" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "match_participant_pk" PRIMARY KEY("match_id","player_id"),
	CONSTRAINT "match_participant_sets_won_non_negative" CHECK ("sets_won" >= 0)
);
--> statement-breakpoint
CREATE TABLE "standing" (
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
--> statement-breakpoint
CREATE TABLE "final_placement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"points_awarded" integer NOT NULL,
	CONSTRAINT "final_placement_position_positive" CHECK ("position" > 0),
	CONSTRAINT "final_placement_points_awarded_non_negative" CHECK ("points_awarded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "championship_player_points" (
	"championship_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"accumulated_points" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "championship_player_points_pk" PRIMARY KEY("championship_id","player_id"),
	CONSTRAINT "championship_player_points_non_negative" CHECK ("accumulated_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "organizer_magic_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizer_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid,
	"championship_id" uuid,
	"match_id" uuid,
	"event_type" varchar(80) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(120) NOT NULL,
	CONSTRAINT "audit_event_payload_is_object" CHECK (jsonb_typeof("payload") = 'object'),
	CONSTRAINT "audit_event_scope_required" CHECK ("edition_id" IS NOT NULL OR "championship_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "edition" ADD CONSTRAINT "edition_championship_id_championship_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championship"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "edition_registration" ADD CONSTRAINT "edition_registration_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "edition_registration" ADD CONSTRAINT "edition_registration_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "draw_snapshot" ADD CONSTRAINT "draw_snapshot_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "draw_snapshot" ADD CONSTRAINT "draw_snapshot_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "group_player" ADD CONSTRAINT "group_player_group_edition_fk" FOREIGN KEY ("group_id","edition_id") REFERENCES "public"."group"("id","edition_id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "group_player" ADD CONSTRAINT "group_player_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_group_edition_phase_fk" FOREIGN KEY ("group_id","edition_id","phase") REFERENCES "public"."group"("id","edition_id","phase") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_player_one_id_player_id_fk" FOREIGN KEY ("player_one_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_player_two_id_player_id_fk" FOREIGN KEY ("player_two_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "standing" ADD CONSTRAINT "standing_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "standing" ADD CONSTRAINT "standing_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "final_placement" ADD CONSTRAINT "final_placement_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "final_placement" ADD CONSTRAINT "final_placement_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "championship_player_points" ADD CONSTRAINT "championship_player_points_championship_id_championship_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championship"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "championship_player_points" ADD CONSTRAINT "championship_player_points_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_championship_id_championship_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championship"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "player_name_unique" ON "player" USING btree ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX "championship_name_unique" ON "championship" USING btree ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX "edition_championship_name_unique" ON "edition" USING btree ("championship_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "draw_snapshot_edition_player_unique" ON "draw_snapshot" USING btree ("edition_id","player_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "draw_snapshot_edition_rank_unique" ON "draw_snapshot" USING btree ("edition_id","rank_position");
--> statement-breakpoint
CREATE UNIQUE INDEX "group_edition_phase_name_unique" ON "group" USING btree ("edition_id","phase","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "group_player_edition_player_unique" ON "group_player" USING btree ("edition_id","player_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "match_edition_phase_players_unique" ON "match" USING btree ("edition_id","phase","player_one_id","player_two_id");
--> statement-breakpoint
CREATE INDEX "match_edition_status_idx" ON "match" USING btree ("edition_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "standing_group_player_unique" ON "standing" USING btree ("group_id","player_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "standing_group_rank_unique" ON "standing" USING btree ("group_id","rank_in_group");
--> statement-breakpoint
CREATE UNIQUE INDEX "final_placement_edition_player_unique" ON "final_placement" USING btree ("edition_id","player_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "final_placement_edition_position_unique" ON "final_placement" USING btree ("edition_id","position");
--> statement-breakpoint
CREATE UNIQUE INDEX "organizer_magic_token_hash_unique" ON "organizer_magic_token" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "organizer_magic_token_email_idx" ON "organizer_magic_token" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX "organizer_session_token_hash_unique" ON "organizer_session" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "organizer_session_email_idx" ON "organizer_session" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "audit_event_edition_created_at_idx" ON "audit_event" USING btree ("edition_id","created_at");
--> statement-breakpoint
CREATE INDEX "audit_event_championship_created_at_idx" ON "audit_event" USING btree ("championship_id","created_at");
