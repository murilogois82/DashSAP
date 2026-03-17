import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getAuditLogById,
  getAuditLogs,
  getAuditReportById,
  getAuditReports,
  getAuditStats,
  getDistinctModules,
  getDistinctUsers,
  getDistinctSourceTables,
  insertAuditReport,
  insertAuditLogs,
  clearAuditLogs,
} from "./db";
import { storagePut, storageGet } from "./storage";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  audit: router({
    /** List audit logs with dynamic filters and pagination */
    list: protectedProcedure
      .input(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          sapUser: z.string().optional(),
          module: z.string().optional(),
          procedureType: z.enum(["Inclusão", "Alteração", "Exclusão"]).optional(),
          sourceTable: z.string().optional(),
          search: z.string().optional(),
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(100).default(25),
        })
      )
      .query(({ input }) => getAuditLogs(input)),

    /** Get a single audit log by ID */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getAuditLogById(input.id)),

    /** Get dashboard statistics */
    stats: protectedProcedure
      .input(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(({ input }) => getAuditStats(input)),

    /** Get distinct module names for filter dropdown */
    modules: protectedProcedure.query(() => getDistinctModules()),

    /** Get distinct SAP user names for filter dropdown */
    users: protectedProcedure.query(() => getDistinctUsers()),

    /** Get distinct source tables for filter dropdown */
    sourceTables: protectedProcedure.query(() => getDistinctSourceTables()),

    /** Import audit rows from CSV upload */
    importRows: protectedProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              changeDate: z.string(),
              changeTime: z.string().nullable().optional(),
              procedureType: z.enum(["Inclusão", "Alteração", "Exclusão"]),
              module: z.string(),
              routine: z.string(),
              objType: z.string().nullable().optional(),
              sapUser: z.string(),
              docNum: z.string().nullable().optional(),
              logInstance: z.number().nullable().optional(),
              previousContent: z.string().nullable().optional(),
              currentContent: z.string().nullable().optional(),
              sourceTable: z.string(),
            })
          ),
          clearFirst: z.boolean().optional().default(false),
        })
      )
      .mutation(async ({ input }) => {
        if (input.clearFirst) {
          await clearAuditLogs();
        }
        const errors: string[] = [];
        const validRows: any[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = input.rows[i];
          if (!row.changeDate || row.changeDate.length !== 8 || !/^\d{8}$/.test(row.changeDate)) {
            errors.push(`Linha ${i + 2}: Data inválida "${row.changeDate}"`);
            continue;
          }
          if (!row.sapUser || row.sapUser.trim() === "") {
            errors.push(`Linha ${i + 2}: Usuário SAP vazio`);
            continue;
          }
          validRows.push({
            changeDate: row.changeDate,
            changeTime: row.changeTime || null,
            procedureType: row.procedureType,
            module: row.module.substring(0, 128),
            routine: row.routine.substring(0, 256),
            objType: row.objType?.substring(0, 20) || null,
            sapUser: row.sapUser.substring(0, 128),
            docNum: row.docNum?.substring(0, 64) || null,
            logInstance: row.logInstance ?? null,
            previousContent: row.previousContent || null,
            currentContent: row.currentContent || null,
            sourceTable: row.sourceTable.substring(0, 20),
          });
        }
        await insertAuditLogs(validRows);
        return {
          total: input.rows.length,
          imported: validRows.length,
          skipped: input.rows.length - validRows.length,
          errors,
        };
      }),

    /** Export audit data to Excel and store in S3 */
    exportExcel: protectedProcedure
      .input(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          sapUser: z.string().optional(),
          module: z.string().optional(),
          procedureType: z.enum(["Inclusão", "Alteração", "Exclusão"]).optional(),
          sourceTable: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Fetch all matching records (up to 5000)
        const result = await getAuditLogs({ ...input, page: 1, pageSize: 5000 });
        const rows = result.data;

        // Build CSV content
        const header = "Data,Hora,Procedimento,Módulo,Rotina,Usuário SAP,DocNum,Tabela Origem,Conteúdo Anterior,Conteúdo Atual\n";
        const csvRows = rows.map((r) =>
          [
            r.changeDate,
            r.changeTime || "",
            r.procedureType,
            r.module,
            r.routine,
            r.sapUser,
            r.docNum || "",
            r.sourceTable,
            `"${(r.previousContent || "N/A").replace(/"/g, '""')}"`,
            `"${(r.currentContent || "N/A").replace(/"/g, '""')}"`,
          ].join(",")
        );
        const csvContent = "\uFEFF" + header + csvRows.join("\n");

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileKey = `audit-reports/audit-export-${timestamp}.csv`;
        const { url } = await storagePut(fileKey, csvContent, "text/csv; charset=utf-8");

        // Save report metadata
        await insertAuditReport({
          title: `Exportação Auditoria ${input.startDate || "todas"} a ${input.endDate || "todas"}`,
          format: "excel",
          fileKey,
          fileUrl: url,
          fileSize: Buffer.byteLength(csvContent, "utf-8"),
          filters: JSON.stringify(input),
          recordCount: rows.length,
          generatedBy: ctx.user.id,
        });

        return { url, recordCount: rows.length };
      }),

    /** Export audit data to PDF-like HTML report and store in S3 */
    exportPdf: protectedProcedure
      .input(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          sapUser: z.string().optional(),
          module: z.string().optional(),
          procedureType: z.enum(["Inclusão", "Alteração", "Exclusão"]).optional(),
          sourceTable: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await getAuditLogs({ ...input, page: 1, pageSize: 5000 });
        const rows = result.data;

        const formatDate = (d: string) =>
          d ? `${d.substring(6, 8)}/${d.substring(4, 6)}/${d.substring(0, 4)}` : "";

        const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Auditoria SAP B1 HANA</title>
<style>
  body { font-family: 'Inter', Arial, sans-serif; margin: 40px; color: #1a1a2e; background: #fff; }
  h1 { color: #0f3460; border-bottom: 3px solid #0f3460; padding-bottom: 10px; }
  .meta { color: #555; margin-bottom: 20px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
  th { background: #0f3460; color: #fff; padding: 10px 8px; text-align: left; font-weight: 600; }
  td { padding: 8px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
  tr:nth-child(even) { background: #f8f9fa; }
  .tag-inclusao { background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .tag-alteracao { background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .tag-exclusao { background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #888; font-size: 11px; }
</style>
</head>
<body>
<h1>Relatório de Auditoria - SAP Business One HANA</h1>
<div class="meta">
  <p><strong>Período:</strong> ${formatDate(input.startDate || "")} a ${formatDate(input.endDate || "")}</p>
  <p><strong>Filtros:</strong> ${input.module ? `Módulo: ${input.module}` : "Todos os módulos"} | ${input.sapUser ? `Usuário: ${input.sapUser}` : "Todos os usuários"} | ${input.sourceTable ? `Tabela: ${input.sourceTable}` : "Todas as tabelas"}</p>
  <p><strong>Total de registros:</strong> ${rows.length.toLocaleString("pt-BR")}</p>
  <p><strong>Gerado em:</strong> ${new Date().toLocaleString("pt-BR")}</p>
</div>
<table>
<thead>
<tr><th>Data</th><th>Hora</th><th>Procedimento</th><th>Módulo</th><th>Rotina</th><th>Usuário</th><th>DocNum</th><th>Tabela</th><th>Conteúdo Anterior</th><th>Conteúdo Atual</th></tr>
</thead>
<tbody>
${rows
  .map(
    (r) => `<tr>
  <td>${formatDate(r.changeDate)}</td>
  <td>${r.changeTime ? `${r.changeTime.substring(0,2)}:${r.changeTime.substring(2,4)}` : "-"}</td>
  <td><span class="tag tag-${r.procedureType === "Inclusão" ? "inclusao" : r.procedureType === "Alteração" ? "alteracao" : "exclusao"}">${r.procedureType}</span></td>
  <td>${r.module}</td>
  <td>${r.routine}</td>
  <td><strong>${r.sapUser}</strong></td>
  <td>${r.docNum || "-"}</td>
  <td><code>${r.sourceTable}</code></td>
  <td style="font-family:monospace;font-size:10px">${r.previousContent || "N/A"}</td>
  <td style="font-family:monospace;font-size:10px">${r.currentContent || "N/A"}</td>
</tr>`
  )
  .join("\n")}
</tbody>
</table>
<div class="footer">
  <p>SAP Business One HANA Audit Dashboard - Relatório gerado automaticamente</p>
</div>
</body>
</html>`;

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileKey = `audit-reports/audit-report-${timestamp}.html`;
        const { url } = await storagePut(fileKey, htmlContent, "text/html; charset=utf-8");

        await insertAuditReport({
          title: `Relatório Auditoria ${input.startDate || "todas"} a ${input.endDate || "todas"}`,
          format: "pdf",
          fileKey,
          fileUrl: url,
          fileSize: Buffer.byteLength(htmlContent, "utf-8"),
          filters: JSON.stringify(input),
          recordCount: rows.length,
          generatedBy: ctx.user.id,
        });

        return { url, recordCount: rows.length };
      }),

    /** List saved reports */
    reports: protectedProcedure.query(() => getAuditReports()),

    /** Get temporary download URL for a report */
    reportDownloadUrl: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const report = await getAuditReportById(input.id);
        if (!report) return null;
        const { url } = await storageGet(report.fileKey);
        return { ...report, downloadUrl: url };
      }),
  }),
});

export type AppRouter = typeof appRouter;
