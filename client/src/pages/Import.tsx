import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  Database,
  RefreshCw,
  FileText,
  X,
  ArrowRight,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

type ImportStatus = "idle" | "parsing" | "importing" | "success" | "error" | "fetching_hana";

interface ParsedRow {
  tipo: string;
  data: string;
  hora: string;
  procedimento: string;
  modulo: string;
  rotina: string;
  codObjeto: string;
  idInterno: string;
  usuario: string;
  conteudoAnterior: string;
  conteudoAtual: string;
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function formatDateToYYYYMMDD(dateStr: string): string {
  if (!dateStr) return "";
  // Try DD/MM/YYYY
  const dmyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}${dmyMatch[2]}${dmyMatch[1]}`;
  // Try YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`;
  // Try YYYYMMDD
  if (/^\d{8}$/.test(dateStr)) return dateStr;
  return dateStr.replace(/[^0-9]/g, "").substring(0, 8);
}

const SOURCE_TABLE_MAP: Record<string, string> = {
  "Documento": "ADOC",
  "Parceiro de Negócio": "ACRD",
  "Item": "AITM",
  "Pagamento Recebido": "ARCT",
  "Ordem de Produção": "AWOR",
  "Lançamento Contábil": "AJDT",
  "Monitoramento DB": "SYS",
};

const MODULE_MAP: Record<string, string> = {
  "Fatura de Saída": "Vendas",
  "Nota de Crédito de Saída": "Vendas",
  "Entrega": "Vendas",
  "Devolução": "Vendas",
  "Pedido de Venda": "Vendas",
  "Cotação de Venda": "Vendas",
  "Fatura de Entrada": "Compras",
  "Nota de Crédito de Entrada": "Compras",
  "Recebimento de Mercadorias": "Compras",
  "Devolução de Mercadorias": "Compras",
  "Pedido de Compra": "Compras",
  "Cotação de Compra": "Compras",
  "Transferência de Estoque": "Estoque",
  "Cadastro de PN": "Parceiros de Negócio",
  "Cadastro de Item": "Itens",
  "Pagamentos Recebidos": "Financeiro",
  "Ordens de Produção": "Produção",
  "Lançamentos Contábeis": "Contabilidade",
  "Cache de SQL": "Monitoramento DB",
};

export default function Import() {
  const [hanaStartDate, setHanaStartDate] = useState("");
  const [hanaEndDate, setHanaEndDate] = useState("");
  const [hanaSchema, setHanaSchema] = useState("SBO_HELEXIA");

  const fetchHanaDataMutation = trpc.audit.hana.fetchAuditData.useMutation({
    onSuccess: (data) => {
      if (data.success && data.data) {
        const importData = data.data.map((row: any) => ({
          changeDate: row.changeDate,
          changeTime: row.changeTime || null,
          procedureType: row.procedureType,
          module: row.module,
          routine: row.routine,
          objType: row.objType || null,
          sapUser: row.sapUser,
          docNum: row.docNum || null,
          logInstance: row.logInstance || null,
          previousContent: row.previousContent || null,
          currentContent: row.currentContent || null,
          sourceTable: row.sourceTable,
        }));
        importMutation.mutate({ rows: importData, clearFirst: true });
      } else {
        setStatus("error");
        toast.error(data.message);
      }
    },
    onError: (err) => {
      setStatus("error");
      toast.error(`Erro ao buscar dados do HANA: ${err.message}`);
    },
  });

  useEffect(() => {
    // Load saved HANA schema from localStorage
    setHanaSchema(localStorage.getItem("hana_schema") || "SBO_HELEXIA");
  }, []);

  const handleFetchHanaData = async () => {
    if (!hanaStartDate || !hanaEndDate) {
      toast.error("Por favor, selecione o período de auditoria.");
      return;
    }
    setStatus("fetching_hana");
    try {
      await fetchHanaDataMutation.mutateAsync({ startDate: hanaStartDate.replace(/-/g, ""), endDate: hanaEndDate.replace(/-/g, ""), schema: hanaSchema });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  const [status, setStatus] = useState<ImportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = trpc.audit.importRows.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStatus("success");
      setProgress(100);
      toast.success(`${data.imported} registros importados com sucesso`);
    },
    onError: (err) => {
      setStatus("error");
      toast.error(`Erro na importação: ${err.message}`);
    },
  });

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast.error("Formato inválido. Use arquivos CSV ou TXT.");
      return;
    }
    setFileName(file.name);
    setStatus("parsing");
    setProgress(10);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("Arquivo vazio ou sem dados");
        setStatus("error");
        return;
      }

      setProgress(30);

      // Parse header
      const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const rows: ParsedRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 2) continue;

        // Try to map columns by position (standard SAP audit export format)
        // Expected: Tipo, Data, Hora, Procedimento, Módulo/Rotina, Cód. Objeto, ID Interno, Usuário, Conteúdo Anterior, Conteúdo Atual
        const row: ParsedRow = {
          tipo: cols[0] || "",
          data: cols[1] || "",
          hora: cols[2] || "",
          procedimento: cols[3] || "",
          modulo: cols[4] || "",
          rotina: cols[4] || "",
          codObjeto: cols[5] || "",
          idInterno: cols[6] || "",
          usuario: cols[7] || "",
          conteudoAnterior: cols[8] || "",
          conteudoAtual: cols[9] || "",
        };
        rows.push(row);
      }

      setParsedRows(rows);
      setProgress(60);
      setStatus("importing");

      // Convert to import format
      const importData = rows.map((r) => ({
        changeDate: formatDateToYYYYMMDD(r.data),
        changeTime: r.hora?.replace(/[^0-9]/g, "").substring(0, 6) || null,
        procedureType: (r.procedimento === "Inclusão" || r.procedimento === "Alteração" || r.procedimento === "Exclusão")
          ? r.procedimento as "Inclusão" | "Alteração" | "Exclusão"
          : "Alteração" as const,
        module: MODULE_MAP[r.modulo] || r.tipo || "Outros",
        routine: r.modulo || r.rotina || "N/A",
        objType: r.codObjeto || null,
        sapUser: r.usuario || "DESCONHECIDO",
        docNum: r.idInterno || null,
        logInstance: null,
        previousContent: r.conteudoAnterior || null,
        currentContent: r.conteudoAtual || null,
        sourceTable: SOURCE_TABLE_MAP[r.tipo] || "ADOC",
      }));

      setProgress(80);
      await importMutation.mutateAsync({ rows: importData });
    } catch (err: any) {
      setStatus("error");
      toast.error(`Erro ao processar arquivo: ${err.message}`);
    }
  }, [importMutation]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleReset = () => {
    setStatus("idle");
    setProgress(0);
    setParsedRows([]);
    setResult(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Importação de Dados
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Importe dados de auditoria do SAP Business One HANA via sincronização direta ou CSV
        </p>
      </div>

      {/* Sincronizar do HANA */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Sincronizar do SAP HANA
          </CardTitle>
          <CardDescription>
            Importe dados de auditoria diretamente do seu banco de dados SAP HANA.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hana-start-date">Data de Início</Label>
              <Input
                id="hana-start-date"
                type="date"
                value={hanaStartDate}
                onChange={(e) => setHanaStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hana-end-date">Data de Fim</Label>
              <Input
                id="hana-end-date"
                type="date"
                value={hanaEndDate}
                onChange={(e) => setHanaEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleFetchHanaData}
            disabled={fetchHanaDataMutation.isPending || status === "fetching_hana"}
            className="w-full"
          >
            {fetchHanaDataMutation.isPending || status === "fetching_hana" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {fetchHanaDataMutation.isPending || status === "fetching_hana" ? "Sincronizando..." : "Sincronizar do HANA"}
          </Button>
        </CardContent>
      </Card>

      {/* Importar via CSV */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Importar via CSV
          </CardTitle>
          <CardDescription>
            Importe dados de auditoria exportados do SAP Business One HANA via arquivo CSV.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {status === "idle" && (
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-primary/50 hover:bg-accent/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Arraste e solte seu arquivo CSV aqui, ou <span className="text-primary font-medium">clique para selecionar</span>
                </p>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="font-mono">.csv</Badge>
                  <Badge variant="secondary" className="font-mono">.txt</Badge>
                </div>
              </div>
            </div>
          )}

          {(status === "parsing" || status === "importing" || status === "fetching_hana") && (
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium">
                    {status === "parsing" ? "Processando arquivo..." : status === "fetching_hana" ? "Sincronizando com SAP HANA..." : "Importando registros..."}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {status === "success" && result && (
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-chart-2/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-chart-2" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-base font-medium">Importação Concluída</p>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{result.imported}</p>
                      <p className="text-xs text-muted-foreground">Importados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                      <p className="text-xs text-muted-foreground">Pulados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-chart-2">{result.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-destructive">Erros encontrados:</p>
                  <ul className="text-xs text-destructive/80 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 5 && <li>... e mais {result.errors.length - 5} erros</li>}
                  </ul>
                </div>
              )}
              <Button onClick={handleReset} className="w-full">
                Importar Outro Arquivo
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-destructive">Erro na Importação</p>
                  <p className="text-sm text-muted-foreground mt-1">Verifique o arquivo e tente novamente</p>
                </div>
              </div>
              <Button onClick={handleReset} className="w-full">
                Tentar Novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
