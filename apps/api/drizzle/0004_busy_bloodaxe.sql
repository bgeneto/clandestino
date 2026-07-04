PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_edition` (
	`id` text PRIMARY KEY NOT NULL,
	`championship_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`rules` text DEFAULT '{"minimumGroupSize":3,"preferredGroupSize":4,"maximumGroupSize":5,"protectedSeedCount":0,"seedingMethod":"fixed-heads","groupRankingCriteria":["SETS_WON","SET_DIFF","MATCHES_WON"],"placementStageFormat":"round-robin"}' NOT NULL,
	`draw_plan` text,
	`status` text DEFAULT 'RASCUNHO' NOT NULL,
	`auto_confirm_minutes` integer DEFAULT 15 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`championship_id`) REFERENCES `championship`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "edition_rules_is_object" CHECK(json_type("__new_edition"."rules") = 'object'),
	CONSTRAINT "edition_auto_confirm_minutes_positive" CHECK("__new_edition"."auto_confirm_minutes" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_edition`("id", "championship_id", "name", "date", "rules", "draw_plan", "status", "auto_confirm_minutes", "created_at") SELECT "id", "championship_id", "name", "date", "rules", "draw_plan", "status", "auto_confirm_minutes", "created_at" FROM `edition`;--> statement-breakpoint
DROP TABLE `edition`;--> statement-breakpoint
ALTER TABLE `__new_edition` RENAME TO `edition`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `edition_championship_name_unique` ON `edition` (`championship_id`,`name`);