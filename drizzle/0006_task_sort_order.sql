ALTER TABLE `tasks` ADD `sort_order` integer DEFAULT 0 NOT NULL;
DROP INDEX IF EXISTS `idx_tasks_user_completed_due_date`;
CREATE INDEX IF NOT EXISTS `idx_tasks_user_completed_due_date` ON `tasks` (`user_id`, `completed`, `due_date`, `sort_order`);
