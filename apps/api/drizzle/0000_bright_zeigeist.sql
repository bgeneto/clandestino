CREATE TABLE `audit_event` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text,
	`championship_id` text,
	`match_id` text,
	`event_type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`championship_id`) REFERENCES `championship`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "audit_event_payload_is_object" CHECK(json_type("audit_event"."payload") = 'object'),
	CONSTRAINT "audit_event_scope_required" CHECK("audit_event"."edition_id" IS NOT NULL OR "audit_event"."championship_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `audit_event_edition_created_at_idx` ON `audit_event` (`edition_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_event_championship_created_at_idx` ON `audit_event` (`championship_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `championship_player_points` (
	`championship_id` text NOT NULL,
	`player_id` text NOT NULL,
	`accumulated_points` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`championship_id`, `player_id`),
	FOREIGN KEY (`championship_id`) REFERENCES `championship`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "championship_player_points_non_negative" CHECK("championship_player_points"."accumulated_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE `championship` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scoring_table` text DEFAULT '[{"position":1,"points":200},{"position":2,"points":180},{"position":3,"points":160},{"position":4,"points":140},{"position":5,"points":100},{"position":6,"points":90},{"position":7,"points":80},{"position":8,"points":70},{"position":9,"points":50},{"position":10,"points":45},{"position":11,"points":40},{"position":12,"points":35},{"position":13,"points":20},{"position":14,"points":15},{"position":15,"points":10},{"position":16,"points":5},{"position":17,"points":4},{"position":18,"points":3},{"position":19,"points":2},{"position":20,"points":1}]' NOT NULL,
	`default_edition_rules` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "championship_scoring_table_is_array" CHECK(json_type("championship"."scoring_table") = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `championship_name_unique` ON `championship` (`name`);--> statement-breakpoint
CREATE TABLE `draw_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`player_id` text NOT NULL,
	`accumulated_points` integer NOT NULL,
	`rank_position` integer NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`algorithm` text NOT NULL,
	`random_seed` text NOT NULL,
	`drawn_at` integer NOT NULL,
	`drawn_by` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "draw_snapshot_accumulated_points_non_negative" CHECK("draw_snapshot"."accumulated_points" >= 0),
	CONSTRAINT "draw_snapshot_rank_position_positive" CHECK("draw_snapshot"."rank_position" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draw_snapshot_edition_player_unique` ON `draw_snapshot` (`edition_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `draw_snapshot_edition_rank_unique` ON `draw_snapshot` (`edition_id`,`rank_position`);--> statement-breakpoint
CREATE TABLE `edition_registration` (
	`edition_id` text NOT NULL,
	`player_id` text NOT NULL,
	`registered_at` integer NOT NULL,
	PRIMARY KEY(`edition_id`, `player_id`),
	FOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `edition` (
	`id` text PRIMARY KEY NOT NULL,
	`championship_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`rules` text DEFAULT '{"minimumGroupSize":4,"preferredGroupSize":5,"maximumGroupSize":6,"protectedSeedCount":3,"seedingMethod":"fixed-heads","groupRankingCriteria":["SETS_WON","SET_DIFF","MATCHES_WON"],"placementStageFormat":"round-robin"}' NOT NULL,
	`status` text DEFAULT 'RASCUNHO' NOT NULL,
	`auto_confirm_minutes` integer DEFAULT 15 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`championship_id`) REFERENCES `championship`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "edition_rules_is_object" CHECK(json_type("edition"."rules") = 'object'),
	CONSTRAINT "edition_auto_confirm_minutes_positive" CHECK("edition"."auto_confirm_minutes" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edition_championship_name_unique` ON `edition` (`championship_id`,`name`);--> statement-breakpoint
CREATE TABLE `final_placement` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`player_id` text NOT NULL,
	`position` integer NOT NULL,
	`points_awarded` integer NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "final_placement_position_positive" CHECK("final_placement"."position" > 0),
	CONSTRAINT "final_placement_points_awarded_non_negative" CHECK("final_placement"."points_awarded" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `final_placement_edition_player_unique` ON `final_placement` (`edition_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `final_placement_edition_position_unique` ON `final_placement` (`edition_id`,`position`);--> statement-breakpoint
CREATE TABLE `group_player` (
	`group_id` text NOT NULL,
	`edition_id` text NOT NULL,
	`player_id` text NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`group_id`, `player_id`),
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`group_id`,`edition_id`) REFERENCES `group`(`id`,`edition_id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_player_edition_player_unique` ON `group_player` (`edition_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `group` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`name` text NOT NULL,
	`phase` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_edition_phase_name_unique` ON `group` (`edition_id`,`phase`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_id_edition_unique` ON `group` (`id`,`edition_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_id_edition_phase_unique` ON `group` (`id`,`edition_id`,`phase`);--> statement-breakpoint
CREATE TABLE `match_participant` (
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`sets_won` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`match_id`, `player_id`),
	FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "match_participant_sets_won_non_negative" CHECK("match_participant"."sets_won" >= 0),
	CONSTRAINT "match_participant_sets_won_max" CHECK("match_participant"."sets_won" <= 7)
);
--> statement-breakpoint
CREATE TABLE `match` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`group_id` text NOT NULL,
	`phase` text NOT NULL,
	`player_one_id` text NOT NULL,
	`player_two_id` text NOT NULL,
	`status` text DEFAULT 'AGENDADA' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`player_one_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`player_two_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`group_id`,`edition_id`,`phase`) REFERENCES `group`(`id`,`edition_id`,`phase`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "match_players_ordered" CHECK("match"."player_one_id" < "match"."player_two_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_edition_phase_players_unique` ON `match` (`edition_id`,`phase`,`player_one_id`,`player_two_id`);--> statement-breakpoint
CREATE INDEX `match_edition_status_idx` ON `match` (`edition_id`,`status`);--> statement-breakpoint
CREATE TABLE `organizer_magic_token` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizer_magic_token_hash_unique` ON `organizer_magic_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `organizer_magic_token_email_idx` ON `organizer_magic_token` (`email`);--> statement-breakpoint
CREATE TABLE `organizer_session` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizer_session_token_hash_unique` ON `organizer_session` (`token_hash`);--> statement-breakpoint
CREATE INDEX `organizer_session_email_idx` ON `organizer_session` (`email`);--> statement-breakpoint
CREATE TABLE `player` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_name_unique` ON `player` (`name`);--> statement-breakpoint
CREATE TABLE `standing` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`player_id` text NOT NULL,
	`sets_won` integer DEFAULT 0 NOT NULL,
	`set_diff` integer DEFAULT 0 NOT NULL,
	`matches_won` integer DEFAULT 0 NOT NULL,
	`rank_in_group` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "standing_sets_won_non_negative" CHECK("standing"."sets_won" >= 0),
	CONSTRAINT "standing_matches_won_non_negative" CHECK("standing"."matches_won" >= 0),
	CONSTRAINT "standing_rank_in_group_positive" CHECK("standing"."rank_in_group" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `standing_group_player_unique` ON `standing` (`group_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `standing_group_rank_unique` ON `standing` (`group_id`,`rank_in_group`);