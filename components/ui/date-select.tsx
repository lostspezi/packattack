"use client";

import { useState, useEffect } from "react";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";

interface DateSelectProps {
  label?: string;
  value: string; // ISO date string YYYY-MM-DD or ""
  onChange: (value: string) => void;
  error?: string;
  maxYear?: number;
  minYear?: number;
}

const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getDaysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

export function DateSelect({
  label,
  value,
  onChange,
  error,
  maxYear,
  minYear,
}: DateSelectProps) {
  const currentYear = new Date().getFullYear();
  const max = maxYear ?? currentYear;
  const min = minYear ?? 1920;

  // Parse initial value
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");

  useEffect(() => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        setYear(parts[0]);
        setMonth(String(parseInt(parts[1], 10)));
        setDay(String(parseInt(parts[2], 10)));
      }
    }
  }, [value]);

  function emitChange(y: string, m: string, d: string) {
    if (y && m && d) {
      const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      onChange(iso);
    } else {
      onChange("");
    }
  }

  // Day options
  const daysInMonth = getDaysInMonth(parseInt(month) || 0, parseInt(year) || currentYear);
  const dayOptions: SelectOption[] = [
    { label: "Day", value: "" },
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      label: String(i + 1),
      value: String(i + 1),
    })),
  ];

  // Month options — detect language from document
  const isDE = typeof document !== "undefined" && document.documentElement.lang === "de";
  const monthNames = isDE ? MONTHS_DE : MONTHS_EN;
  const monthOptions: SelectOption[] = [
    { label: isDE ? "Monat" : "Month", value: "" },
    ...monthNames.map((name, i) => ({
      label: name,
      value: String(i + 1),
    })),
  ];

  // Year options (descending)
  const yearOptions: SelectOption[] = [
    { label: isDE ? "Jahr" : "Year", value: "" },
    ...Array.from({ length: max - min + 1 }, (_, i) => ({
      label: String(max - i),
      value: String(max - i),
    })),
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-text-secondary text-sm font-medium">
          {label}
        </label>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Select
          options={dayOptions}
          value={day}
          onChange={(v) => {
            setDay(v);
            emitChange(year, month, v);
          }}
          placeholder="Day"
          size="md"
        />
        <Select
          options={monthOptions}
          value={month}
          onChange={(v) => {
            setMonth(v);
            // Adjust day if needed
            const maxDays = getDaysInMonth(parseInt(v) || 0, parseInt(year) || currentYear);
            const adjustedDay = parseInt(day) > maxDays ? String(maxDays) : day;
            setDay(adjustedDay);
            emitChange(year, v, adjustedDay);
          }}
          placeholder="Month"
          size="md"
        />
        <Select
          options={yearOptions}
          value={year}
          onChange={(v) => {
            setYear(v);
            emitChange(v, month, day);
          }}
          placeholder="Year"
          size="md"
        />
      </div>
      {error && (
        <span className="text-error text-xs mt-0.5">{error}</span>
      )}
    </div>
  );
}
