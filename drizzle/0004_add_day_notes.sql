CREATE TABLE `day_notes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer REFERENCES users(id) ON DELETE cascade,
  `note_date` text NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_day_notes_user_date` ON `day_notes` (`user_id`,`note_date`);
