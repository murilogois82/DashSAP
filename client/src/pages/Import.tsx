import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

type ImportStatus = "idle" | "parsing" | "importing" | "success" | "error";

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
          Importe dados de auditoria exportados do SAP Business One HANA via CSV
        </p>
      </div>

      {/* Instructions */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Como Importar Dados do SAP HANA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: "1", icon: Database, title: "Execute o Script SQL", desc: "Execute o script de auditoria no SAP HANA Studio com o período desejado" },
              { step: "2", icon: FileSpreadsheet, title: "Exporte como CSV", desc: "Exporte o resultado da consulta como arquivo CSV com separador vírgula" },
              { step: "3", icon: Upload, title: "Faça o Upload", desc: "Arraste o arquivo CSV para a área abaixo ou clique para selecionar" },
              { step: "4", icon: CheckCircle2, title: "Dados Disponíveis", desc: "Os registros serão importados e estarão disponíveis no Dashboard e Timeline" },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{item.step}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
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
                <div>
                  <p className="text-base font-medium">
                    {dragOver ? "Solte o arquivo aqui" : "Arraste o arquivo CSV aqui"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ou clique para selecionar um arquivo
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="font-mono">.csv</Badge>
                  <Badge variant="secondary" className="font-mono">.txt</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Formato esperado: resultado do script SQL de auditoria SAP B1 HANA
                </p>
              </div>
            </div>
          )}

          {(status === "parsing" || status === "importing") && (
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium">
                    {status === "parsing" ? "Processando arquivo..." : "Importando registros..."}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
                </div>
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">{progress}% concluído</p>
              </div>
              {parsedRows.length > 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  {parsedRows.length.toLocaleString("pt-BR")} registros identificados
                </p>
              )}
            </div>
          )}

          {status === "success" && result && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-chart-2/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-chart-2" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-chart-2">Importação Concluída!</p>
                  <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="p-4 rounded-xl bg-chart-2/5 border border-chart-2/20 text-center">
                  <p className="text-2xl font-bold text-chart-2">{result.imported.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground mt-1">Importados</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/20 border border-border/50 text-center">
                  <p className="text-2xl font-bold">{result.total.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total</p>
                </div>
                <div className="p-4 rounded-xl bg-chart-3/5 border border-chart-3/20 text-center">
                  <p className="text-2xl font-bold text-chart-3">{result.skipped.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ignorados</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="max-w-lg mx-auto p-3 rounded-lg bg-chart-5/5 border border-chart-5/20">
                  <p className="text-xs font-medium text-chart-5 mb-2">Avisos ({result.errors.length})</p>
                  <ul className="space-y-1">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li className="text-xs text-muted-foreground">... e mais {result.errors.length - 5} avisos</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Nova Importação
                </Button>
                <Button
                  onClick={() => window.location.href = "/audit"}
                  className="gap-2"
                >
                  Ver Timeline de Auditoria
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-chart-5/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-chart-5" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-chart-5">Erro na Importação</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Verifique o formato do arquivo e tente novamente
                  </p>
                </div>
              </div>
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Tentar Novamente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Format Reference */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Formato Esperado do CSV
          </CardTitle>
          <CardDescription>
            O arquivo deve conter as colunas na ordem abaixo (resultado do script SQL de auditoria)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">#</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Coluna</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Descrição</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Exemplo</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["1", "Tipo", "Origem da auditoria", "Documento"],
                  ["2", "Data", "Data da operação", "2026-01-15"],
                  ["3", "Hora", "Hora da operação (opcional)", "143022"],
                  ["4", "Procedimento", "Tipo: Inclusão, Alteração ou Exclusão", "Alteração"],
                  ["5", "Módulo/Rotina", "Módulo ou rotina SAP", "Fatura de Saída"],
                  ["6", "Cód. Objeto", "Código do tipo de objeto SAP", "13"],
                  ["7", "ID Interno", "DocEntry, CardCode, ItemCode, etc.", "12345"],
                  ["8", "Usuário", "Nome do usuário SAP", "MANAGER"],
                  ["9", "Conteúdo Anterior", "Dados antes da alteração", "Total: 1500.00 | PN: C001"],
                  ["10", "Conteúdo Atual", "Dados após a alteração", "Total: 1800.00 | PN: C001"],
                ].map(([num, col, desc, ex]) => (
                  <tr key={num} className="border-b border-border/30 hover:bg-accent/5">
                    <td className="py-2 px-3 text-muted-foreground">{num}</td>
                    <td className="py-2 px-3 font-mono font-medium">{col}</td>
                    <td className="py-2 px-3 text-muted-foreground">{desc}</td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
