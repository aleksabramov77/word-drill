CREATE TABLE `access` (
	`email` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`requested_at` integer,
	`decided_at` integer
);
