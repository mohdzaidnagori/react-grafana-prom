"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ChartLegendOptions, ChartTooltipOptions, TimeSeriesChartProps } from '../types.js';
import { formattedValueToString, getValueFormat } from '../lib/formatters.js';
import { getSeriesStat, normalizeSeries } from '../lib/series.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const DEFAULT_FALLBACK_SIZE = { width: 300, height: 200 };
const PROXIMITY_THRESHOLD = 5; // series count threshold for proximity mode

/* ------------------------------------------------------------------ */
/*  Tiny helpers                                                      */
/* ------------------------------------------------------------------ */

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function cssVars(vars: Record<string, string | number | undefined>): CSSProperties {
  return vars as CSSProperties;
}

const formatTimeTickCache = new Map<number, string>();
function formatTimeTick(value: number | string): string {
  const num = Number(value);
  const cached = formatTimeTickCache.get(num);
  if (cached) return cached;
  const result = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(num));
  if (formatTimeTickCache.size > 500) formatTimeTickCache.clear();
  formatTimeTickCache.set(num, result);
  return result;
}

function formatTimestamp(value: number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    ...options,
  }).format(new Date(value));
}

/* ------------------------------------------------------------------ */
/*  useElementSize – ResizeObserver hook                               */
/* ------------------------------------------------------------------ */

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;

    if (!node || typeof window === 'undefined') {
      return;
    }

    const readSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    readSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', readSize);
      return () => window.removeEventListener('resize', readSize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const box = entry?.contentRect;

      if (!box) {
        readSize();
        return;
      }

      setSize({
        width: Math.max(0, Math.floor(box.width)),
        height: Math.max(0, Math.floor(box.height)),
      });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

/* ------------------------------------------------------------------ */
/*  Option resolvers                                                  */
/* ------------------------------------------------------------------ */

type ResolvedLegendOptions = {
  show: boolean;
  template?: ChartLegendOptions['template'];
  value: NonNullable<ChartLegendOptions['value']>;
  placement: NonNullable<ChartLegendOptions['placement']>;
  behavior: NonNullable<ChartLegendOptions['behavior']>;
  searchable: boolean;
  searchPlaceholder: string;
  maxHeight: number;
};

type ResolvedTooltipOptions = {
  show: boolean;
  sort: NonNullable<ChartTooltipOptions['sort']>;
  maxHeight: number;
  timestampFormat?: ChartTooltipOptions['timestampFormat'];
};

function resolveLegend(legend: TimeSeriesChartProps['legend'], seriesCount: number): ResolvedLegendOptions {
  if (legend === false) {
    return {
      show: false,
      value: 'last',
      placement: 'bottom',
      behavior: 'toggle-or-isolate',
      searchable: false,
      searchPlaceholder: 'Search series',
      maxHeight: 160,
    };
  }

  if (legend === true || legend === undefined) {
    return {
      show: true,
      value: 'last',
      placement: 'bottom',
      behavior: 'toggle-or-isolate',
      searchable: seriesCount > 12,
      searchPlaceholder: 'Search series',
      maxHeight: 160,
    };
  }

  return {
    show: legend.show ?? true,
    template: legend.template,
    value: legend.value ?? 'last',
    placement: legend.placement ?? 'bottom',
    behavior: legend.behavior ?? 'toggle-or-isolate',
    searchable: legend.searchable ?? seriesCount > 12,
    searchPlaceholder: legend.searchPlaceholder ?? 'Search series',
    maxHeight: legend.maxHeight ?? (legend.placement === 'right' ? 320 : 160),
  };
}

function resolveTooltip(
  tooltip: TimeSeriesChartProps['tooltip'],
  showTooltip: TimeSeriesChartProps['showTooltip']
): ResolvedTooltipOptions {
  if (tooltip === false || showTooltip === false) {
    return {
      show: false,
      sort: 'desc',
      maxHeight: 240,
    };
  }

  if (tooltip === true || tooltip === undefined) {
    return {
      show: true,
      sort: 'desc',
      maxHeight: 240,
    };
  }

  return {
    show: tooltip.show ?? true,
    sort: tooltip.sort ?? 'desc',
    maxHeight: tooltip.maxHeight ?? 240,
    timestampFormat: tooltip.timestampFormat,
  };
}

/* ------------------------------------------------------------------ */
/*  TooltipContent                                                    */
/* ------------------------------------------------------------------ */

interface TooltipContentProps {
  active?: boolean;
  label?: number;
  payload?: Array<{
    dataKey?: string | number;
    color?: string;
    value?: number | null;
  }>;
  coordinate?: { x: number; y: number };
  meta: ReturnType<typeof normalizeSeries>['series'];
  decimals?: number;
  options: ResolvedTooltipOptions;
  seriesCount: number;
  chartHeight: number;
}

/**
 * Custom tooltip that performs Grafana-style proximity detection INSIDE the
 * render function itself. Recharts passes fresh `payload` + `coordinate`
 * on every mouse-move, so we compute the closest series inline — no ref,
 * no extra state, no stale data.
 */
function TooltipContent({
  active,
  label,
  payload,
  coordinate,
  meta,
  decimals,
  options,
  seriesCount,
  chartHeight,
}: TooltipContentProps) {
  if (!active || !payload?.length || !label) {
    return null;
  }

  const byKey = new Map(meta.map((item) => [item.key, item]));

  const rows = payload
    .map((item) => ({
      ...item,
      series: byKey.get(String(item.dataKey)),
      numericValue: typeof item.value === 'number' ? item.value : Number.NEGATIVE_INFINITY,
    }))
    .filter((item) => item.series);

  if (options.sort === 'desc') {
    rows.sort((a, b) => b.numericValue - a.numericValue);
  } else if (options.sort === 'asc') {
    rows.sort((a, b) => a.numericValue - b.numericValue);
  }

  // ── Grafana-style proximity: when > PROXIMITY_THRESHOLD, show only the closest ──
  const useProximity = seriesCount > PROXIMITY_THRESHOLD;
  let closestKey: string | null = null;

  if (useProximity && coordinate) {
    const cursorY = coordinate.y;

    // Gather numeric values for pixel-Y mapping
    const numericRows = rows.filter((r) => typeof r.value === 'number' && Number.isFinite(r.value as number));

    if (numericRows.length > 0) {
      const values = numericRows.map((r) => r.numericValue);
      let yMin = Math.min(...values);
      let yMax = Math.max(...values);
      const yRange = yMax - yMin || 1;
      yMin -= yRange * 0.05;
      yMax += yRange * 0.05;

      // Chart plot area: margin top = 12, margin bottom ≈ 34
      const marginTop = 12;
      const marginBottom = 34;
      const plotHeight = chartHeight - marginTop - marginBottom;

      let bestDist = Infinity;
      for (const row of numericRows) {
        const ratio = (row.numericValue - yMin) / (yMax - yMin);
        const pixelY = marginTop + plotHeight * (1 - ratio);
        const dist = Math.abs(pixelY - cursorY);
        if (dist < bestDist) {
          bestDist = dist;
          closestKey = row.series?.key ?? null;
        }
      }
    }
  }

  const visibleRows = useProximity
    ? rows.filter((item) => item.series?.key === closestKey).slice(0, 1)
    : rows;

  if (visibleRows.length === 0) {
    return null;
  }

  return (
    <div className="rgp-chart-tooltip" style={{ pointerEvents: 'none' }}>
      <div className="rgp-chart-tooltip-time">{formatTimestamp(Number(label), options.timestampFormat)}</div>
      <div
        className="rgp-chart-tooltip-values"
        style={cssVars({ '--rgp-tooltip-max-height': `${options.maxHeight}px` })}
      >
        {visibleRows.map((item) => {
          const formatter = getValueFormat(item.series?.unit);
          const value = formattedValueToString(formatter(item.value, decimals));
          const isHighlighted = useProximity && closestKey === item.series?.key;

          return (
            <div
              key={String(item.dataKey)}
              className={joinClassNames(
                'rgp-chart-tooltip-row',
                isHighlighted && 'rgp-chart-tooltip-row--active'
              )}
            >
              <span
                className="rgp-chart-series-swatch"
                style={cssVars({ '--rgp-series-color': item.series?.color })}
              />
              <span className="rgp-chart-tooltip-name">{item.series?.name}</span>
              <span className="rgp-chart-tooltip-value">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card title                                                        */
/* ------------------------------------------------------------------ */

function renderTitle(title: ReactNode, description: ReactNode, actions: ReactNode) {
  if (!title && !description && !actions) {
    return null;
  }

  return (
    <div className="rgp-chart-card-header">
      <div className="rgp-chart-card-heading">
        {title && <div className="rgp-chart-card-title">{title}</div>}
        {description && <div className="rgp-chart-card-description">{description}</div>}
      </div>
      {actions && <div className="rgp-chart-card-actions">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component – wrapped in React.memo                            */
/* ------------------------------------------------------------------ */

export const TimeSeriesChart = memo(function TimeSeriesChart({
  series,
  title,
  description,
  actions,
  footer,
  card = true,
  unit,
  variant = 'line',
  theme = 'auto',
  height = 320,
  aspectRatio,
  fallbackSize = DEFAULT_FALLBACK_SIZE,
  decimals,
  className,
  chartClassName,
  colors,
  legend = true,
  showGrid = true,
  showTooltip,
  tooltip,
  syncId,
  emptyState = 'No data',
}: TimeSeriesChartProps) {
  const gradientIdPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [containerRef, containerSize] = useElementSize<HTMLDivElement>();
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [legendFilter, setLegendFilter] = useState('');

  const legendOptions = useMemo(() => resolveLegend(legend, series.length), [legend, series.length]);
  const tooltipOptions = useMemo(() => resolveTooltip(tooltip, showTooltip), [tooltip, showTooltip]);

  const normalized = useMemo(
    () =>
      normalizeSeries(series, {
        colors,
        defaultUnit: unit,
        legendTemplate: legendOptions.template,
      }),
    [colors, legendOptions.template, series, unit]
  );

  const visibleSeries = useMemo(
    () => normalized.series.filter((item) => !hiddenKeys.has(item.key)),
    [normalized.series, hiddenKeys]
  );

  const filteredLegendSeries = useMemo(
    () =>
      normalized.series.filter((item) =>
        item.name.toLowerCase().includes(legendFilter.trim().toLowerCase())
      ),
    [normalized.series, legendFilter]
  );

  const highlightedKey = hoveredKey && !hiddenKeys.has(hoveredKey) ? hoveredKey : null;

  const yAxisUnit = visibleSeries[0]?.unit ?? normalized.series[0]?.unit ?? unit;
  const yFormatter = useMemo(() => getValueFormat(yAxisUnit), [yAxisUnit]);
  const yTickFormatter = useCallback(
    (value: number) => formattedValueToString(yFormatter(Number(value), decimals)),
    [yFormatter, decimals]
  );

  const hasData = normalized.rows.length > 0 && normalized.series.length > 0;
  const Chart = variant === 'area' ? AreaChart : LineChart;
  const width = containerSize.width > 0 ? containerSize.width : fallbackSize.width;
  const ratioHeight = aspectRatio && width > 0 ? Math.round(width / aspectRatio) : 0;
  const chartHeight = ratioHeight || containerSize.height || height || fallbackSize.height;
  const shouldRenderChart = width > 0 && chartHeight > 0;
  const getGradientId = useCallback(
    (key: string) => `rgp-area-${gradientIdPrefix}-${key}`,
    [gradientIdPrefix]
  );

  const canvasStyle = useMemo(
    () =>
      cssVars({
        '--rgp-chart-height': `${height || fallbackSize.height}px`,
        '--rgp-chart-aspect-ratio': aspectRatio,
      }),
    [height, fallbackSize.height, aspectRatio]
  );

  /* ---------------------------------------------------------------- */
  /*  Legend interactions                                              */
  /* ---------------------------------------------------------------- */

  const toggleSeries = useCallback(
    (key: string) => {
      setHiddenKeys((current) => {
        const allKeys = normalized.series.map((item) => item.key);
        const next = new Set(current);

        if (next.has(key)) {
          next.delete(key);
          return next;
        }

        const visibleCount = allKeys.filter((item) => !next.has(item)).length;

        if (visibleCount <= 1) {
          return current;
        }

        next.add(key);
        return next;
      });
    },
    [normalized.series]
  );

  const isolateSeries = useCallback(
    (key: string) => {
      setHiddenKeys((current) => {
        const others = normalized.series.map((item) => item.key).filter((item) => item !== key);
        const isAlreadyIsolated = !current.has(key) && others.every((item) => current.has(item));
        return isAlreadyIsolated ? new Set() : new Set(others);
      });
    },
    [normalized.series]
  );

  const handleLegendClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, key: string) => {
      if (legendOptions.behavior === 'isolate') {
        isolateSeries(key);
        return;
      }

      if (legendOptions.behavior === 'toggle-or-isolate' && (event.metaKey || event.ctrlKey || event.altKey)) {
        isolateSeries(key);
        return;
      }

      toggleSeries(key);
    },
    [legendOptions.behavior, isolateSeries, toggleSeries]
  );

  /* ---------------------------------------------------------------- */
  /*  Memoised sub-renderers                                          */
  /* ---------------------------------------------------------------- */

  const gradientDefs = useMemo(() => {
    if (variant !== 'area') return null;
    return (
      <defs>
        {visibleSeries.map((item) => {
          const muted = highlightedKey && highlightedKey !== item.key;
          return (
            <linearGradient key={item.key} id={getGradientId(item.key)} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity={muted ? 0.08 : 0.3} />
              <stop offset="80%" stopColor={item.color} stopOpacity={0.04} />
              <stop offset="100%" stopColor={item.color} stopOpacity={0} />
            </linearGradient>
          );
        })}
      </defs>
    );
  }, [variant, visibleSeries, highlightedKey, getGradientId]);

  // Memoised series elements – the heaviest part with 100+ lines
  const seriesElements = useMemo(() => {
    return visibleSeries.map((item) => {
      const muted = highlightedKey && highlightedKey !== item.key;
      const isHighlighted = highlightedKey === item.key;

      const commonProps = {
        dataKey: item.key,
        name: item.name,
        stroke: item.color,
        strokeOpacity: muted ? 0.28 : 1,
        strokeWidth: isHighlighted ? 2 : 1,
        dot: false as const,
        activeDot: false as const,
        connectNulls: true,
        isAnimationActive: false,
      };

      return variant === 'area' ? (
        <Area
          key={item.key}
          {...commonProps}
          type="monotone"
          fill={`url(#${getGradientId(item.key)})`}
          fillOpacity={1}
        />
      ) : (
        <Line key={item.key} {...commonProps} type="monotone" />
      );
    });
  }, [visibleSeries, highlightedKey, variant, getGradientId]);

  /* ---------------------------------------------------------------- */
  /*  Render: chart content                                           */
  /* ---------------------------------------------------------------- */

  const renderChartContent = () => {
    if (!hasData) {
      return <div className="rgp-empty-state">{emptyState}</div>;
    }

    if (!shouldRenderChart) {
      return <div className="rgp-empty-state">Preparing chart</div>;
    }

    return (
      <Chart
        data={normalized.rows}
        height={chartHeight}
        width={width}
        syncId={syncId}
        margin={{ top: 12, right: 18, bottom: 4, left: 8 }}
      >
        {gradientDefs}
        {showGrid && <CartesianGrid stroke="var(--rgp-grid)" strokeDasharray="2 6" vertical={false} />}
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={formatTimeTick}
          stroke="var(--rgp-axis)"
          tick={{ fill: 'var(--rgp-muted)', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--rgp-axis)' }}
          minTickGap={28}
        />
        <YAxis
          tickFormatter={yTickFormatter}
          stroke="var(--rgp-axis)"
          tick={{ fill: 'var(--rgp-muted)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        {tooltipOptions.show && (
          <Tooltip
            content={
              <TooltipContent
                meta={visibleSeries}
                decimals={decimals}
                options={tooltipOptions}
                seriesCount={visibleSeries.length}
                chartHeight={chartHeight}
              />
            }
            cursor={{ stroke: 'var(--rgp-crosshair)', strokeWidth: 1 }}
            wrapperStyle={{ pointerEvents: 'none', outline: 'none', zIndex: 50 }}
            isAnimationActive={false}
          />
        )}
        {seriesElements}
      </Chart>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render: legend                                                  */
  /* ---------------------------------------------------------------- */

  const renderLegend = () => {
    if (!legendOptions.show || normalized.series.length === 0) {
      return null;
    }

    return (
      <div
        className="rgp-chart-legend-panel"
        style={cssVars({ '--rgp-legend-max-height': `${legendOptions.maxHeight}px` })}
      >
        {legendOptions.searchable && (
          <div className="rgp-chart-legend-search-wrap">
            <input
              className="rgp-chart-legend-search"
              value={legendFilter}
              onChange={(event) => setLegendFilter(event.target.value)}
              placeholder={legendOptions.searchPlaceholder}
              type="search"
            />
          </div>
        )}
        <div className="rgp-chart-legend">
          {filteredLegendSeries.map((item) => {
            const formatter = getValueFormat(item.unit);
            const statValue = legendOptions.value ? getSeriesStat(item, legendOptions.value) : null;
            const renderedValue =
              legendOptions.value && statValue !== null && statValue !== undefined
                ? formattedValueToString(formatter(statValue, decimals))
                : null;
            const hidden = hiddenKeys.has(item.key);
            const highlighted = highlightedKey === item.key;

            return (
              <button
                key={item.id}
                className={joinClassNames(
                  'rgp-chart-legend-item',
                  hidden && 'rgp-chart-legend-item--hidden',
                  highlighted && 'rgp-chart-legend-item--active'
                )}
                type="button"
                onClick={(event) => handleLegendClick(event, item.key)}
                onDoubleClick={() => isolateSeries(item.key)}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
                title={item.name}
              >
                <span className="rgp-chart-series-swatch" style={cssVars({ '--rgp-series-color': item.color })} />
                <span className="rgp-chart-legend-name">{item.name}</span>
                {renderedValue && <span className="rgp-chart-legend-value">{renderedValue}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render: root                                                    */
  /* ---------------------------------------------------------------- */

  return (
    <div
      className={joinClassNames(
        'rgp-chart-card',
        !card && 'rgp-chart-card--plain',
        `rgp-theme-${theme}`,
        className
      )}
    >
      {renderTitle(title, description, actions)}
      <div
        className={joinClassNames(
          'rgp-chart-layout',
          legendOptions.placement === 'right' && 'rgp-chart-layout--side-legend'
        )}
      >
        <div
          ref={containerRef}
          className={joinClassNames(
            'rgp-chart-canvas',
            Boolean(aspectRatio) && 'rgp-chart-canvas--ratio',
            chartClassName
          )}
          style={canvasStyle}
        >
          {renderChartContent()}
        </div>
        {renderLegend()}
      </div>
      {footer && <div className="rgp-chart-card-footer">{footer}</div>}
    </div>
  );
});
