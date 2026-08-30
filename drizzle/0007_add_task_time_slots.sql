ALTER TABLE `tasks` ADD `time_slot` text DEFAULT 'morning' NOT NULL;
DROP INDEX IF EXISTS `idx_tasks_user_completed_due_date`;
CREATE INDEX IF NOT EXISTS `idx_tasks_user_completed_due_date` ON `tasks` (`user_id`, `completed`, `due_date`, `time_slot`, `sort_order`);
