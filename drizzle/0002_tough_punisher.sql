CREATE TABLE `weekly_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`wins` text DEFAULT '' NOT NULL,
	`blockers` text DEFAULT '' NOT NULL,
	`lessons` text DEFAULT '' NOT NULL,
	`next_focus` text DEFAULT '' NOT NULL,
	`energy` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_weekly_reviews_week_start` ON `weekly_reviews` (`week_start`);
--> statement-breakpoint
PRAGMA optimize;
