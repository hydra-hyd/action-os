"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, PageHeader, SectionTitle, Stat, inputClass, useNow } from "@/components/ui";
import { addHabit, archiveHabit, logHabit, undoHabitToday } from "@/lib/domain/actions";
import { formatRate, habitRate, habitStreakInfo } from "@/lib/domain/kpi";
import { localDate } from "@/lib/domain/util";
import { useAppState, useHydrated } from "@/lib/store";

const WD = ["日", "月", "火", "水", "木", "金", "土"];

export default function HabitsPage() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const [name, setName] = useState("");
  const [minimum, setMinimum] = useState("");
  const [anchor, setAnchor] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [error, setError] = useState("");

  if (!hydrated) return <div className="h-64" />;

  const habits = s.habits.filter((h) => !h.archived);
  const thirty = { from: new Date(now.getTime() - 29 * 86400000), to: new Date(now.getTime() + 86400000) };
  thirty.from.setHours(0, 0, 0, 0);

  const submit = () => {
    if (!name.trim() || !minimum.trim()) {
      setError("習慣名と最低実行条件を入力してください");
      return;
    }
    dispatch((st) => addHabit(st, { name, minimum, anchor, weekdays }));
    setName("");
    setMinimum("");
    setAnchor("");
    setWeekdays([]);
    setError("");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="習慣" sub="意志力に頼らない極小の行動から。途切れても実績は消えません。" />

      <Card>
        <SectionTitle>新しい習慣</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="習慣名">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="例：英単語" />
          </Field>
          <Field label="最低実行条件（極小）" hint="例：英単語1個／腕立て1回／読書1ページ">
            <input className={inputClass} value={minimum} onChange={(e) => setMinimum(e.target.value)} />
          </Field>
          <Field label="習慣チェーン：〜の直後に（任意）">
            <input className={inputClass} value={anchor} onChange={(e) => setAnchor(e.target.value)} placeholder="例：歯磨き" />
          </Field>
          <div>
            <div className="mb-1 text-sm font-medium">曜日（未選択＝毎日）</div>
            <div className="flex gap-1">
              {WD.map((w, i) => (
                <Button
                  key={w}
                  variant={weekdays.includes(i) ? "primary" : "secondary"}
                  className="min-w-10 px-2"
                  aria-pressed={weekdays.includes(i)}
                  onClick={() => setWeekdays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
                >
                  {w}
                </Button>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <Button variant="primary" className="mt-3" onClick={submit}>追加</Button>
      </Card>

      <Card>
        <SectionTitle>直近30日の習慣実行率</SectionTitle>
        <div className="text-2xl font-semibold">{formatRate(habitRate(s, thirty, now))}</div>
      </Card>

      {habits.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">まだ習慣がありません。</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {habits.map((h) => {
            const info = habitStreakInfo(s, h.id, now);
            const todayLog = s.habitLogs.find((l) => l.habitId === h.id && l.date === localDate(now));
            const scheduled = h.weekdays.length === 0 || h.weekdays.includes(now.getDay());
            const last14 = Array.from({ length: 14 }, (_, i) => {
              const d = new Date(now);
              d.setDate(d.getDate() - (13 - i));
              return { key: localDate(d), done: s.habitLogs.some((l) => l.habitId === h.id && l.date === localDate(d)) };
            });
            return (
              <li key={h.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{h.name}</span>
                        {!scheduled && <Badge>今日は予定外</Badge>}
                        {todayLog && <Badge tone="emerald">{todayLog.level === "normal" ? "通常達成" : "最低達成"}</Badge>}
                      </div>
                      <div className="text-xs text-zinc-500">
                        最低：{h.minimum}
                        {h.anchor && ` ・ ${h.anchor}の直後に`}
                        {h.weekdays.length > 0 && ` ・ ${[...h.weekdays].sort().map((d) => WD[d]).join("")}`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant={todayLog ? "secondary" : "primary"} onClick={() => dispatch((st) => logHabit(st, h.id, "minimum"))}>最低だけやった</Button>
                      <Button onClick={() => dispatch((st) => logHabit(st, h.id, "normal"))}>しっかりやった</Button>
                      {todayLog && <Button variant="ghost" onClick={() => dispatch((st) => undoHabitToday(st, h.id))}>取消</Button>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1" aria-label="直近14日">
                    {last14.map((d) => (
                      <span key={d.key} title={d.key} className={`h-4 flex-1 rounded ${d.done ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`} />
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Stat label="継続日数" value={`${info.streak}日`} />
                    <Stat label="累積実行" value={`${info.total}回`} />
                    <Stat label="中断後の復帰" value={`${info.comebacks}回`} />
                  </div>
                  <div className="mt-2 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`「${h.name}」をアーカイブしますか？記録は残ります。`)) dispatch((st) => archiveHabit(st, h.id));
                      }}
                    >
                      アーカイブ
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
