import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { api } from "../lib/api";
import { formatDateInput, shiftWorkloadDate } from "../lib/dateUtils";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SegmentedControl from "../components/ui/SegmentedControl";
import MemberWorkloadRow from "../components/MemberWorkloadRow";
import WorkloadDetailModal from "../components/WorkloadDetailModal";

const PERIOD_OPTIONS = [
  { value: "day", label: "Harian" },
  { value: "week", label: "Mingguan" },
  { value: "month", label: "Bulanan" },
];

const CHART_COLOR = {
  idle: "#8E8E93",
  low: "#5AC8FA",
  normal: "#34C759",
  padat: "#FF9F0A",
  overload: "#FF3B30",
};

const RISK_LABEL = { high: "Tinggi", medium: "Sedang", low: "Rendah" };

export default function WorkloadPage({ members }) {
  const [period, setPeriod] = useState("week");
  const [referenceDate, setReferenceDate] = useState(() => formatDateInput(new Date()));
  const [data, setData] = useState(null);
  const [burnout, setBurnout] = useState([]);
  const [detailMember, setDetailMember] = useState(null);
  const [detailData, setDetailData] = useState(null);

  const load = useCallback(() => {
    api.getWorkload(period, referenceDate).then(setData).catch(console.error);
    api.getBurnout().then(setBurnout).catch(console.error);
  }, [period, referenceDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!detailMember) return undefined;
    let cancelled = false;
    setDetailData(null);
    api
      .getWorkloadDetails(detailMember.id, period, referenceDate)
      .then((details) => {
        if (!cancelled) setDetailData(details);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setDetailData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [detailMember, period, referenceDate]);

  const closeDetails = () => {
    setDetailMember(null);
    setDetailData(null);
  };

  const applySuggestion = async (s) => {
    if (s.action === "reassign") {
      await api.updateTask(s.task_id, { assignee_id: s.suggested_assignee_id });
    } else {
      await api.updateTask(s.task_id, { due_date: s.suggested_new_due_date });
    }
    load();
  };

  const chartData =
    data?.members.map((m) => ({
      name: m.member.name.split(" ")[0],
      percent: m.percent,
      status: m.status,
    })) || [];

  return (
    <div>
      <PageHeader
        title="Analisis Beban Kerja"
        subtitle="Pantau beban harian, mingguan, dan bulanan — lengkap dengan saran otomatis saat overload."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
            <button
              onClick={() => setReferenceDate((v) => shiftWorkloadDate(v, -1, period))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
              aria-label="Periode sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              aria-label="Tanggal referensi analisis beban"
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="h-8 border-none bg-transparent px-1 text-[13.5px] outline-none"
            />
            <button
              onClick={() => setReferenceDate((v) => shiftWorkloadDate(v, 1, period))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
              aria-label="Periode berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="text-[12.5px] text-ink-faint">
            {data?.members?.[0]?.range
              ? `${data.members[0].range.start} — ${data.members[0].range.end}`
              : referenceDate}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 text-[15px] font-semibold text-ink">Persentase Beban per Orang</div>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(29,29,31,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6E6E73" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6E73" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  formatter={(v) => `${v}%`}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E5E5EA", fontSize: 13 }}
                />
                <Bar dataKey="percent" radius={[8, 8, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={CHART_COLOR[d.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-[15px] font-semibold text-ink">Risiko Burnout</div>
          <div className="space-y-3.5">
            {burnout.map((b) => (
              <div key={b.member_id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-ink">{b.member_name}</div>
                  <div className="text-[12px] text-ink-soft">
                    {b.overload_days} dari {b.lookback_days} hari overload · streak {b.current_streak} hari
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                    b.risk === "high"
                      ? "bg-status-overload/10 text-status-overload"
                      : b.risk === "medium"
                      ? "bg-status-padat/10 text-[#c9760a]"
                      : "bg-status-normal/10 text-[#1a8a3d]"
                  }`}
                >
                  {RISK_LABEL[b.risk]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-5">
        {data?.members.map((m) => (
          <MemberWorkloadRow
            key={m.member.id}
            entry={m}
            onShowDetails={() => setDetailMember(m.member)}
            onApplySuggestion={applySuggestion}
          />
        ))}
      </div>

      {detailMember && (
        <WorkloadDetailModal member={detailMember} data={detailData} onClose={closeDetails} />
      )}
    </div>
  );
}
