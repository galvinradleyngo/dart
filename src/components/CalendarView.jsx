import React from "react";
import { fmt, todayStr } from "../utils.js";

export default function CalendarView({ monthDate, tasks, milestones, team, onPrev, onNext, onToday, schedule, onTaskClick }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startDay = new Date(year, month, 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) =>
    new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + i)
  );
  const tasksByDue = tasks.reduce((acc, t) => {
    if (t.dueDate) (acc[t.dueDate] ||= []).push(t);
    return acc;
  }, {});
  const holidaySet = new Set(schedule.holidays);
  const workSet = new Set(schedule.workweek);
  return (
    <div className="border border-black/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white border-b border-black/10">
        <div className="font-medium">
          {monthDate.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50">
            Prev
          </button>
          <button onClick={onToday} className="px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50">
            Today
          </button>
          <button onClick={onNext} className="px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50">
            Next
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-sm bg-slate-50 border-b border-black/10">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>(
          <div key={i} className="p-2 text-center font-medium text-slate-700">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, idx) => {
          const key = fmt(d);
          const inMonth = d.getMonth() === month;
          const isHolidayDay = holidaySet.has(key);
          const isWork = workSet.has(d.getDay());
          const items = tasksByDue[key] || [];
          const isToday = key === todayStr();
          return (
            <div
              key={idx}
              className={`min-h-[96px] p-2 border-b border-r border-black/5 ${
                inMonth ? 'bg-white' : 'bg-slate-50'
              } ${isToday ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`text-sm ${inMonth ? 'text-slate-700' : 'text-slate-400'} ${
                    isToday ? 'px-1 rounded bg-indigo-600 text-white' : ''
                  }`}
                >
                  {d.getDate()}
                </div>
                {!isWork && (
                  <span className="text-sm px-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    Off
                  </span>
                )}
                {isHolidayDay && (
                  <span className="text-sm px-1 rounded bg-rose-100 text-rose-700 border border-rose-200">
                    Holiday
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full text-left text-sm truncate px-2 py-1 rounded border border-black/10 bg-sky-50 text-sky-800 hover:bg-sky-100"
                    onClick={() => onTaskClick?.(t)}
                    aria-label={`View task ${t.title}`}
                  >
                    {t.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="text-sm text-slate-500">+{items.length - 3} more…</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
