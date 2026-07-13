'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AvailabilityBlock } from './AvailabilityCalendar';

interface BookingRangeCalendarProps {
  blocks: AvailabilityBlock[];
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const BLOCKED_STATUSES = new Set(['booked', 'hold', 'option']);

function toKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseKey(key: string) {
  return new Date(`${key}T00:00:00`);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(monthDate: Date) {
  const firstDay = startOfMonth(monthDate);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
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

/**
 * A single visible month with click-to-select date range, styled like a
 * hotel booking widget rather than the multi-month read-only availability
 * grid shown elsewhere on the page. Days that overlap a booked/hold/option
 * availability block are shown but disabled — the calendar itself never
 * blocks an inquiry (the charter company always makes the final call), it
 * just makes it obvious up front which dates are already spoken for.
 */
export default function BookingRangeCalendar({ blocks, startDate, endDate, onChange }: BookingRangeCalendarProps) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(startDate ? parseKey(startDate) : new Date()));

  const blockedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const block of blocks) {
      if (!BLOCKED_STATUSES.has(block.status)) continue;
      const cursor = parseKey(block.start_date);
      const end = parseKey(block.end_date);
      while (cursor <= end) {
        set.add(toKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return set;
  }, [blocks]);

  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const startKey = startDate || null;
  const endKey = endDate || null;

  const handleDayClick = (day: Date, blocked: boolean, past: boolean) => {
    if (blocked || past) return;
    const key = toKey(day);
    if (!startKey || (startKey && endKey)) {
      // Nothing selected yet, or a full range already exists — start fresh.
      onChange(key, '');
    } else if (key < startKey) {
      // Clicked before the existing start — treat as the new start.
      onChange(key, '');
    } else {
      onChange(startKey, key);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#10214F] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-[#10214F]">{monthLabel}</p>
        <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#10214F] transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-400 mb-1">
        {DAY_LABELS.map((label, i) => <div key={i} className="py-1">{label}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const key = toKey(day);
          const inMonth = day.getMonth() === viewMonth.getMonth();
          const blocked = blockedKeys.has(key);
          const past = day < today;
          const isStart = key === startKey;
          const isEnd = key === endKey;
          const inRange = !!startKey && !!endKey && key > startKey && key < endKey;
          const disabled = blocked || past || !inMonth;

          let classes = 'aspect-square flex items-center justify-center rounded-lg text-xs transition-colors';
          if (!inMonth) classes += ' text-transparent pointer-events-none';
          else if (disabled) classes += ' text-gray-300 line-through cursor-not-allowed';
          else if (isStart || isEnd) classes += ' bg-[#10214F] text-white font-semibold';
          else if (inRange) classes += ' bg-[#01BBDC]/15 text-[#10214F]';
          else classes += ' text-[#10214F] hover:bg-gray-100 cursor-pointer';

          return (
            <button
              type="button"
              key={i}
              disabled={disabled}
              onClick={() => handleDayClick(day, blocked, past)}
              title={blocked ? 'Not available' : undefined}
              className={classes}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>{startKey ? new Date(`${startKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Start date'}</span>
        <span className="text-gray-300">→</span>
        <span>{endKey ? new Date(`${endKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'End date'}</span>
        {(startKey || endKey) && (
          <button type="button" onClick={() => onChange('', '')} className="text-[#01BBDC] hover:underline ml-2">Clear</button>
        )}
      </div>
    </div>
  );
}
