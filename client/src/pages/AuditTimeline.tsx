import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Search,
  X,
  Table2,
  SplitSquareHorizontal,
  Eye,
  Copy,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

function formatDateParam(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(d: string): string {
  if (!d || d.length !== 8) return d;
  return `${d.substring(6, 8)}/${d.substring(4, 6)}/${d.substring(0, 4)}`;
}

function formatInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseInputDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const PROCEDURE_STYLES: Record<string, { bg: string; text: string }> = {
  "Inclusão": { bg: "bg-chart-2/15", text: "text-chart-2" },
  "Alteração": { bg: "bg-chart-3/15", text: "text-chart-3" },
  "Exclusão": { bg: "bg-chart-5/15", text: "text-chart-5" },
};

export default function AuditTimeline() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedProcedure, setSelectedProcedure] = useState<string>("");
  const [selectedSourceTable, setSelectedSourceTable] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [detailLog, setDetailLog] = useState<any>(null);
  const [diffMode, setDiffMode] = useState(false);
  const pageSize = 25;

  const startDateStr = useMemo(() => formatDateParam(startDate), [startDate]);
  const endDateStr = useMemo(() => formatDateParam(endDate), [endDate]);

  const { data: modules } = trpc.audit.modules.useQuery();
  const { data: users } = trpc.audit.users.useQuery();
  const { data: sourceTables } = trpc.audit.sourceTables.useQuery();

  const filters = useMemo(
    () => ({
      startDate: startDateStr,
      endDate: endDateStr,
      sapUser: selectedUser || undefined,
      module: selectedModule || undefined,
      procedureType: (selectedProcedure || undefined) as any,
      sourceTable: selectedSourceTable || undefined,
      search: searchTerm || undefined,
      page,
      pageSize,
    }),
    [startDateStr, endDateStr, selectedUser, selectedModule, selectedProcedure, selectedSourceTable, searchTerm, page]
  );

  const { data: auditData, isLoading } = trpc.audit.list.useQuery(filters);

  const exportExcel = trpc.audit.exportExcel.useMutation({
    onSuccess: (data) => {
      toast.success(`Exportação concluída: ${data.recordCount} registros`);
      window.open(data.url, "_blank");
    },
    onError: () => toast.error("Erro ao exportar para Excel"),
  });

  const exportPdf = trpc.audit.exportPdf.useMutation({
    onSuccess: (data) => {
      toast.success(`Relatório gerado: ${data.recordCount} registros`);
      window.open(data.url, "_blank");
    },
    onError: () => toast.error("Erro ao gerar relatório PDF"),
  });

  const totalPages = Math.ceil((auditData?.total ?? 0) / pageSize);

  const clearFilters = () => {
    setSelectedUser("");
    setSelectedModule("");
    setSelectedProcedure("");
    setSelectedSourceTable("");
    setSearchTerm("");
    setPage(1);
  };

  const hasActiveFilters = selectedUser || selectedModule || selectedProcedure || selectedSourceTable || searchTerm;

  const exportFilters = {
    startDate: startDateStr,
    endDate: endDateStr,
    sapUser: selectedUser || undefined,
    module: selectedModule || undefined,
    procedureType: (selectedProcedure || undefined) as any,
    sourceTable: selectedSourceTable || undefined,
  };

  // Diff helper: highlight changed words between two strings
  function renderDiff(prev: string | null, curr: string | null) {
    if (!prev && !curr) return <span className="italic opacity-40">N/A</span>;
    if (!prev) return <span className="text-chart-2">{curr}</span>;
    if (!curr) return <span className="line-through text-chart-5">{prev}</span>;
    const prevParts = prev.split(/([\s,;|]+)/);
    const currParts = curr.split(/([\s,;|]+)/);
    const prevSet = new Set(prevParts);
    const currSet = new Set(currParts);
    return (
      <>
        {currParts.map((part, i) => (
          <span key={i} className={!prevSet.has(part) ? "bg-chart-2/20 text-chart-2 rounded px-0.5" : ""}>
            {part}
          </span>
        ))}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Timeline de Auditoria
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visualize todas as alterações realizadas no SAP Business One
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={diffMode ? "default" : "outline"}
            size="sm"
            onClick={() => setDiffMode(!diffMode)}
            className="gap-2"
            title="Ativar modo diff para visualizar diferenças entre conteúdo anterior e atual"
          >
            <SplitSquareHorizontal className="h-4 w-4" />
            {diffMode ? "Diff Ativo" : "Modo Diff"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportExcel.mutate(exportFilters)}
            disabled={exportExcel.isPending}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPdf.mutate(exportFilters)}
            disabled={exportPdf.isPending}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Filtros
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs gap-1">
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {/* Date Range */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
              <Input
                type="date"
                value={formatInputDate(startDate)}
                onChange={(e) => { setStartDate(parseInputDate(e.target.value)); setPage(1); }}
                className="h-9 text-sm bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data Final</label>
              <Input
                type="date"
                value={formatInputDate(endDate)}
                onChange={(e) => { setEndDate(parseInputDate(e.target.value)); setPage(1); }}
                className="h-9 text-sm bg-background"
              />
            </div>

            {/* User Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Usuário SAP</label>
              <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm bg-background">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Module Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Módulo</label>
              <Select value={selectedModule} onValueChange={(v) => { setSelectedModule(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm bg-background">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {modules?.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Procedure Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Procedimento</label>
              <Select value={selectedProcedure} onValueChange={(v) => { setSelectedProcedure(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm bg-background">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Inclusão">Inclusão</SelectItem>
                  <SelectItem value="Alteração">Alteração</SelectItem>
                  <SelectItem value="Exclusão">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Source Table Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tabela Origem</label>
              <Select value={selectedSourceTable} onValueChange={(v) => { setSelectedSourceTable(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm bg-background">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {sourceTables?.map((t) => (
                    <SelectItem key={t} value={t}><code className="text-xs">{t}</code></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="DocNum, conteúdo..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="h-9 pl-9 text-sm bg-background"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Hora</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Procedimento</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Módulo</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Rotina</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Usuário</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">DocNum</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Tabela</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider min-w-[200px]">{diffMode ? "Diff (Anterior → Atual)" : "Conteúdo Anterior"}</th>
                  {!diffMode && <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider min-w-[200px]">Conteúdo Atual</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      {[...Array(9)].map((_, j) => (
                        <td key={j} className="p-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : auditData?.data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-muted-foreground">
                      Nenhum registro encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  auditData?.data.map((log) => {
                    const style = PROCEDURE_STYLES[log.procedureType] || { bg: "bg-muted", text: "text-foreground" };
                    return (
                      <tr
                        key={log.id}
                        className="border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => setDetailLog(log)}
                      >
                        <td className="p-3 font-mono text-xs">{formatDateDisplay(log.changeDate)}</td>
                        <td className="p-3 font-mono text-xs">{log.changeTime || "-"}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className={`${style.bg} ${style.text} border-0 text-xs font-medium`}>
                            {log.procedureType}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">{log.module}</td>
                        <td className="p-3 text-xs">{log.routine}</td>
                        <td className="p-3 text-xs font-medium">{log.sapUser}</td>
                        <td className="p-3 font-mono text-xs">{log.docNum || "-"}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{log.sourceTable}</td>
                        {diffMode ? (
                          <td className="p-3 text-xs font-mono max-w-[400px]">
                            {renderDiff(log.previousContent, log.currentContent)}
                          </td>
                        ) : (
                          <>
                            <td className="p-3 text-xs text-muted-foreground max-w-[250px] truncate font-mono">
                              {log.previousContent || <span className="italic opacity-50">N/A</span>}
                            </td>
                            <td className="p-3 text-xs max-w-[250px] truncate font-mono">
                              {log.currentContent || <span className="italic opacity-50">N/A</span>}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {auditData && auditData.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, auditData.total)} de{" "}
                <span className="font-medium text-foreground">{auditData.total.toLocaleString("pt-BR")}</span> registros
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-3 text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalhes da Alteração
              {detailLog && (
                <Badge
                  variant="secondary"
                  className={`${PROCEDURE_STYLES[detailLog.procedureType]?.bg} ${PROCEDURE_STYLES[detailLog.procedureType]?.text} border-0`}
                >
                  {detailLog.procedureType}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Data</p>
                  <p className="text-sm font-mono">{formatDateDisplay(detailLog.changeDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Hora</p>
                  <p className="text-sm font-mono">{detailLog.changeTime || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Módulo</p>
                  <p className="text-sm">{detailLog.module}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Rotina</p>
                  <p className="text-sm">{detailLog.routine}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Usuário SAP</p>
                  <p className="text-sm font-medium">{detailLog.sapUser}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">DocNum</p>
                  <p className="text-sm font-mono">{detailLog.docNum || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Tabela Origem</p>
                  <p className="text-sm font-mono">{detailLog.sourceTable}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Log Instance</p>
                  <p className="text-sm font-mono">{detailLog.logInstance ?? "-"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-chart-5" />
                      Conteúdo Anterior
                    </p>
                    <div className="p-3 rounded-lg bg-chart-5/5 border border-chart-5/20 text-xs font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                      {detailLog.previousContent || <span className="italic opacity-50">N/A (Inclusão)</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-chart-2" />
                      Conteúdo Atual
                    </p>
                    <div className="p-3 rounded-lg bg-chart-2/5 border border-chart-2/20 text-xs font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                      {detailLog.currentContent || <span className="italic opacity-50">N/A</span>}
                    </div>
                  </div>
                </div>
                {detailLog.previousContent && detailLog.currentContent && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                      <SplitSquareHorizontal className="h-3 w-3" />
                      Diferenças Destacadas (Conteúdo Atual)
                    </p>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs font-mono whitespace-pre-wrap break-all max-h-[150px] overflow-y-auto">
                      {renderDiff(detailLog.previousContent, detailLog.currentContent)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
