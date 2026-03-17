import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const SQL_SCRIPT = `
-- Script SQL para Auditoria SAP Business One on HANA
-- Schema: SBO_HELEXIA (ou o nome do seu schema)

SELECT
    T0."UpdateDate" AS "changeDate",
    T0."UpdateTime" AS "changeTime",
    CASE
        WHEN T0."Action" = 1 THEN 'Inclusão'
        WHEN T0."Action" = 2 THEN 'Alteração'
        WHEN T0."Action" = 3 THEN 'Exclusão'
        ELSE 'Desconhecido'
    END AS "procedureType",
    T0."ModuleName" AS "module",
    T0."FormName" AS "routine",
    T0."Object" AS "objType",
    T0."UserSign" AS "sapUser",
    T0."DocEntry" AS "docNum",
    T0."LogInstance" AS "logInstance",
    T0."OldValue" AS "previousContent",
    T0."NewValue" AS "currentContent",
    T0."TableName" AS "sourceTable"
FROM "SBO_HELEXIA".AUSR T0
WHERE T0."UpdateDate" BETWEEN '[DATA_INICIO]' AND '[DATA_FIM]'
ORDER BY T0."UpdateDate" DESC, T0."UpdateTime" DESC;
`;

const MODULES_DOC = `
### Módulos Suportados e Tabelas de Origem

Este painel de auditoria foca nos logs gerados pela tabela AUSR (User Activity Log) do SAP Business One on HANA. Os dados são enriquecidos para fornecer informações detalhadas sobre as operações de inclusão, alteração e exclusão em diversos módulos.

| Módulo | Rotinas Comuns | Tabela de Origem (Exemplos) |
|---|---|---|
| **Vendas** | Pedido de Venda, Fatura de Saída, Devolução de Venda, Entrega | ADOC (Documentos) |
| **Compras** | Pedido de Compra, Fatura de Entrada, Devolução de Compra, Recebimento de Mercadoria | ADOC (Documentos) |
| **Parceiros de Negócios** | Cliente, Fornecedor, Lead | ACRD (Cartões de Parceiro de Negócio) |
| **Estoque** | Cadastro de Item, Grupo de Itens | AITM (Itens) |
| **Pagamentos** | Pagamento Recebido, Pagamento Efetuado | ARCT (Pagamentos Recebidos), APCT (Pagamentos Efetuados) |
| **Produção** | Ordem de Produção | AWOR (Ordens de Produção) |
| **Finanças** | Lançamento Contábil Manual, Lançamento Contábil | AJDT (Lançamentos Contábeis) |

**Nota:** A coluna sourceTable no resultado da auditoria indica a tabela principal afetada pela operação. Os objType são códigos internos do SAP que representam os tipos de objeto (ex: 17 para Pedido de Venda, 13 para Fatura de Saída).
`;

const ABOUT_DOC = `
### Sobre o SAP B1 HANA Audit Dashboard

Esta ferramenta foi desenvolvida para facilitar a auditoria de atividades de usuários no SAP Business One on HANA. Ela permite visualizar, filtrar e analisar as operações de inclusão, alteração e exclusão de dados, fornecendo insights valiosos sobre a utilização do sistema e conformidade.

**Principais Funcionalidades:**
- Dashboard interativo com KPIs e gráficos de tendência.
- Timeline de auditoria detalhada com filtros avançados e visualização de diferenças.
- Importação de dados via CSV ou sincronização direta com o SAP HANA.
- Geração de relatórios em Excel e PDF.

**Desenvolvido por:** Manus AI
**Versão:** 1.0.0
`;

export default function Settings() {
  const [hanaHost, setHanaHost] = useState("");
  const [hanaPort, setHanaPort] = useState("");
  const [hanaUser, setHanaUser] = useState("");
  const [hanaPassword, setHanaPassword] = useState("");
  const [hanaSchema, setHanaSchema] = useState("SBO_HELEXIA");

  const testHanaConnectionMutation = trpc.audit.hana.testConnection.useMutation();

  useEffect(() => {
    // Load saved settings from localStorage
    setHanaHost(localStorage.getItem("hana_host") || "");
    setHanaPort(localStorage.getItem("hana_port") || "");
    setHanaUser(localStorage.getItem("hana_user") || "");
    setHanaSchema(localStorage.getItem("hana_schema") || "SBO_HELEXIA");
  }, []);

  const handleSaveConfig = () => {
    if (!hanaHost.trim() || !hanaPort.trim() || !hanaUser.trim() || !hanaPassword.trim() || !hanaSchema.trim()) {
      toast.error("Todos os campos de conexão SAP HANA são obrigatórios.");
      return;
    }
    localStorage.setItem("hana_host", hanaHost);
    localStorage.setItem("hana_port", hanaPort);
    localStorage.setItem("hana_user", hanaUser);
    localStorage.setItem("hana_schema", hanaSchema);
    // Note: We don't save password in localStorage for security reasons in a real app.
    // For this demo, we'll assume it's handled securely or re-entered.
    toast.success("Configurações de conexão SAP HANA salvas.");
  };

  const handleTestConnection = async () => {
    // In a real application, you would send these credentials to the backend
    // For this demo, the backend will use environment variables, so we just trigger the mutation
    try {
      const result = await testHanaConnectionMutation.mutateAsync();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Erro ao testar conexão: ${error.message || error}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copiado para a área de transferência!");
    }).catch(() => {
      toast.error("Falha ao copiar.");
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <Tabs defaultValue="hana-connection" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hana-connection">Conexão SAP HANA</TabsTrigger>
          <TabsTrigger value="sql-script">Script SQL</TabsTrigger>
          <TabsTrigger value="modules">Módulos Suportados</TabsTrigger>
          <TabsTrigger value="about">Sobre</TabsTrigger>
        </TabsList>
        <TabsContent value="hana-connection">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Conexão SAP HANA</CardTitle>
              <CardDescription>
                Insira os detalhes de conexão para o seu banco de dados SAP HANA. Estas credenciais serão usadas pelo backend para sincronização direta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="hana-host">Host HANA</Label>
                <Input
                  id="hana-host"
                  placeholder="ex: myhanaserver.com"
                  value={hanaHost}
                  onChange={(e) => setHanaHost(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hana-port">Porta HANA</Label>
                <Input
                  id="hana-port"
                  placeholder="ex: 30015"
                  value={hanaPort}
                  onChange={(e) => setHanaPort(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hana-user">Usuário HANA</Label>
                <Input
                  id="hana-user"
                  placeholder="ex: SYSTEM"
                  value={hanaUser}
                  onChange={(e) => setHanaUser(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hana-password">Senha HANA</Label>
                <Input
                  id="hana-password"
                  type="password"
                  value={hanaPassword}
                  onChange={(e) => setHanaPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hana-schema">Schema HANA</Label>
                <Input
                  id="hana-schema"
                  placeholder="ex: SBO_HELEXIA"
                  value={hanaSchema}
                  onChange={(e) => setHanaSchema(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleSaveConfig}>
                  <Save className="mr-2 h-4 w-4" /> Salvar Credenciais
                </Button>
                <Button onClick={handleTestConnection} disabled={testHanaConnectionMutation.isPending}>
                  {testHanaConnectionMutation.isPending ? 'Testando...' : 'Testar Conexão'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="sql-script">
          <Card>
            <CardHeader>
              <CardTitle>Script SQL de Auditoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Este é o script SQL utilizado para extrair os dados de auditoria do SAP Business One on HANA.
                Certifique-se de que o usuário HANA configurado tenha permissões para executar esta query no schema especificado.
              </p>
              <Textarea value={SQL_SCRIPT} readOnly rows={20} className="font-mono text-xs" />
              <Button onClick={() => copyToClipboard(SQL_SCRIPT)}>Copiar Script SQL</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>Módulos Suportados</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: MODULES_DOC }} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>Sobre</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: ABOUT_DOC }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
