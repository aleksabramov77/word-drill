CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`word_id` integer NOT NULL,
	`at` integer NOT NULL,
	`first` text NOT NULL,
	`deepest` text NOT NULL,
	`grade` integer NOT NULL,
	`elapsed_ms` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reviews_user_at` ON `reviews` (`user_id`,`at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`settings` text NOT NULL,
	`speed_history` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`prompt` text NOT NULL,
	`answers` text NOT NULL,
	`source` text NOT NULL,
	`card` text NOT NULL,
	`due` integer NOT NULL,
	`last_grade` integer,
	`attempt` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `words_user_due` ON `words` (`user_id`,`due`);--> statement-breakpoint
CREATE UNIQUE INDEX `words_user_prompt` ON `words` (`user_id`,`prompt`);