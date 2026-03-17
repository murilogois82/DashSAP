CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`changeDate` varchar(8) NOT NULL,
	`changeTime` varchar(8),
	`procedureType` enum('Inclusão','Alteração','Exclusão') NOT NULL,
	`module` varchar(128) NOT NULL,
	`routine` varchar(256) NOT NULL,
	`objType` varchar(20),
	`sapUser` varchar(128) NOT NULL,
	`docNum` varchar(64),
	`logInstance` int,
	`previousContent` text,
	`currentContent` text,
	`sourceTable` varchar(20) NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`format` enum('pdf','excel') NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`fileSize` bigint,
	`filters` text,
	`recordCount` int,
	`generatedBy` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_reports_id` PRIMARY KEY(`id`)
);
