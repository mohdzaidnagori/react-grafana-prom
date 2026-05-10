import type { ReactNode } from 'react';

export type UnitId = string;
export type ChartTheme = 'auto' | 'light' | 'dark';
export type TimeSeriesPointTuple = [time: number | string | Date, value: number | null | undefined];

export interface TimePoint {
  time: number | string | Date;
  value: number | null | undefined;
}

export interface TimeSeries {
  id?: string;
  name?: string;
  labels?: Record<string, string | number | boolean | null | undefined>;
  points: TimeSeriesPointTuple[] | TimePoint[];
  unit?: UnitId;
  color?: string;
}

export interface ChartLegendOptions {
  show?: boolean;
  template?: string | ((series: TimeSeries, index: number) => ReactNode);
  value?: 'last' | 'min' | 'max' | 'avg' | false;
  placement?: 'bottom' | 'right';
  behavior?: 'toggle' | 'isolate' | 'toggle-or-isolate';
  searchable?: boolean;
  searchPlaceholder?: string;
  maxHeight?: number;
}

export interface ChartTooltipOptions {
  show?: boolean;
  sort?: 'none' | 'asc' | 'desc';
  maxHeight?: number;
  timestampFormat?: Intl.DateTimeFormatOptions;
}

export interface ChartFallbackSize {
  width: number;
  height: number;
}

export interface TimeSeriesChartProps {
  series: TimeSeries[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  card?: boolean;
  unit?: UnitId;
  variant?: 'line' | 'area';
  theme?: ChartTheme;
  height?: number;
  aspectRatio?: number;
  fallbackSize?: ChartFallbackSize;
  decimals?: number;
  className?: string;
  chartClassName?: string;
  colors?: string[];
  legend?: boolean | ChartLegendOptions;
  showGrid?: boolean;
  showTooltip?: boolean;
  tooltip?: boolean | ChartTooltipOptions;
  syncId?: string;
  emptyState?: ReactNode;
}

export type StatType = 'last' | 'min' | 'max' | 'avg' | 'sum' | 'count';

export interface HeatmapTableSeriesInput {
  key: string;
  query?: string;
  data: TimeSeries[];
}

export interface HeatmapTableHeatConfig {
  min?: number;
  max?: number;
  colors?: string[];
}

interface HeatmapTableColumnBase {
  key: string;
  label?: string;
  header?: ReactNode;
  width?: number | string;
}

export interface HeatmapTableLabelColumn extends HeatmapTableColumnBase {
  type: 'label';
}

export interface HeatmapTableValueColumn extends HeatmapTableColumnBase {
  type: 'value';
  unit?: UnitId;
  decimals?: number;
  stat?: StatType;
  heat?: false | HeatmapTableHeatConfig;
}

export type HeatmapTableColumn = HeatmapTableLabelColumn | HeatmapTableValueColumn;

export interface HeatmapTableProps {
  series: HeatmapTableSeriesInput[];
  joinBy: string;
  columns: HeatmapTableColumn[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  card?: boolean;
  theme?: ChartTheme;
  className?: string;
  stat?: StatType;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  fluid?: boolean;
  sortable?: boolean;
  emptyState?: ReactNode;
  decimals?: number;
}
