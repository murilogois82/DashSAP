import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("audit.list", () => {
  it("returns paginated audit logs for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.list({
      page: 1,
      pageSize: 10,
    });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page", 1);
    expect(result).toHaveProperty("pageSize", 10);
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("filters by date range", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.list({
      startDate: "20260101",
      endDate: "20260331",
      page: 1,
      pageSize: 25,
    });

    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
    // All returned records should be within the date range
    for (const log of result.data) {
      expect(log.changeDate >= "20260101").toBe(true);
      expect(log.changeDate <= "20260331").toBe(true);
    }
  });

  it("filters by module", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.list({
      module: "Vendas",
      page: 1,
      pageSize: 25,
    });

    expect(result).toHaveProperty("data");
    for (const log of result.data) {
      expect(log.module).toBe("Vendas");
    }
  });

  it("filters by procedure type", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.list({
      procedureType: "Inclusão",
      page: 1,
      pageSize: 25,
    });

    expect(result).toHaveProperty("data");
    for (const log of result.data) {
      expect(log.procedureType).toBe("Inclusão");
    }
  });

  it("rejects unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.audit.list({ page: 1, pageSize: 10 })
    ).rejects.toThrow();
  });
});

describe("audit.stats", () => {
  it("returns statistics for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.stats({});

    expect(result).toHaveProperty("byModule");
    expect(result).toHaveProperty("byUser");
    expect(result).toHaveProperty("byProcedure");
    expect(result).toHaveProperty("byDate");
    expect(result).toHaveProperty("totalRecords");
    expect(Array.isArray(result.byModule)).toBe(true);
    expect(Array.isArray(result.byUser)).toBe(true);
    expect(Array.isArray(result.byProcedure)).toBe(true);
    expect(Array.isArray(result.byDate)).toBe(true);
    expect(typeof result.totalRecords).toBe("number");
  });

  it("returns stats filtered by date range", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.stats({
      startDate: "20260101",
      endDate: "20260331",
    });

    expect(result.totalRecords).toBeGreaterThanOrEqual(0);
  });

  it("rejects unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.audit.stats({})).rejects.toThrow();
  });
});

describe("audit.modules", () => {
  it("returns distinct module names", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.modules();

    expect(Array.isArray(result)).toBe(true);
    // Should have at least some modules from seeded data
    if (result.length > 0) {
      expect(typeof result[0]).toBe("string");
    }
  });
});

describe("audit.users", () => {
  it("returns distinct SAP user names", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.users();

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(typeof result[0]).toBe("string");
    }
  });
});

describe("audit.reports", () => {
  it("returns list of reports", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.reports();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("audit.getById", () => {
  it("returns null for non-existent id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.getById({ id: 999999 });

    expect(result).toBeNull();
  });

  it("returns a log entry for a valid id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First get a valid ID from the list
    const list = await caller.audit.list({ page: 1, pageSize: 1 });
    if (list.data.length > 0) {
      const result = await caller.audit.getById({ id: list.data[0].id });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(list.data[0].id);
      expect(result).toHaveProperty("changeDate");
      expect(result).toHaveProperty("procedureType");
      expect(result).toHaveProperty("module");
      expect(result).toHaveProperty("sapUser");
    }
  });
});
