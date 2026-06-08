'use client';

import { useMemo } from 'react';

export interface AvailabilityBlock {
  id?: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface AvailabilityCalendarProps {
  blocks: AvailabilityBlock[];
  monthsToShow?: number;
  className?: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_STYLES: Record<string, string> = {
  booked: 'bg-red-100 text-red-700 border-red-200',
  hold: 'bg-amber-100 text-amber-700 border-amber-200',
  option: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  maintenance: 'bg-slate-200 text-slate-700 border-slate-300',
  owner_use: 'bg-blue-100 text-blue-700 border-blue-200',
};

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function buildMonthGrid(monthDate: Date) {
  const firstDay = startOfMonth(monthDate);
  const lastDay = endOfMonth(monthDate);
  const leadingDays = firstDay.getDay();
  const trailingDays = 6 - lastDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - leadingDays);
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(gridEnd.getDate() + trailingDays);

  const days: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function getBlockForDay(day: Date, blocks: AvailabilityBlock[]) {
  return blocks.find((block) => {
    const start = parseDate(block.start_date);
    const end = parseDate(block.end_date);
    return day >= start && day <= end;
  });
}

export default function AvailabilityCalendar({ blocks, monthsToShow = 2, className = '' }: AvailabilityCalendarProps) {
  const orderedBlocks = useMemo(
    () => [...blocks].sort((left, right) => left.start_date.localeCompare(right.start_date)),
    [blocks],
  );

  const months = useMemo(() => {
    const anchor = orderedBlocks[0]?.start_date ? parseDate(orderedBlocks[0].start_date) : new Date();
    const monthStart = startOfMonth(anchor);
    return Array.from({ length: monthsToShow }, (_, index) => {
      const monthDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + index, 1);
      return {
        monthDate,
        label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        days: buildMonthGrid(monthDate),
      };
    });
  }, [monthsToShow, orderedBlocks]);

  const legend = useMemo(() => {
    const presentStatuses = Array.from(new Set(orderedBlocks.map((block) => block.status)));
    return presentStatuses.length ? presentStatuses : ['booked', 'hold', 'option'];
  }, [orderedBlocks]);

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div className="flex flex-wrap gap-2 text-xs">
        {legend.map((status) => (
          <span
            key={status}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 font-medium capitalize ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
          >
            {status.replace('_', ' ')}
          </span>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {months.map(({ monthDate, label, days }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
              <span className="text-xs text-gray-400">{monthDate.toLocaleDateString('en-US', { month: 'short' })}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400">
              {DAY_LABELS.map((labelDay) => (
                <div key={labelDay} className="py-1 font-medium uppercase tracking-wide">{labelDay}</div>
              ))}
              {days.map((day) => {
                const block = getBlockForDay(day, orderedBlocks);
                const inMonth = day.getMonth() === monthDate.getMonth();
                const isToday = isSameDay(day, new Date());
                const statusStyle = block ? (STATUS_STYLES[block.status] ?? 'bg-gray-100 text-gray-700 border-gray-200') : 'bg-white text-gray-700 border-gray-100';
                return (
                  <div
                    key={day.toISOString()}
                    title={block ? `${block.status.replace('_', ' ')}: ${block.start_date} to ${block.end_date}` : 'Open for inquiry'}
                    className={[
                      'rounded-lg border px-0 py-2 text-xs transition-colors',
                      inMonth ? statusStyle : 'border-transparent bg-transparent text-gray-300',
                      isToday ? 'ring-2 ring-[#10214F]/20' : '',
                    ].join(' ')}
                  >
                    {day.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}