import type { ChartLegendOptions, TimePoint, TimeSeries, TimeSeriesPointTuple, UnitId } from '../types.js';

export interface NormalizedSeries {
  key: string;
  id: string;
  name: string;
  labels: TimeSeries['labels'];
  unit?: UnitId;
  color: string;
  values: Array<number | null | undefined>;
  raw: TimeSeries;
}

export interface NormalizedChartData {
  rows: Array<Record<string, number | null | undefined>>;
  series: NormalizedSeries[];
}

export const DEFAULT_CHART_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#a855f7',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#14b8a6',
  '#e11d48',
];

function isTuple(point: TimePoint | TimeSeriesPointTuple): point is TimeSeriesPointTuple {
  return Array.isArray(point);
}

export function toTimestamp(value: number | string | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid time value: ${value}`);
  }

  return parsed;
}

function pointToPair(point: TimePoint | TimeSeriesPointTuple): [number, number | null | undefined] {
  if (isTuple(point)) {
    return [toTimestamp(point[0]), point[1]];
  }

  return [toTimestamp(point.time), point.value];
}

export function resolveSeriesName(
  series: TimeSeries,
  index: number,
  template?: ChartLegendOptions['template']
): string {
  if (typeof template === 'function') {
    const rendered = template(series, index);
    return typeof rendered === 'string' || typeof rendered === 'number' ? String(rendered) : series.name ?? `Series ${index + 1}`;
  }

  if (typeof template === 'string' && template.trim()) {
    return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
      const value = series.labels?.[key];
      return value === null || value === undefined ? '' : String(value);
    });
  }

  if (series.name) {
    return series.name;
  }

  if (series.labels?.__name__) {
    return String(series.labels.__name__);
  }

  if (series.labels && Object.keys(series.labels).length > 0) {
    return Object.entries(series.labels)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key}="${value}"`)
      .join(', ');
  }

  return `Series ${index + 1}`;
}

export function normalizeSeries(
  input: TimeSeries[],
  options: {
    colors?: string[];
    defaultUnit?: UnitId;
    legendTemplate?: ChartLegendOptions['template'];
  } = {}
): NormalizedChartData {
  const rows = new Map<number, Record<string, number | null | undefined>>();
  const colors = options.colors?.length ? options.colors : DEFAULT_CHART_COLORS;
  const normalized = input.map((item, index): NormalizedSeries => {
    const key = `s${index}`;
    const values: Array<number | null | undefined> = [];

    item.points.forEach((point) => {
      const [time, value] = pointToPair(point);
      const row = rows.get(time) ?? { time };
      row[key] = value;
      rows.set(time, row);
      values.push(value);
    });

    return {
      key,
      id: item.id ?? key,
      name: resolveSeriesName(item, index, options.legendTemplate),
      labels: item.labels,
      unit: item.unit ?? options.defaultUnit,
      color: item.color ?? colors[index % colors.length],
      values,
      raw: item,
    };
  });

  return {
    rows: Array.from(rows.values()).sort((a, b) => Number(a.time) - Number(b.time)),
    series: normalized,
  };
}

export function getSeriesStat(
  series: NormalizedSeries,
  stat: NonNullable<ChartLegendOptions['value']>
): number | null | undefined {
  const values = series.values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (values.length === 0) {
    return null;
  }

  if (stat === 'last') {
    return values[values.length - 1];
  }

  if (stat === 'min') {
    return Math.min(...values);
  }

  if (stat === 'max') {
    return Math.max(...values);
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
