import { and, between, count, desc, eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  AuditLog,
  AuditReport,
  InsertAuditLog,
  InsertAuditReport,
  InsertUser,
  auditLogs,
  auditReports,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Audit Logs ─────────────────────────────────────────────────

export interface AuditFilters {
  startDate?: string; // YYYYMMDD
  endDate?: string; // YYYYMMDD
  sapUser?: string;
  module?: string;
  procedureType?: "Inclusão" | "Alteração" | "Exclusão";
  sourceTable?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getAuditLogs(filters: AuditFilters) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, page: 1, pageSize: 25 };

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters.startDate && filters.endDate) {
    conditions.push(between(auditLogs.changeDate, filters.startDate, filters.endDate));
  }
  if (filters.sapUser) {
    conditions.push(eq(auditLogs.sapUser, filters.sapUser));
  }
  if (filters.module) {
    conditions.push(eq(auditLogs.module, filters.module));
  }
  if (filters.procedureType) {
    conditions.push(eq(auditLogs.procedureType, filters.procedureType));
  }
  if (filters.sourceTable) {
    conditions.push(eq(auditLogs.sourceTable, filters.sourceTable));
  }
  if (filters.search) {
    conditions.push(
      sql`(${auditLogs.currentContent} LIKE ${"%" + filters.search + "%"} OR ${auditLogs.previousContent} LIKE ${"%" + filters.search + "%"} OR ${auditLogs.docNum} LIKE ${"%" + filters.search + "%"})`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.changeDate), desc(auditLogs.id))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(auditLogs)
      .where(whereClause),
  ]);

  return {
    data,
    total: totalResult[0]?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getAuditLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  return result[0] ?? null;
}

export async function insertAuditLogs(logs: InsertAuditLog[]) {
  const db = await getDb();
  if (!db) return;
  if (logs.length === 0) return;
  // Insert in batches of 100
  for (let i = 0; i < logs.length; i += 100) {
    const batch = logs.slice(i, i + 100);
    await db.insert(auditLogs).values(batch);
  }
}

// ─── Audit Stats ────────────────────────────────────────────────

export async function getAuditStats(filters: Pick<AuditFilters, "startDate" | "endDate">) {
  const db = await getDb();
  if (!db) return { byModule: [], byUser: [], byProcedure: [], byDate: [], totalRecords: 0 };

  const conditions = [];
  if (filters.startDate && filters.endDate) {
    conditions.push(between(auditLogs.changeDate, filters.startDate, filters.endDate));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [byModule, byUser, byProcedure, byDate, totalResult] = await Promise.all([
    db
      .select({ module: auditLogs.module, count: count() })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.module)
      .orderBy(desc(count())),
    db
      .select({ sapUser: auditLogs.sapUser, count: count() })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.sapUser)
      .orderBy(desc(count())),
    db
      .select({ procedureType: auditLogs.procedureType, count: count() })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.procedureType),
    db
      .select({ changeDate: auditLogs.changeDate, count: count() })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.changeDate)
      .orderBy(auditLogs.changeDate),
    db
      .select({ total: count() })
      .from(auditLogs)
      .where(whereClause),
  ]);

  return {
    byModule,
    byUser,
    byProcedure,
    byDate,
    totalRecords: totalResult[0]?.total ?? 0,
  };
}

export async function getDistinctModules() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ module: auditLogs.module }).from(auditLogs);
  return result.map((r) => r.module);
}

export async function getDistinctUsers() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ sapUser: auditLogs.sapUser }).from(auditLogs);
  return result.map((r) => r.sapUser);
}

export async function getDistinctSourceTables() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ sourceTable: auditLogs.sourceTable }).from(auditLogs);
  return result.map((r) => r.sourceTable);
}

export async function clearAuditLogs() {
  const db = await getDb();
  if (!db) return;
  await db.delete(auditLogs);
}

// ─── Audit Reports ──────────────────────────────────────────────

export async function insertAuditReport(report: InsertAuditReport) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(auditReports).values(report);
  return result[0];
}

export async function getAuditReports(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditReports)
    .orderBy(desc(auditReports.generatedAt))
    .limit(50);
}

export async function getAuditReportById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(auditReports).where(eq(auditReports.id, id)).limit(1);
  return result[0] ?? null;
}
