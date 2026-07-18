PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_group_player` (
	`group_id` text NOT NULL,
	`edition_id` text NOT NULL,
	`player_id` text NOT NULL,
	`phase` text NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`group_id`, `player_id`),
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`group_id`,`edition_id`,`phase`) REFERENCES `group`(`id`,`edition_id`,`phase`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_group_player`("group_id", "edition_id", "player_id", "phase", "is_seed")
SELECT gp."group_id", gp."edition_id", gp."player_id", g."phase", gp."is_seed"
FROM `group_player` AS gp
INNER JOIN `group` AS g ON g."id" = gp."group_id" AND g."edition_id" = gp."edition_id";
--> statement-breakpoint
DROP TABLE `group_player`;--> statement-breakpoint
ALTER TABLE `__new_group_player` RENAME TO `group_player`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `group_player_edition_player_phase_unique` ON `group_player` (`edition_id`,`player_id`,`phase`);
