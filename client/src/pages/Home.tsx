import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  Activity,
  CalendarIcon,
  FileEdit,
  FilePlus,
  Trash2,
  Users,
  Database,
  TrendingUp,
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLORS = [
  "oklch(0.65 0.18 250)",
  "oklch(0.7 0.16 165)",
  "oklch(0.72 0.18 55)",
  "oklch(0.65 0.2 310)",
  "oklch(0.6 0.22 25)",
  "oklch(0.75 0.15 200)",
  "oklch(0.68 0.17 130)",
];

const PROCEDURE_COLORS: Record<string, string> = {
  "Inclusão": "oklch(0.7 0.16 165)",
  "Alteração": "oklch(0.72 0.18 55)",
  "Exclusão": "oklch(0.6 0.22 25)",
};

function formatDateParam(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(d: string): string {
  if (!d || d.length !== 8) return d;
  return `${d.substring(6, 8)}/${d.substring(4, 6)}`;
}

export default function Home() {
  const [startDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate] = useState(() => new Date());

  const startDateStr = useMemo(() => formatDateParam(startDate), [startDate]);
  const endDateStr = useMemo(() => formatDateParam(endDate), [endDate]);

  const { data: stats, isLoading } = trpc.audit.stats.useQuery({
    startDate: startDateStr,
    endDate: endDateStr,
  });

  const procedureIcons: Record<string, React.ReactNode> = {
    "Inclusão": <FilePlus className="h-4 w-4" />,
    "Alteração": <FileEdit className="h-4 w-4" />,
    "Exclusão": <Trash2 className="h-4 w-4" />,
  };

  const procedureData = useMemo(() => {
    if (!stats?.byProcedure) return [];
    return stats.byProcedure.map((p) => ({
      name: p.procedureType,
      value: p.count,
    }));
  }, [stats?.byProcedure]);

  const moduleData = useMemo(() => {
    if (!stats?.byModule) return [];
    return stats.byModule.slice(0, 7).map((m) => ({
      name: m.module,
      total: m.count,
    }));
  }, [stats?.byModule]);

  const userData = useMemo(() => {
    if (!stats?.byUser) return [];
    return stats.byUser.slice(0, 7).map((u) => ({
      name: u.sapUser,
      total: u.count,
    }));
  }, [stats?.byUser]);

  const dateData = useMemo(() => {
    if (!stats?.byDate) return [];
    return stats.byDate.map((d) => ({
      date: formatDateDisplay(d.changeDate),
      total: d.count,
    }));
  }, [stats?.byDate]);

  const totalByProcedure = useMemo(() => {
    if (!stats?.byProcedure) return { "Inclusão": 0, "Alteração": 0, "Exclusão": 0 };
    const map: Record<string, number> = { "Inclusão": 0, "Alteração": 0, "Exclusão": 0 };
    stats.byProcedure.forEach((p) => { map[p.procedureType] = p.count; });
    return map;
  }, [stats?.byProcedure]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-muted-foreground text-sm mt-1">Carregando dados de auditoria...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6"><div className="h-16 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Executivo</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geral das atividades de auditoria no SAP Business One HANA
          <span className="ml-2 text-xs opacity-70">
            ({format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")})
          </span>
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total de Registros</p>
                <p className="text-3xl font-bold mt-1">{stats?.totalRecords?.toLocaleString("pt-BR") ?? 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inclusões</p>
                <p className="text-3xl font-bold mt-1 text-chart-2">{totalByProcedure["Inclusão"]?.toLocaleString("pt-BR")}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                <FilePlus className="h-6 w-6 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alterações</p>
                <p className="text-3xl font-bold mt-1 text-chart-3">{totalByProcedure["Alteração"]?.toLocaleString("pt-BR")}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-chart-3/10 flex items-center justify-center">
                <FileEdit className="h-6 w-6 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exclusões</p>
                <p className="text-3xl font-bold mt-1 text-chart-5">{totalByProcedure["Exclusão"]?.toLocaleString("pt-BR")}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-chart-5/10 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-chart-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Timeline */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Atividade por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dateData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.015 260)" />
                  <XAxis dataKey="date" tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.17 0.01 260)",
                      border: "1px solid oklch(0.28 0.015 260)",
                      borderRadius: "8px",
                      color: "oklch(0.93 0.005 260)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="oklch(0.65 0.18 250)"
                    strokeWidth={2}
                    fill="url(#colorTotal)"
                    name="Registros"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Procedure Pie Chart */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Por Tipo de Procedimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={procedureData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {procedureData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PROCEDURE_COLORS[entry.name] || CHART_COLORS[index]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.17 0.01 260)",
                      border: "1px solid oklch(0.28 0.015 260)",
                      borderRadius: "8px",
                      color: "oklch(0.93 0.005 260)",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "oklch(0.6 0.02 260)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Module Bar Chart */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Alterações por Módulo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.015 260)" />
                  <XAxis type="number" tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.17 0.01 260)",
                      border: "1px solid oklch(0.28 0.015 260)",
                      borderRadius: "8px",
                      color: "oklch(0.93 0.005 260)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                    {moduleData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Bar Chart */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Alterações por Usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.015 260)" />
                  <XAxis type="number" tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.17 0.01 260)",
                      border: "1px solid oklch(0.28 0.015 260)",
                      borderRadius: "8px",
                      color: "oklch(0.93 0.005 260)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                    {userData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
