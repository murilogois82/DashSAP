import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Reports() {
  const { data: reports, isLoading } = trpc.audit.reports.useQuery();

  const handleDownload = (report: any) => {
    if (report.fileUrl) {
      window.open(report.fileUrl, "_blank");
    } else {
      toast.error("URL do relatório não disponível");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Carregando relatórios...</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          Relatórios Gerados
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de relatórios de auditoria exportados e armazenados
        </p>
      </div>

      {/* Reports List */}
      {!reports || reports.length === 0 ? (
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Nenhum relatório gerado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Exporte dados na página de Timeline de Auditoria para gerar relatórios.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {reports.map((report) => (
            <Card key={report.id} className="border-border/50 bg-card/50 backdrop-blur hover:bg-accent/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {report.format === "excel" ? (
                        <FileSpreadsheet className="h-5 w-5 text-chart-2" />
                      ) : (
                        <FileText className="h-5 w-5 text-chart-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{report.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(report.generatedAt)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {report.format === "excel" ? "CSV/Excel" : "HTML/PDF"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {report.recordCount?.toLocaleString("pt-BR")} registros
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(report.fileSize)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(report)}
                    className="gap-2 shrink-0"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
