import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "../lib/api";
import { formatDateInput, formatDateLabel, startOfMonth } from "../lib/dateUtils";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { Input } from "../components/ui/Field";
import MultiSelect from "../components/ui/MultiSelect";
import ActivityCard from "../components/ActivityCard";
import ActivityModal from "../components/ActivityModal";

const round2 = (n) => Math.round(n * 100) / 100;

export default function ActivitiesPage({ members }) {
  const [activities, setActivities] = useState([]);
  const [filterMember, setFilterMember] = useState([]);
  const [filterQ, setFilterQ] = useState("");
  // Defaults to the current month so the list doesn't grow forever; Reset
  // clears every filter, dates included, to show everything.
  const [dateFrom, setDateFrom] = useState(() => startOfMonth());
  const [dateTo, setDateTo] = useState("");
  const [formActivity, setFormActivity] = useState(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickHours, setQuickHours] = useState("1");

  const load = useCallback(() => {
    const f = {};
    if (filterMember.length) f.member_id = filterMember;
    if (filterQ) f.q = filterQ;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    api.getActivities(f).then(setActivities).catch(console.error);
  }, [filterMember, filterQ, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const memberOptions = members.map((m) => ({ value: m.id, label: m.name }));

  // New entries should land inside the current filters, otherwise the item
  // you just added would vanish from the list. With several members
  // selected, the first selected one is used (and can be changed in the form).
  const defaultMemberId = () => filterMember[0] || members[0]?.id || "";
  const defaultDate = () => {
    const today = formatDateInput(new Date());
    if (dateFrom && today < dateFrom) return dateFrom;
    if (dateTo && today > dateTo) return dateTo;
    return today;
  };

  const openNew = () =>
    setFormActivity({
      member_id: defaultMemberId(),
      title: "",
      hours: 1,
      date: defaultDate(),
    });

  // A copy keeps the same title on purpose: repeating an activity on
  // another day (standup, support) is the usual reason to copy one.
  const openCopy = (activity) => setFormActivity({ ...activity, id: undefined });

  const quickHoursValue = parseFloat(quickHours);
  const quickValid = quickTitle.trim() !== "" && quickHoursValue > 0;

  const quickAdd = async () => {
    if (!quickValid) return;
    const memberId = defaultMemberId();
    if (!memberId) return alert("Tambahkan anggota tim terlebih dahulu");
    await api.createActivity({
      member_id: memberId,
      title: quickTitle.trim(),
      hours: quickHoursValue,
      date: defaultDate(),
    });
    setQuickTitle("");
    setQuickHours("1");
    load();
  };

  const handleSave = async (form) => {
    if (form.id) await api.updateActivity(form.id, form);
    else await api.createActivity(form);
    setFormActivity(null);
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteActivity(id);
    setFormActivity(null);
    load();
  };

  const resetFilters = () => {
    setFilterMember([]);
    setFilterQ("");
    setDateFrom("");
    setDateTo("");
  };

  // The API returns newest date first, so consecutive rows share a date.
  const groups = [];
  activities.forEach((a) => {
    const last = groups[groups.length - 1];
    if (last && last.date === a.date) last.items.push(a);
    else groups.push({ date: a.date, items: [a] });
  });
  const totalHours = round2(activities.reduce((sum, a) => sum + a.hours, 0));
  const today = formatDateInput(new Date());

  return (
    <div>
      <PageHeader
        title="Non-Task Activity"
        subtitle="Catat meeting, support, email, dan aktivitas non-task lainnya."
        action={
          <Button variant="primary" onClick={openNew}>
            <Plus size={16} /> Aktivitas Baru
          </Button>
        }
      />

      <Card className="mb-5 p-5">
        <div className="flex gap-2">
          <Input
            placeholder="Tambah cepat: judul aktivitas lalu Enter..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd()}
            className="flex-1"
          />
          <Input
            type="number"
            min="0.25"
            step="0.25"
            aria-label="Durasi (jam)"
            title="Durasi (jam)"
            value={quickHours}
            onChange={(e) => setQuickHours(e.target.value)}
            className="w-20 shrink-0"
          />
          <Button variant="primary" onClick={quickAdd} disabled={!quickValid}>
            Tambah
          </Button>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <MultiSelect
            options={memberOptions}
            selected={filterMember}
            onChange={setFilterMember}
            placeholder="Semua anggota"
            noun="anggota"
            className="w-full sm:w-44"
          />
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              placeholder="Cari judul..."
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              className="w-48 pl-8"
            />
          </div>
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            Dari
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            Sampai
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
          </label>
          <Button variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </Card>

      <div className="mb-3 text-[12.5px] text-ink-soft">
        {activities.length} aktivitas · {totalHours} jam
      </div>

      {groups.length === 0 && <EmptyState>Belum ada aktivitas</EmptyState>}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.date}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-ink-soft">
                {formatDateLabel(g.date)}
                {g.date === today && (
                  <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    Hari ini
                  </span>
                )}
              </h2>
              <span className="shrink-0 text-[12px] text-ink-faint">
                {round2(g.items.reduce((sum, a) => sum + a.hours, 0))} jam
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  member={memberById[a.member_id]}
                  onOpen={() => setFormActivity(a)}
                  onCopy={openCopy}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {formActivity && (
        <ActivityModal
          initial={formActivity}
          members={members}
          onClose={() => setFormActivity(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
