import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Audit logs table - stores audit trail entries from SAP B1 HANA history tables.
 * Each record represents a single change (insert/update/delete) detected in the SAP system.
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** Date of the change in SAP (YYYYMMDD format stored as string) */
  changeDate: varchar("changeDate", { length: 8 }).notNull(),
  /** Time of the change if available */
  changeTime: varchar("changeTime", { length: 8 }),
  /** Type of operation: Inclusão, Alteração, Exclusão */
  procedureType: mysqlEnum("procedureType", ["Inclusão", "Alteração", "Exclusão"]).notNull(),
  /** SAP B1 module name */
  module: varchar("module", { length: 128 }).notNull(),
  /** Specific routine/object type description */
  routine: varchar("routine", { length: 256 }).notNull(),
  /** SAP B1 ObjType code */
  objType: varchar("objType", { length: 20 }),
  /** SAP user who performed the action */
  sapUser: varchar("sapUser", { length: 128 }).notNull(),
  /** Internal document/record number */
  docNum: varchar("docNum", { length: 64 }),
  /** Log instance number from SAP history table */
  logInstance: int("logInstance"),
  /** Previous content before the change (JSON or descriptive text) */
  previousContent: text("previousContent"),
  /** Current content after the change (JSON or descriptive text) */
  currentContent: text("currentContent"),
  /** Source history table (e.g., ADOC, ACRD, AITM) */
  sourceTable: varchar("sourceTable", { length: 20 }).notNull(),
  /** Timestamp when this record was imported */
  importedAt: timestamp("importedAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Audit reports table - stores metadata about generated PDF/Excel reports.
 */
export const auditReports = mysqlTable("audit_reports", {
  id: int("id").autoincrement().primaryKey(),
  /** Report title/description */
  title: varchar("title", { length: 512 }).notNull(),
  /** Report format: pdf or excel */
  format: mysqlEnum("format", ["pdf", "excel"]).notNull(),
  /** S3 file key for the stored report */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  /** S3 URL for the stored report */
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  /** File size in bytes */
  fileSize: bigint("fileSize", { mode: "number" }),
  /** Filters used to generate the report (JSON) */
  filters: text("filters"),
  /** Total records included in the report */
  recordCount: int("recordCount"),
  /** User who generated the report */
  generatedBy: int("generatedBy").notNull(),
  /** Timestamp when the report was generated */
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export type AuditReport = typeof auditReports.$inferSelect;
export type InsertAuditReport = typeof auditReports.$inferInsert;
