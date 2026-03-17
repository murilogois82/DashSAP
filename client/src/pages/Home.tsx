import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  FileEdit,
  FilePlus,
  Trash2,
  Users,
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import { useLocation } from "wouter";

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

const TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.17 0.01 260)",
  border: "1px solid oklch(0.28 0.015 260)",
  borderRadius: "8px",
  color: "oklch(0.93 0.005 260)",
  fontSize: 12,
};
const TICK_STYLE = { fill: "oklch(0.6 0.02 260)", fontSize: 11 };
const GRID_COLOR = "oklch(0.28 0.015 260)";
const QUICK_PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function formatDateParam(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(d: string): string {
  if (!d || d.length !== 8) return d;
  return `${d.substring(6, 8)}/${d.substring(4, 6)}`;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  const startDate = useMemo(() => subDays(new Date(), selectedPeriod), [selectedPeriod]);
  const endDate = useMemo(() => new Date(), []);
  const startDateStr = useMemo(() => formatDateParam(startDate), [startDate]);
  const endDateStr = useMemo(() => formatDateParam(endDate), [endDate]);

  const prevStartDate = useMemo(() => subDays(startDate, selectedPeriod), [startDate, selectedPeriod]);
  const prevEndDate = useMemo(() => subDays(endDate, selectedPeriod), [endDate, selectedPeriod]);
  const prevStartStr = useMemo(() => formatDateParam(prevStartDate), [prevStartDate]);
  const prevEndStr = useMemo(() => formatDateParam(prevEndDate), [prevEndDate]);

  const { data: stats, isLoading } = trpc.audit.stats.useQuery({
    startDate: startDateStr,
    endDate: endDateStr,
  });

  const { data: prevStats } = trpc.audit.stats.useQuery({
    startDate: prevStartStr,
    endDate: prevEndStr,
  });

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

  const totalRecords = stats?.totalRecords ?? 0;
  const prevTotalRecords = prevStats?.totalRecords ?? 0;
  const deltaPercent = prevTotalRecords > 0
    ? Math.round(((totalRecords - prevTotalRecords) / prevTotalRecords) * 100)
    : 0;

  const topUser = useMemo(() => {
    if (!stats?.byUser || stats.byUser.length === 0) return null;
    return stats.byUser[0];
  }, [stats?.byUser]);

  const topModule = useMemo(() => {
    if (!stats?.byModule || stats.byModule.length === 0) return null;
    return stats.byModule[0];
  }, [stats?.byModule]);

  const exclusoesCount = totalByProcedure["Exclusão"] ?? 0;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Dashboard Executivo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral das atividades de auditoria — SAP Business One HANA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Período:</span>
          {QUICK_PERIODS.map((p) => (
            <Button
              key={p.days}
              variant={selectedPeriod === p.days ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(p.days)}
              className="h-8 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Registros</p>
                <p className="text-3xl font-bold">{totalRecords.toLocaleString("pt-BR")}</p>
                <div className="flex items-center gap-1">
                  {deltaPercent > 0 ? (
                    <TrendingUp className="h-3 w-3 text-chart-5" />
                  ) : deltaPercent < 0 ? (
                    <TrendingDown className="h-3 w-3 text-chart-2" />
                  ) : (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={`text-xs ${deltaPercent > 0 ? "text-chart-5" : deltaPercent < 0 ? "text-chart-2" : "text-muted-foreground"}`}>
                    {deltaPercent > 0 ? "+" : ""}{deltaPercent}% vs período anterior
                  </span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inclusões</p>
                <p className="text-3xl font-bold text-chart-2">{totalByProcedure["Inclusão"].toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">
                  {totalRecords > 0 ? Math.round((totalByProcedure["Inclusão"] / totalRecords) * 100) : 0}% do total
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-chart-2/10 flex items-center justify-center">
                <FilePlus className="h-5 w-5 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Alterações</p>
                <p className="text-3xl font-bold text-chart-3">{totalByProcedure["Alteração"].toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">
                  {totalRecords > 0 ? Math.round((totalByProcedure["Alteração"] / totalRecords) * 100) : 0}% do total
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
                <FileEdit className="h-5 w-5 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border/50 bg-card/50 backdrop-blur ${exclusoesCount > 0 ? "border-chart-5/30" : ""}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Exclusões</p>
                <p className={`text-3xl font-bold ${exclusoesCount > 0 ? "text-chart-5" : ""}`}>
                  {exclusoesCount.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalRecords > 0 ? Math.round((exclusoesCount / totalRecords) * 100) : 0}% do total
                </p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${exclusoesCount > 0 ? "bg-chart-5/10" : "bg-muted/30"}`}>
                {exclusoesCount > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-chart-5" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights Row */}
      {(topUser || topModule) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topUser && (
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-chart-4/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-chart-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Usuário mais ativo</p>
                    <p className="text-sm font-semibold font-mono truncate">{topUser.sapUser}</p>
                    <p className="text-xs text-muted-foreground">{topUser.count.toLocaleString("pt-BR")} operações</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {topModule && (
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Módulo mais movimentado</p>
                    <p className="text-sm font-semibold truncate">{topModule.module}</p>
                    <p className="text-xs text-muted-foreground">{topModule.count.toLocaleString("pt-BR")} registros</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-chart-2/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-chart-2" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Período analisado</p>
                  <p className="text-sm font-semibold">{selectedPeriod} dias</p>
                  <p className="text-xs text-muted-foreground">
                    {format(startDate, "dd/MM/yyyy")} — {format(endDate, "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timeline Chart - Full Width */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Atividade de Auditoria ao Longo do Tempo
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/audit")}
              className="text-xs gap-1 h-7"
            >
              Ver detalhes
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dateData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis
                  dataKey="date"
                  tick={TICK_STYLE}
                  interval={Math.max(0, Math.floor(dateData.length / 10) - 1)}
                />
                <YAxis tick={TICK_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {procedureData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PROCEDURE_COLORS[entry.name] || CHART_COLORS[index]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "oklch(0.6 0.02 260)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Module Bar Chart */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Alterações por Módulo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis type="number" tick={TICK_STYLE} />
                  <YAxis dataKey="name" type="category" width={130} tick={TICK_STYLE} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
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
      </div>

      {/* User Bar Chart - Full Width */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Alterações por Usuário SAP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="name" tick={TICK_STYLE} />
                <YAxis tick={TICK_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="total" name="Operações" radius={[4, 4, 0, 0]}>
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
  );
}
