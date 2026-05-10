"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import type {
  HeatmapTableProps,
  HeatmapTableColumn,
  HeatmapTableValueColumn,
  StatType,
  TimeSeries,
} from '../types.js';
import { formattedValueToString, getValueFormat } from '../lib/formatters.js';

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function joinClassNames(...v: Array<string | false | null | undefined>): string {
  return v.filter(Boolean).join(' ');
}

function cssVars(vars: Record<string, string | number | undefined>): CSSProperties {
  return vars as CSSProperties;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/* ---- Color interpolation ---- */

const DEFAULT_HEAT_COLORS = ['#22c55e', '#eab308', '#ef4444'];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function interpolateColor(colors: string[], position: number): string {
  const p = clamp(position, 0, 1);
  if (colors.length === 0) return DEFAULT_HEAT_COLORS[0];
  if (colors.length === 1) return colors[0];
  const seg = (colors.length - 1) * p;
  const i = Math.min(Math.floor(seg), colors.length - 2);
  const t = seg - i;
  const [r1, g1, b1] = hexToRgb(colors[i]);
  const [r2, g2, b2] = hexToRgb(colors[i + 1]);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/* ---- Stat computation ---- */

function extractValues(points: TimeSeries['points']): Array<number | null> {
  return points.map(p => {
    if (Array.isArray(p)) return (p[1] as number) ?? null;
    return ((p as { value?: number | null }).value) ?? null;
  });
}

function computeStat(values: Array<number | null | undefined>, stat: StatType): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  switch (stat) {
    case 'last': return nums[nums.length - 1];
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'count': return nums.length;
    case 'avg': default: return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
}

function getAutoRange(unit: string | undefined, values: number[]): [number, number] {
  if (unit === 'percent') return [0, 100];
  if (unit === 'percentunit') return [0, 1];
  const max = values.length > 0 ? Math.max(...values) : 100;
  return [0, max || 1];
}

/* ---- SVG wave for fluid mode ---- */

const WAVE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 20" preserveAspectRatio="none">` +
  `<path d="M0,10 C30,0 70,20 100,10 C130,0 170,20 200,10 L200,20 L0,20 Z" fill="white"/>` +
  `</svg>`
);

/* ------------------------------------------------------------------ */
/*  Card header                                                        */
/* ------------------------------------------------------------------ */

function renderTitle(title: ReactNode, description: ReactNode, actions: ReactNode) {
  if (!title && !description && !actions) return null;
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
/*  HeatmapCell                                                        */
/* ------------------------------------------------------------------ */

function HeatmapCell({
  value, formatted, pct, color, fluid,
}: {
  value: number | null; formatted: string; pct: number; color: string; fluid: boolean;
}) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  if (value === null) {
    return <div className="rgp-fluid-cell"><div className="rgp-fluid-label-wrap"><span className="rgp-fluid-label">—</span></div></div>;
  }

  return (
    <div className="rgp-fluid-cell">
      {fluid ? (
        <div className="rgp-fluid-fill" style={cssVars({ '--rgp-fluid-height': `${animated}%`, '--rgp-fluid-color': color })}>
          <div className="rgp-fluid-wave" style={{ backgroundImage: `url("data:image/svg+xml,${WAVE_SVG}")`, filter: `drop-shadow(0 0 4px ${color})` }} />
        </div>
      ) : (
        <div className="rgp-fluid-fill-static" style={cssVars({ '--rgp-fill-width': `${animated}%`, '--rgp-fluid-color': color })} />
      )}
      <div className="rgp-fluid-label-wrap">
        <span className="rgp-fluid-label" style={cssVars({ '--rgp-fluid-text': `color-mix(in srgb, ${color} 70%, var(--rgp-text))`, '--rgp-fluid-glow': color })}>{formatted}</span>
      </div>
      <div className="rgp-fluid-accent" style={{ background: color }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort icon                                                          */
/* ------------------------------------------------------------------ */

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  return (
    <span className={joinClassNames('rgp-heatmap-table-sort-icon', direction === 'asc' && 'rgp-heatmap-table-sort-icon--asc', direction === 'desc' && 'rgp-heatmap-table-sort-icon--desc')} aria-hidden="true">
      <span className="rgp-heatmap-table-sort-arrow rgp-heatmap-table-sort-arrow--up" />
      <span className="rgp-heatmap-table-sort-arrow rgp-heatmap-table-sort-arrow--down" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

interface ProcessedRow {
  id: string;
  labels: Record<string, string>;
  values: Record<string, number | null>;
}

interface ColumnMeta {
  min: number;
  max: number;
  colors: string[];
  hasHeat: boolean;
}

interface SortState { key: string; direction: 'asc' | 'desc'; }

/* ================================================================== */
/*  HeatmapTable Component                                             */
/* ================================================================== */

export function HeatmapTable({
  series,
  joinBy,
  columns,
  title,
  description,
  actions,
  footer,
  card = true,
  theme = 'auto',
  className,
  stat: globalStat = 'last',
  pageSize = 10,
  searchable = true,
  searchPlaceholder = 'Search…',
  fluid = false,
  sortable = true,
  emptyState = 'No data',
  decimals: globalDecimals,
}: HeatmapTableProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  /* ---- Step 1: Build rows by joining series on joinBy label ---- */
  const allRows = useMemo<ProcessedRow[]>(() => {
    const rowMap = new Map<string, ProcessedRow>();

    for (const input of series) {
      for (const ts of input.data) {
        const labels = ts.labels ?? {};
        const joinVal = String(labels[joinBy] ?? ts.name ?? '');
        if (!joinVal) continue;

        let row = rowMap.get(joinVal);
        if (!row) {
          row = { id: joinVal, labels: {}, values: {} };
          rowMap.set(joinVal, row);
        }

        // Merge labels
        for (const [k, v] of Object.entries(labels)) {
          row.labels[k] = v === null || v === undefined ? '' : String(v);
        }
        if (ts.name) row.labels['__name__'] = ts.name;

        // Compute stat for this series key
        const colDef = columns.find(c => c.key === input.key && c.type === 'value') as HeatmapTableValueColumn | undefined;
        const useStat = colDef?.stat ?? globalStat;
        const vals = extractValues(ts.points);
        row.values[input.key] = computeStat(vals, useStat);
      }
    }

    return Array.from(rowMap.values());
  }, [series, joinBy, columns, globalStat]);

  /* ---- Step 2: Column metadata (ranges for value columns) ---- */
  const columnMetas = useMemo(() => {
    const metas = new Map<string, ColumnMeta>();

    for (const col of columns) {
      if (col.type !== 'value') continue;
      const vc = col as HeatmapTableValueColumn;

      if (vc.heat === false) {
        metas.set(col.key, { min: 0, max: 1, colors: DEFAULT_HEAT_COLORS, hasHeat: false });
        continue;
      }

      const allVals = allRows.map(r => r.values[col.key]).filter((v): v is number => v !== null && v !== undefined);
      const heatCfg = typeof vc.heat === 'object' ? vc.heat : undefined;
      const autoRange = getAutoRange(vc.unit, allVals);
      const min = heatCfg?.min ?? autoRange[0];
      const max = heatCfg?.max ?? autoRange[1];
      const colors = heatCfg?.colors ?? DEFAULT_HEAT_COLORS;

      metas.set(col.key, { min, max: max || 1, colors, hasHeat: true });
    }

    return metas;
  }, [columns, allRows]);

  /* ---- Step 3: Format + colorize helper ---- */
  const getCellDisplay = (col: HeatmapTableValueColumn, value: number | null) => {
    const unit = col.unit;
    const dec = col.decimals ?? globalDecimals;
    const formatter = getValueFormat(unit);
    const formatted = value !== null ? formattedValueToString(formatter(value, dec)) : '—';
    const meta = columnMetas.get(col.key);

    if (!meta || !meta.hasHeat || value === null) {
      return { formatted, color: '', pct: 0, hasHeat: false };
    }

    const range = meta.max - meta.min || 1;
    const position = clamp((value - meta.min) / range, 0, 1);
    const color = interpolateColor(meta.colors, position);
    return { formatted, color, pct: position * 100, hasHeat: true };
  };

  /* ---- Search ---- */
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(row => {
      if (row.id.toLowerCase().includes(q)) return true;
      for (const v of Object.values(row.labels)) {
        if (v.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [allRows, search]);

  /* ---- Sort ---- */
  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const { key, direction } = sort;
    const mult = direction === 'asc' ? 1 : -1;
    const col = columns.find(c => c.key === key);
    return [...filteredRows].sort((a, b) => {
      if (!col || col.type === 'label') {
        const av = a.labels[key] ?? a.id;
        const bv = b.labels[key] ?? b.id;
        return mult * av.localeCompare(bv);
      }
      return mult * ((a.values[key] ?? -Infinity) - (b.values[key] ?? -Infinity));
    });
  }, [filteredRows, sort, columns]);

  /* ---- Pagination ---- */
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = clamp(currentPage, 0, totalPages - 1);
  const pageRows = sortedRows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const showFrom = sortedRows.length > 0 ? safePage * pageSize + 1 : 0;
  const showTo = Math.min((safePage + 1) * pageSize, sortedRows.length);

  const handleSort = (key: string) => {
    if (!sortable) return;
    setSort(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(0); };
  const getSortDir = (key: string): 'asc' | 'desc' | null => sort?.key === key ? sort.direction : null;

  /* ---- Render ---- */
  return (
    <div className={joinClassNames('rgp-heatmap-table', !card && 'rgp-heatmap-table--plain', `rgp-theme-${theme}`, className)}>
      {renderTitle(title, description, actions)}

      <div className="rgp-heatmap-table-body">
        {allRows.length === 0 ? (
          <div className="rgp-heatmap-table-empty">{emptyState}</div>
        ) : (
          <>
            {/* Toolbar */}
            {searchable && (
              <div className="rgp-heatmap-table-toolbar">
                <div className="rgp-heatmap-table-search-wrap">
                  <svg className="rgp-heatmap-table-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input className="rgp-heatmap-table-search" type="search" value={search} onChange={e => handleSearch(e.target.value)} placeholder={searchPlaceholder} />
                </div>
                <span className="rgp-heatmap-table-result-count">{filteredRows.length} of {allRows.length} rows</span>
              </div>
            )}

            {/* Table */}
            <div className="rgp-heatmap-table-container">
              <table className="rgp-heatmap-table-table">
                <thead>
                  <tr>
                    <th className="rgp-heatmap-table-th rgp-heatmap-table-th--row-num">#</th>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        className={joinClassNames('rgp-heatmap-table-th', sortable && 'rgp-heatmap-table-th--sortable', sort?.key === col.key && 'rgp-heatmap-table-th--sorted')}
                        style={col.width ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : undefined}
                        onClick={() => handleSort(col.key)}
                      >
                        <span className="rgp-heatmap-table-th-content">
                          {col.header ?? col.label ?? col.key}
                          {sortable && <SortIcon direction={getSortDir(col.key)} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td className="rgp-heatmap-table-td rgp-heatmap-table-td--empty" colSpan={columns.length + 1}>No matching rows</td></tr>
                  ) : (
                    pageRows.map((row, i) => (
                      <tr key={row.id} className="rgp-heatmap-table-tr" style={cssVars({ '--rgp-row-delay': `${i * 30}ms` })}>
                        <td className="rgp-heatmap-table-td rgp-heatmap-table-td--row-num">{safePage * pageSize + i + 1}</td>
                        {columns.map(col => {
                          if (col.type === 'label') {
                            const val = col.key === joinBy ? row.id : (row.labels[col.key] ?? '—');
                            return (
                              <td key={col.key} className="rgp-heatmap-table-td rgp-heatmap-table-td--label" title={val}>{val}</td>
                            );
                          }

                          // Value column
                          const vc = col as HeatmapTableValueColumn;
                          const rawVal = row.values[col.key] ?? null;
                          const cell = getCellDisplay(vc, rawVal);

                          if (!cell.hasHeat) {
                            return (
                              <td key={col.key} className="rgp-heatmap-table-td rgp-heatmap-table-td--plain-value">
                                <span className="rgp-heatmap-table-stat-value">{cell.formatted}</span>
                              </td>
                            );
                          }

                          return (
                            <td key={col.key} className="rgp-heatmap-table-td rgp-heatmap-table-td--fluid">
                              <HeatmapCell value={rawVal} formatted={cell.formatted} pct={cell.pct} color={cell.color} fluid={fluid} />
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="rgp-heatmap-table-pagination">
                <span className="rgp-heatmap-table-page-info">{showFrom}–{showTo} of {sortedRows.length}</span>
                <div className="rgp-heatmap-table-page-controls">
                  <button type="button" className="rgp-heatmap-table-page-btn" disabled={safePage === 0} onClick={() => setCurrentPage(0)} aria-label="First page">«</button>
                  <button type="button" className="rgp-heatmap-table-page-btn" disabled={safePage === 0} onClick={() => setCurrentPage(safePage - 1)} aria-label="Previous page">‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i).filter(i => Math.abs(i - safePage) <= 2).map(i => (
                    <button key={i} type="button" className={joinClassNames('rgp-heatmap-table-page-btn', i === safePage && 'rgp-heatmap-table-page-btn--active')} onClick={() => setCurrentPage(i)} aria-label={`Page ${i + 1}`} aria-current={i === safePage ? 'page' : undefined}>{i + 1}</button>
                  ))}
                  <button type="button" className="rgp-heatmap-table-page-btn" disabled={safePage >= totalPages - 1} onClick={() => setCurrentPage(safePage + 1)} aria-label="Next page">›</button>
                  <button type="button" className="rgp-heatmap-table-page-btn" disabled={safePage >= totalPages - 1} onClick={() => setCurrentPage(totalPages - 1)} aria-label="Last page">»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {footer && <div className="rgp-chart-card-footer">{footer}</div>}
    </div>
  );
}
