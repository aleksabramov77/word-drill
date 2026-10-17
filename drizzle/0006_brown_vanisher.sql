CREATE TABLE `client_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`at` integer NOT NULL,
	`source` text NOT NULL,
	`event` text NOT NULL,
	`data` text,
	`app_version` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_logs_at` ON `client_logs` (`at`);