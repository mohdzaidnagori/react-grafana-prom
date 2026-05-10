# react-grafana-prom

Grafana-inspired React time-series charts for Prometheus, Thanos, and monitoring dashboards.

The package is built on Recharts and keeps the data contract simple: your backend or app fetches metrics, normalizes them, and passes time-series data directly to the chart. Units are chosen by your dashboard code, because Prometheus and Thanos query responses usually do not include display units.

## Install

```bash
npm install react-grafana-prom recharts
```

Import the CSS once in your app:

```tsx
import 'react-grafana-prom/styles.css';
```

## Quick Start

```tsx
'use client';

import { TimeSeriesChart } from 'react-grafana-prom';
import 'react-grafana-prom/styles.css';

const cpuSeries = [
  {
    labels: { pod: 'orderer-0', namespace: 'hlf' },
    unit: 'percentunit',
    points: [
      [1713780000, 0.43],
      [1713780300, 0.51],
      [1713780600, 0.48],
    ],
  },
  {
    labels: { pod: 'orderer-1', namespace: 'hlf' },
    unit: 'percentunit',
    points: [
      [1713780000, 0.36],
      [1713780300, 0.41],
      [1713780600, 0.39],
    ],
  },
];

export function CpuPanel() {
  return (
    <TimeSeriesChart
      title="CPU usage"
      description="Kubernetes pods"
      series={cpuSeries}
      variant="area"
      unit="percentunit"
      theme="auto"
      legend={{ template: '{{pod}}', value: 'last' }}
      tooltip={{ sort: 'desc' }}
    />
  );
}
```

## Data Format

```ts
type TimeSeries = {
  id?: string;
  name?: string;
  labels?: Record<string, string | number | boolean | null | undefined>;
  unit?: string;
  color?: string;
  points: Array<[number | string | Date, number | null | undefined]>;
};
```

Time values can be Unix seconds, Unix milliseconds, ISO strings, or `Date` objects.

```ts
const memory = [
  {
    name: 'peer-0',
    unit: 'bytes',
    points: [
      ['2026-04-26T10:00:00Z', 523986944],
      ['2026-04-26T10:01:00Z', 534773760],
    ],
  },
];
```

## Units and Formatters

Prometheus metric names can hint at units, but the API response normally does not tell the chart how to format values. Prefer storing the unit with your dashboard panel or attaching it when you normalize backend data.

```tsx
<TimeSeriesChart series={memorySeries} unit="bytes" />
<TimeSeriesChart series={latencySeries} unit="ms" />
<TimeSeriesChart series={cpuRatioSeries} unit="percentunit" />
```

Common formatter IDs:

| Category | IDs |
| --- | --- |
| Numbers | `none`, `short`, `sishort`, `locale`, `sci` |
| Percent | `percent`, `percentunit` |
| Data | `bytes`, `decbytes`, `bits`, `decbits`, `kbytes`, `mbytes`, `gbytes` |
| Data rate | `Bps`, `binBps`, `bps`, `binbps`, `KBs`, `MBs`, `GBs` |
| Time | `ns`, `us`, `ms`, `s`, `m`, `h`, `d`, `dtdurationms`, `dtdurations` |
| Throughput | `ops`, `reqps`, `rps`, `wps`, `iops`, `eps`, `mps` |
| Currency | `currencyINR`, `currencyUSD`, `currencyEUR`, `currencyGBP`, `currencyJPY`, `currencyBTC` |
| State | `bool`, `bool_yes_no`, `bool_on_off` |

Custom unit patterns:

```tsx
<TimeSeriesChart series={blockHeightSeries} unit="suffix:blocks" />
<TimeSeriesChart series={peerSeries} unit="suffix:peers" />
<TimeSeriesChart series={txSeries} unit="count:tx/s" />
<TimeSeriesChart series={hashRateSeries} unit="si:H/s" />
<TimeSeriesChart series={healthSeries} unit="bool:Healthy/Down" />
```

Register a formatter for your own domain:

```ts
import { registerValueFormat } from 'react-grafana-prom';

registerValueFormat('blockHeight', (value) => ({
  text: Math.round(value ?? 0).toLocaleString(),
  suffix: ' blocks',
}));
```

## Layout and Sizing

The chart uses `ResizeObserver`, waits for a positive render size, and falls back to `300x200` when mounted inside a container that has not measured yet.

```tsx
<TimeSeriesChart
  title="Transaction rate"
  series={txSeries}
  unit="count:tx/s"
  height={360}
  fallbackSize={{ width: 480, height: 260 }}
/>
```

Use `aspectRatio` when the chart should size itself from its container width:

```tsx
<TimeSeriesChart series={series} aspectRatio={16 / 9} />
```

## Legend

Legends are interactive and work with large result sets.

- Click a legend item to hide or show that series.
- Double-click a legend item to isolate it.
- Ctrl, Cmd, or Alt click also isolates when `behavior` is `toggle-or-isolate`.
- A search box appears automatically when there are many series.
- Overflowing legends scroll inside the card.

```tsx
<TimeSeriesChart
  series={podSeries}
  legend={{
    template: '{{namespace}} / {{pod}}',
    value: 'last',
    placement: 'right',
    searchable: true,
    maxHeight: 360,
  }}
/>
```

## Tooltip

The tooltip is custom-built for dense monitoring data. It shows the timestamp and all visible series values, supports scrolling, and can sort values.

```tsx
<TimeSeriesChart
  series={series}
  tooltip={{
    sort: 'desc',
    maxHeight: 240,
    timestampFormat: {
      dateStyle: 'medium',
      timeStyle: 'long',
    },
  }}
/>
```

## Themes

Use `theme="auto"` to follow the user's color scheme, or force a mode:

```tsx
<TimeSeriesChart series={series} theme="dark" />
<TimeSeriesChart series={series} theme="light" />
```

The component ships with shadcn-inspired card styling, rounded corners, subtle borders, dark mode variables, and Grafana-style chart interactions.

## API

```ts
type TimeSeriesChartProps = {
  series: TimeSeries[];
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  card?: boolean;
  unit?: string;
  variant?: 'line' | 'area';
  theme?: 'auto' | 'light' | 'dark';
  height?: number;
  aspectRatio?: number;
  fallbackSize?: { width: number; height: number };
  decimals?: number;
  colors?: string[];
  legend?: boolean | ChartLegendOptions;
  tooltip?: boolean | ChartTooltipOptions;
  showGrid?: boolean;
  syncId?: string;
  emptyState?: React.ReactNode;
};
```

## HeatmapTable

A column-driven data table with heatmap-colored cells, auto min/max, optional fluid wave animation, sorting, searching, and pagination. Designed for multi-query Prometheus/Thanos dashboards.

### Quick Start

```tsx
import { HeatmapTable } from 'react-grafana-prom';
import 'react-grafana-prom/styles.css';

<HeatmapTable
  title="Node Information Detail"
  theme="dark"
  joinBy="node"
  series={[
    { key: 'podLimit', query: 'kube_node_status_capacity{resource="pods"}', data: podLimitSeries },
    { key: 'cpuUsage', query: 'rate(node_cpu_seconds_total[5m])*100', data: cpuSeries },
    { key: 'memReq',   query: 'node_memory_Active_bytes/node_memory_MemTotal_bytes', data: memSeries },
  ]}
  columns={[
    { type: 'label', key: 'node',     label: 'Node',         width: 200 },
    { type: 'value', key: 'podLimit', label: 'Pod Limit',    unit: 'short', heat: false },
    { type: 'value', key: 'cpuUsage', label: 'CPU Usage %',  unit: 'percent' },
    { type: 'value', key: 'memReq',   label: 'Memory Req %', unit: 'percent' },
  ]}
/>
```

### Column Types

**Label columns** — plain text from series labels:
```ts
{ type: 'label', key: 'node', label: 'Node', width: 200 }
```

**Value columns** — numeric with automatic heatmap coloring:
```ts
{ type: 'value', key: 'cpuUsage', label: 'CPU %', unit: 'percent' }        // auto heat
{ type: 'value', key: 'podCount', label: 'Pods', unit: 'short', heat: false } // no heat
{ type: 'value', key: 'mem', label: 'Memory', unit: 'bytes',               // custom heat
  heat: { min: 0, max: 8589934592, colors: ['#22c55e', '#3b82f6', '#ef4444'] }
}
```

### Auto Min/Max

| Unit | Min | Max |
|------|-----|-----|
| `percent` | 0 | 100 |
| `percentunit` | 0 | 1 |
| `bytes`, `ops`, etc. | 0 | auto (max from data) |

### API

```ts
type HeatmapTableProps = {
  series: Array<{ key: string; query?: string; data: TimeSeries[] }>;
  joinBy: string;
  columns: HeatmapTableColumn[];
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  card?: boolean;
  theme?: 'auto' | 'light' | 'dark';
  stat?: 'last' | 'min' | 'max' | 'avg' | 'sum' | 'count';
  pageSize?: number;
  searchable?: boolean;
  fluid?: boolean;
  sortable?: boolean;
  decimals?: number;
};
```

### Full Example — 10-Column Node Dashboard

```tsx
import { HeatmapTable, type TimeSeries } from 'react-grafana-prom';
import 'react-grafana-prom/styles.css';

// ── Helper: build a TimeSeries for a single node ──
function nodeSeries(node: string, cluster: string, value: number): TimeSeries {
  return {
    labels: { node, cluster },
    points: [[Date.now(), value]],
  };
}

// ── Series data (each key = one PromQL query result) ──
const podLimitData   = [
  nodeSeries('node-east-01', 'prod-east', 104),
  nodeSeries('node-east-02', 'prod-east', 117),
  nodeSeries('node-west-01', 'prod-west', 139),
  nodeSeries('node-west-02', 'prod-west', 153),
  nodeSeries('node-stg-01',  'staging',   94),
  nodeSeries('node-stg-02',  'staging',   85),
  nodeSeries('node-dev-01',  'dev',        89),
];

const podCountData   = podLimitData.map(s => ({
  ...s, points: [[Date.now(), 3000]] as TimeSeries['points'],
}));

const cpuUsageData   = [
  nodeSeries('node-east-01', 'prod-east', 10),
  nodeSeries('node-east-02', 'prod-east', 22),
  nodeSeries('node-west-01', 'prod-west', 40),
  nodeSeries('node-west-02', 'prod-west', 38),
  nodeSeries('node-stg-01',  'staging',   23),
  nodeSeries('node-stg-02',  'staging',   46),
  nodeSeries('node-dev-01',  'dev',        53),
];

const cpuRequestData = [
  nodeSeries('node-east-01', 'prod-east', 20),
  nodeSeries('node-east-02', 'prod-east', 22),
  nodeSeries('node-west-01', 'prod-west', 10),
  nodeSeries('node-west-02', 'prod-west', 27),
  nodeSeries('node-stg-01',  'staging',   12),
  nodeSeries('node-stg-02',  'staging',   13),
  nodeSeries('node-dev-01',  'dev',        18),
];

const memRequestData = [
  nodeSeries('node-east-01', 'prod-east', 44),
  nodeSeries('node-east-02', 'prod-east', 41),
  nodeSeries('node-west-01', 'prod-west', 41),
  nodeSeries('node-west-02', 'prod-west', 20),
  nodeSeries('node-stg-01',  'staging',   19),
  nodeSeries('node-stg-02',  'staging',   21),
  nodeSeries('node-dev-01',  'dev',        24),
];

const cpuLimitData = [
  nodeSeries('node-east-01', 'prod-east', 52),
  nodeSeries('node-east-02', 'prod-east', 41),
  nodeSeries('node-west-01', 'prod-west', 65),
  nodeSeries('node-west-02', 'prod-west', 64),
  nodeSeries('node-stg-01',  'staging',   46),
  nodeSeries('node-stg-02',  'staging',   78),
  nodeSeries('node-dev-01',  'dev',        92),
];

const memLimitData = [
  nodeSeries('node-east-01', 'prod-east', 52),
  nodeSeries('node-east-02', 'prod-east', 48),
  nodeSeries('node-west-01', 'prod-west', 52),
  nodeSeries('node-west-02', 'prod-west', 25),
  nodeSeries('node-stg-01',  'staging',   24),
  nodeSeries('node-stg-02',  'staging',   24),
  nodeSeries('node-dev-01',  'dev',        30),
];

const diskUsageData = [
  nodeSeries('node-east-01', 'prod-east', 35),
  nodeSeries('node-east-02', 'prod-east', 58),
  nodeSeries('node-west-01', 'prod-west', 72),
  nodeSeries('node-west-02', 'prod-west', 44),
  nodeSeries('node-stg-01',  'staging',   18),
  nodeSeries('node-stg-02',  'staging',   91),
  nodeSeries('node-dev-01',  'dev',        67),
];

const networkData = [
  nodeSeries('node-east-01', 'prod-east', 124),
  nodeSeries('node-east-02', 'prod-east', 87),
  nodeSeries('node-west-01', 'prod-west', 156),
  nodeSeries('node-west-02', 'prod-west', 43),
  nodeSeries('node-stg-01',  'staging',   22),
  nodeSeries('node-stg-02',  'staging',   178),
  nodeSeries('node-dev-01',  'dev',        95),
];

export function NodeDashboard() {
  return (
    <HeatmapTable
      title="Node Information Detail"
      description="Kubernetes cluster · 7 nodes · live metrics"
      theme="dark"
      joinBy="node"
      stat="last"
      pageSize={10}
      series={[
        { key: 'podLimit',   query: 'kube_node_status_capacity{resource="pods"}',                   data: podLimitData },
        { key: 'podCount',   query: 'kubelet_running_pods',                                         data: podCountData },
        { key: 'cpuUsage',   query: 'rate(node_cpu_seconds_total{mode!="idle"}[5m]) * 100',         data: cpuUsageData },
        { key: 'cpuReq',     query: 'kube_pod_container_resource_requests{resource="cpu"} * 100',   data: cpuRequestData },
        { key: 'memReq',     query: 'node_memory_Active_bytes / node_memory_MemTotal_bytes * 100',  data: memRequestData },
        { key: 'cpuLimit',   query: 'kube_pod_container_resource_limits{resource="cpu"} * 100',     data: cpuLimitData },
        { key: 'memLimit',   query: 'kube_pod_container_resource_limits{resource="memory"} * 100',  data: memLimitData },
        { key: 'diskUsage',  query: '(node_filesystem_size_bytes - node_filesystem_avail_bytes) / node_filesystem_size_bytes * 100', data: diskUsageData },
        { key: 'network',    query: 'rate(node_network_transmit_bytes_total[5m])',                   data: networkData },
      ]}
      columns={[
        // Label columns
        { type: 'label', key: 'node',    label: 'Node',    width: 160 },
        { type: 'label', key: 'cluster', label: 'Cluster', width: 110 },

        // Plain value columns (no heatmap)
        { type: 'value', key: 'podLimit', label: 'Pod Limit',       unit: 'short', heat: false },
        { type: 'value', key: 'podCount', label: 'Pod Count',       unit: 'short', heat: false },

        // Heatmap value columns (auto green → yellow → red)
        { type: 'value', key: 'cpuUsage',  label: 'CPU Usage %',    unit: 'percent' },
        { type: 'value', key: 'cpuReq',    label: 'CPU Request %',  unit: 'percent' },
        { type: 'value', key: 'memReq',    label: 'Memory Req %',   unit: 'percent' },
        { type: 'value', key: 'cpuLimit',  label: 'CPU Limit %',    unit: 'percent' },
        { type: 'value', key: 'memLimit',  label: 'Memory Limit %', unit: 'percent' },
        { type: 'value', key: 'diskUsage', label: 'Disk Usage %',   unit: 'percent' },
      ]}
    />
  );
}
```
