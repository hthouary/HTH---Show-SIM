/**
 * Small controlled form-field primitives used by the Inspector and Event editor.
 * They keep a local string buffer so typing feels natural and only commit valid
 * numbers back to the store on change/blur.
 */
import { useEffect, useState } from 'react';
import type { Vec3 } from '../../types/show';

interface NumberFieldProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}

export function NumberField({ label, value, onChange, step = 0.1, min, max, suffix }: NumberFieldProps) {
  const [buf, setBuf] = useState(String(round(value)));

  useEffect(() => {
    setBuf(String(round(value)));
  }, [value]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) {
      let v = n;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onChange(v);
    } else {
      setBuf(String(round(value)));
    }
  };

  return (
    <label className="block">
      {label && <div className="field-label">{label}</div>}
      <div className="relative">
        <input
          type="number"
          className="input"
          value={buf}
          step={step}
          onChange={(e) => {
            setBuf(e.target.value);
            commit(e.target.value);
          }}
          onBlur={(e) => commit(e.target.value)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

interface Vec3FieldProps {
  label: string;
  value: Vec3;
  onChange: (value: Vec3) => void;
  step?: number;
}

export function Vec3Field({ label, value, onChange, step = 0.1 }: Vec3FieldProps) {
  const set = (i: number, n: number) => {
    const next: Vec3 = [...value] as Vec3;
    next[i] = n;
    onChange(next);
  };
  const axes = ['X', 'Y', 'Z'];
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {value.map((v, i) => (
          <div key={i} className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600">
              {axes[i]}
            </span>
            <input
              type="number"
              step={step}
              className="input pl-5"
              value={round(v)}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (Number.isFinite(n)) set(i, n);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ColorFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="block">
      {label && <div className="field-label">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md border border-ink-700">
          <input
            type="color"
            value={normalizeHex(value)}
            onChange={(e) => onChange(e.target.value)}
            className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0"
          />
        </div>
        <input
          type="text"
          className="input font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function SliderField({ label, value, onChange, min = 0, max = 2, step = 0.05 }: SliderFieldProps) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="field-label mb-0">{label}</span>
        <span className="font-mono text-[10px] text-slate-400">{round(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="sf-range mt-1 w-full"
      />
    </label>
  );
}

interface SelectFieldProps<T extends string> {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  return (
    <label className="block">
      {label && <div className="field-label">{label}</div>}
      <select className="input cursor-pointer" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function normalizeHex(v: string): string {
  return /^#([0-9a-f]{6})$/i.test(v) ? v : '#22d3ee';
}
