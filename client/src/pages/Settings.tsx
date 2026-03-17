import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings2,
  Database,
  Calendar,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  Copy,
  Code2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SQL_SCRIPT_PREVIEW = `-- Script SQL de Auditoria SAP Business One on HANA
-- Schema: SBO_HELEXIA | Período configurável

SELECT 
    'Documento' AS "Tipo",
    CAST(T0."UpdateDate" AS DATE) AS "Data",
    NULL AS "Hora",
    CASE WHEN T0."LogInstanc" = 0 THEN 'Inclusão' ELSE 'Alteração' END AS "Procedimento",
    CASE T0."ObjType"
        WHEN '13' THEN 'Fatura de Saída'
        WHEN '17' THEN 'Pedido de Venda'
        WHEN '18' THEN 'Fatura de Entrada'
        WHEN '22' THEN 'Pedido de Compra'
        ELSE 'Objeto Tipo ' || T0."ObjType"
    END AS "Módulo/Rotina",
    T0."ObjType" AS "Cód. Objeto",
    CAST(T0."DocEntry" AS VARCHAR) AS "ID Interno",
    T1."U_NAME" AS "Usuário",
    CASE WHEN T0."LogInstanc" = 0 THEN 'N/A (Inclusão)'
        ELSE 'Total: ' || IFNULL(CAST(T_PREV."DocTotal" AS VARCHAR), '')
             || ' | PN: ' || IFNULL(T_PREV."CardCode", '')
             || ' | Status: ' || IFNULL(T_PREV."DocStatus", '')
    END AS "Conteúdo Anterior",
    'Total: ' || IFNULL(CAST(T0."DocTotal" AS VARCHAR), '')
    || ' | PN: ' || IFNULL(T0."CardCode", '')
    || ' | Status: ' || IFNULL(T0."DocStatus", '') AS "Conteúdo Atual"
FROM "SBO_HELEXIA".ADOC T0
INNER JOIN "SBO_HELEXIA".OUSR T1 ON T0."UserSign2" = T1."USERID"
LEFT JOIN "SBO_HELEXIA".ADOC T_PREV 
    ON T0."DocEntry" = T_PREV."DocEntry" 
    AND T0."ObjType" = T_PREV."ObjType" 
    AND T0."LogInstanc" = T_PREV."LogInstanc" + 1
WHERE CAST(T0."UpdateDate" AS DATE) BETWEEN :startDate AND :endDate

UNION ALL

-- [+ Parceiros de Negócios, Itens, Pagamentos, Ordens de Produção, Lançamentos Contábeis]
-- Consulte a documentação completa para o script integral.

ORDER BY "Data" DESC, "Hora" DESC;`;

const MODULES_INFO = [
  { table: "ADOC", label: "Documentos de Marketing", description: "Faturas, pedidos, cotações, entregas, devoluções", color: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  { table: "ACRD", label: "Parceiros de Negócio", description: "Clientes, fornecedores e leads", color: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  { table: "AITM", label: "Itens", description: "Cadastro de produtos e serviços", color: "bg-chart-3/10 text-chart-3 border-chart-3/20" },
  { table: "ARCT", label: "Pagamentos Recebidos", description: "Recebimentos com detalhes de cheques (ARC1)", color: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  { table: "AWOR", label: "Ordens de Produção", description: "Ordens de fabricação e montagem", color: "bg-primary/10 text-primary border-primary/20" },
  { table: "AJDT", label: "Lançamentos Contábeis", description: "Diário contábil e ajustes financeiros", color: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
];

export default function Settings() {
  const [schema, setSchema] = useState("SBO_HELEXIA");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: stats } = trpc.audit.stats.useQuery({});

  const handleSaveConfig = () => {
    if (!schema.trim()) {
      toast.error("O nome do schema é obrigatório");
      return;
    }
    // Save to localStorage for persistence
    localStorage.setItem("sap_schema", schema);
    localStorage.setItem("sap_start_date", startDate);
    localStorage.setItem("sap_end_date", endDate);
    setSaved(true);
    toast.success("Configurações salvas com sucesso");
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(SQL_SCRIPT_PREVIEW);
    toast.success("Script copiado para a área de transferência");
  };

  const totalRecords = stats?.totalRecords ?? 0;
  const lastImport = totalRecords > 0 ? "Dados disponíveis no banco" : "Nenhum dado importado";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure a conexão com o SAP Business One HANA e os parâmetros de auditoria
        </p>
      </div>

      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList className="bg-card border border-border/50">
          <TabsTrigger value="connection" className="gap-2">
            <Database className="h-4 w-4" />
            Conexão SAP HANA
          </TabsTrigger>
          <TabsTrigger value="period" className="gap-2">
            <Calendar className="h-4 w-4" />
            Período de Auditoria
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-2">
            <Info className="h-4 w-4" />
            Módulos Auditados
          </TabsTrigger>
          <TabsTrigger value="script" className="gap-2">
            <Code2 className="h-4 w-4" />
            Script SQL
          </TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Parâmetros de Conexão SAP HANA
              </CardTitle>
              <CardDescription>
                Configure o schema do banco de dados SAP Business One para auditoria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Banner */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-chart-2/5 border border-chart-2/20">
                <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-chart-2">Sistema Operacional</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{lastImport} — {totalRecords.toLocaleString("pt-BR")} registros no banco de dados local</p>
                </div>
                <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 border-chart-2/20 shrink-0">
                  Ativo
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="schema">Schema do Banco de Dados</Label>
                  <Input
                    id="schema"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    placeholder="SBO_HELEXIA"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome do schema SAP Business One no HANA (ex: SBO_HELEXIA)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Tabelas de Histórico Utilizadas</Label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["ADOC", "ACRD", "AITM", "ARCT", "ARC1", "AWOR", "AJDT", "OUSR"].map((t) => (
                      <Badge key={t} variant="secondary" className="font-mono text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tabelas de histórico do SAP B1 consultadas pelo script
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Permissões Necessárias no HANA</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1">
                    <p className="text-xs font-medium font-mono">SELECT em tabelas do schema</p>
                    <p className="text-xs text-muted-foreground">ADOC, ACRD, AITM, ARCT, ARC1, AWOR, AJDT, OUSR</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1">
                    <p className="text-xs font-medium font-mono">SELECT em visões do sistema</p>
                    <p className="text-xs text-muted-foreground">SYS.M_SQL_PLAN_CACHE, SYS.M_SQL_PLAN_CACHE_PARAMETERS</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <AlertCircle className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  O monitoramento via <span className="font-mono text-primary">SYS.M_SQL_PLAN_CACHE</span> é baseado em cache volátil e pode não fornecer histórico completo de todas as operações DML.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} className="gap-2">
                  {saved ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saved ? "Salvo!" : "Salvar Configurações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Period Tab */}
        <TabsContent value="period" className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Período Padrão de Auditoria
              </CardTitle>
              <CardDescription>
                Define o período padrão utilizado nas consultas de auditoria e no script SQL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data de Início</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Data inicial do período de auditoria
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data de Fim</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Data final do período de auditoria
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Períodos Rápidos</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Últimos 7 dias", days: 7 },
                    { label: "Últimos 30 dias", days: 30 },
                    { label: "Últimos 90 dias", days: 90 },
                    { label: "Este mês", days: 0, thisMonth: true },
                    { label: "Mês anterior", days: 0, lastMonth: true },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const end = now.toISOString().split("T")[0];
                        let start: string;
                        if (preset.thisMonth) {
                          start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                        } else if (preset.lastMonth) {
                          const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                          const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                          start = firstDay.toISOString().split("T")[0];
                          setEndDate(lastDay.toISOString().split("T")[0]);
                          setStartDate(start);
                          return;
                        } else {
                          const d = new Date(now);
                          d.setDate(d.getDate() - preset.days);
                          start = d.toISOString().split("T")[0];
                        }
                        setStartDate(start);
                        setEndDate(end);
                      }}
                      className="text-xs"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground">
                  <strong>Formato no script SQL:</strong> As datas são inseridas no formato <span className="font-mono">YYYYMMDD</span> nas cláusulas <span className="font-mono">WHERE</span> de cada <span className="font-mono">SELECT</span> do script de auditoria.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Período
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modules Tab */}
        <TabsContent value="modules" className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Módulos SAP B1 Auditados
              </CardTitle>
              <CardDescription>
                Visão geral dos módulos cobertos pelo script de auditoria e suas tabelas de histórico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MODULES_INFO.map((mod) => (
                  <div
                    key={mod.table}
                    className="p-4 rounded-lg border border-border/50 bg-card/30 space-y-2 hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">{mod.label}</h3>
                      <Badge className={`font-mono text-xs border ${mod.color}`}>
                        {mod.table}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Técnica de Comparação de Conteúdo</h3>
                <div className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    O script utiliza a técnica de <strong>Self-Join</strong> nas tabelas de histórico para comparar instâncias consecutivas de <span className="font-mono text-primary">LogInstanc</span>, exibindo o conteúdo anterior e atual de cada alteração.
                  </p>
                  <div className="font-mono text-xs bg-background/50 p-3 rounded border border-border/30 text-muted-foreground">
                    <span className="text-primary">LEFT JOIN</span> "SBO_HELEXIA".ADOC T_PREV<br />
                    &nbsp;&nbsp;<span className="text-primary">ON</span> T0."DocEntry" = T_PREV."DocEntry"<br />
                    &nbsp;&nbsp;<span className="text-primary">AND</span> T0."LogInstanc" = T_PREV."LogInstanc" <span className="text-chart-3">+ 1</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-chart-5/5 border border-chart-5/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-chart-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-chart-5">Limitação: Rastreamento de Exclusões</p>
                    <p className="text-xs text-muted-foreground">
                      O rastreamento de exclusões é limitado ao cache <span className="font-mono">SYS.M_SQL_PLAN_CACHE</span>, que é volátil. Para auditoria completa de exclusões, recomenda-se ativar o log de auditoria nativo do SAP HANA.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Script Tab */}
        <TabsContent value="script" className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    Script SQL de Auditoria
                  </CardTitle>
                  <CardDescription>
                    Script SQL para execução direta no SAP HANA Studio ou ferramenta equivalente
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyScript} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copiar Script
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-primary">Como usar este script</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Copie o script completo para o SAP HANA Studio</li>
                      <li>Substitua <span className="font-mono text-primary">:startDate</span> e <span className="font-mono text-primary">:endDate</span> pelas datas desejadas no formato <span className="font-mono">YYYYMMDD</span></li>
                      <li>Execute o script e exporte o resultado como CSV</li>
                      <li>Importe o CSV na página de <strong>Importação de Dados</strong> deste dashboard</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-lg bg-background/80 border border-border/50 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre leading-relaxed max-h-[500px] overflow-y-auto">
                  {SQL_SCRIPT_PREVIEW}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/20 border border-border/50 text-center">
                  <p className="text-2xl font-bold text-primary">7</p>
                  <p className="text-xs text-muted-foreground mt-1">Partes do script (UNION ALL)</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/20 border border-border/50 text-center">
                  <p className="text-2xl font-bold text-chart-2">6</p>
                  <p className="text-xs text-muted-foreground mt-1">Módulos SAP B1 cobertos</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/20 border border-border/50 text-center">
                  <p className="text-2xl font-bold text-chart-3">10</p>
                  <p className="text-xs text-muted-foreground mt-1">Colunas retornadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
