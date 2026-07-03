ALTER TABLE `edition_registration` ADD `withdrawn_at` integer;--> statement-breakpoint
ALTER TABLE `edition_registration` ADD `withdrawn_during_phase` text;--> statement-breakpoint
ALTER TABLE `group` ADD `placement_format` text;--> statement-breakpoint
ALTER TABLE `group` ADD `bracket_seed` text;--> statement-breakpoint
ALTER TABLE `group` ADD `position_from` integer;--> statement-breakpoint
ALTER TABLE `group` ADD `position_to` integer;--> statement-breakpoint
ALTER TABLE `match` ADD `outcome` text DEFAULT 'PLAYED' NOT NULL;--> statement-breakpoint
ALTER TABLE `match` ADD `bracket_round` text;--> statement-breakpoint
ALTER TABLE `match` ADD `walkover_absent_player_id` text REFERENCES `player`(`id`);
