CREATE TABLE `agent` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`image` text NOT NULL,
	`description` text NOT NULL,
	`tone` text NOT NULL,
	`verbosity` text NOT NULL,
	`emoji_usage` text NOT NULL,
	`language_style` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_email_unique` ON `agent` (`email`);--> statement-breakpoint
CREATE TABLE `chat_message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`mentions` text NOT NULL,
	`tool_uses` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`metadata` text NOT NULL,
	`thread_metadata` text,
	`room_id` text NOT NULL,
	`thread_id` integer,
	FOREIGN KEY (`room_id`) REFERENCES `chat_room`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_room` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`organization_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_room_member` (
	`id` text NOT NULL,
	`room_id` text NOT NULL,
	`type` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`room_id`, `id`),
	FOREIGN KEY (`room_id`) REFERENCES `chat_room`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`chat_room_id` text NOT NULL,
	`goal` text NOT NULL,
	`steps` text NOT NULL,
	`schedule_expression` text NOT NULL,
	`next_execution_time` integer NOT NULL,
	`last_execution_time` integer,
	`is_active` integer NOT NULL,
	`is_recurring` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
