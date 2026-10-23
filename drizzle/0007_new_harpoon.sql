ALTER TABLE `reviews` ADD `direction` text DEFAULT 'ru-en' NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `rev_card` text;--> statement-breakpoint
ALTER TABLE `words` ADD `rev_due` integer;--> statement-breakpoint
ALTER TABLE `words` ADD `rev_last_grade` integer;--> statement-breakpoint
ALTER TABLE `words` ADD `rev_attempt` text;