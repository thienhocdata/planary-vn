CREATE TABLE `auth_identities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_identities_provider_account` ON `auth_identities` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_identities_user_id` ON `auth_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`state_hash` text NOT NULL,
	`provider` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_states_state_hash_unique` ON `oauth_states` (`state_hash`);--> statement-breakpoint
CREATE INDEX `idx_oauth_states_provider_expires_at` ON `oauth_states` (`provider`,`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id_expires_at` ON `sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`password_hash` text,
	`password_salt` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
DROP INDEX `idx_goals_plan_id_status`;--> statement-breakpoint
ALTER TABLE `goals` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `idx_goals_user_status` ON `goals` (`user_id`,`status`);--> statement-breakpoint
DROP INDEX `idx_habit_logs_habit_date`;--> statement-breakpoint
DROP INDEX `idx_habit_logs_date`;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_habit_logs_user_habit_date` ON `habit_logs` (`user_id`,`habit_id`,`log_date`);--> statement-breakpoint
CREATE INDEX `idx_habit_logs_user_date` ON `habit_logs` (`user_id`,`log_date`);--> statement-breakpoint
DROP INDEX `idx_habits_active`;--> statement-breakpoint
ALTER TABLE `habits` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `idx_habits_user_active` ON `habits` (`user_id`,`active`);--> statement-breakpoint
DROP INDEX `idx_tasks_completed_due_date`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `idx_tasks_user_completed_due_date` ON `tasks` (`user_id`,`completed`,`due_date`);--> statement-breakpoint
DROP INDEX `idx_weekly_reviews_week_start`;--> statement-breakpoint
ALTER TABLE `weekly_reviews` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_weekly_reviews_user_week_start` ON `weekly_reviews` (`user_id`,`week_start`);--> statement-breakpoint
ALTER TABLE `plans` ADD `user_id` integer REFERENCES users(id);