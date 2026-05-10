import type { Meta, StoryObj } from '@storybook/react';
import { TimeSeriesChart } from './TimeSeriesChart'; // Make sure path is correct

// ── TypeScript Type (Optional, for strictly typing the data) ──
type TimeSeries = {
    labels: Record<string, string>;
    points: [number, number][];
    unit?: string;
};

// ── User Provided Data ──
const cpuSeries: TimeSeries[] = [
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

// ── Storybook Meta Setup ──
const meta: Meta<typeof TimeSeriesChart> = {
    title: 'Library/TimeSeriesChart',
    component: TimeSeriesChart,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
};

export default meta;
type Story = StoryObj<typeof TimeSeriesChart>;

// ── 1. Default Line Chart Story ──
export const DefaultLineChart: Story = {
    args: {
        title: "CPU Usage",
        description: "Live CPU metrics for orderer pods in HLF namespace",
        series: cpuSeries,
        variant: 'line',
        theme: 'dark',
        card: true,          // Renders inside a card wrapper
        height: 350,         // Default height
        unit: 'percentunit',
        decimals: 2,
        showGrid: true,
        legend: true,
        tooltip: true,
    },
};

// ── 2. Area Chart Variant Story ──
export const AreaChartVariant: Story = {
    args: {
        title: "CPU Usage (Area View)",
        description: "Area chart variant of the same CPU metrics",
        series: cpuSeries,
        variant: 'area',     // Testing the 'area' variant prop
        theme: 'dark',
        card: true,
        height: 350,
        unit: 'percentunit',
        decimals: 2,
        showGrid: true,
    },
};

// ── 3. Light Theme & No Card ──
export const LightThemeBorderless: Story = {
    args: {
        title: "CPU Usage (Light)",
        description: "Light theme without the card boundary",
        series: cpuSeries,
        variant: 'line',
        theme: 'light',      // Testing light theme
        card: false,         // Removed card
        height: 300,
        unit: 'percentunit',
        decimals: 2,
        showGrid: false,     // Disabled grid lines
    },
};

// ── Helper: generate random time-series data ──
function generateSeries(count: number, pointCount: number, baseTime = 1713780000): TimeSeries[] {
    const result: TimeSeries[] = [];
    for (let i = 0; i < count; i++) {
        const base = Math.random() * 0.6 + 0.1;
        const pts: [number, number][] = [];
        for (let j = 0; j < pointCount; j++) {
            pts.push([baseTime + j * 300, base + (Math.random() - 0.5) * 0.15]);
        }
        result.push({
            labels: { pod: `pod-${i}`, namespace: 'load-test' },
            unit: 'percentunit',
            points: pts,
        });
    }
    return result;
}

// ── 4. High-Density Stress Test (120+ series) ──
export const HighDensityStress: Story = {
    args: {
        title: "Stress Test — 120 Lines",
        description: "Performance test with 120 series / 60 data points each",
        series: generateSeries(120, 60),
        variant: 'line',
        theme: 'dark',
        card: true,
        height: 400,
        unit: 'percentunit',
        decimals: 2,
        showGrid: true,
        legend: { show: true, searchable: true, maxHeight: 200 },
        tooltip: true,
    },
};

// ── 5. Dense Proximity Test (20 overlapping series) ──
export const DenseProximityTest: Story = {
    args: {
        title: "Proximity Detection — 20 Lines",
        description: "Hover to see Grafana-style closest-line tooltip",
        series: generateSeries(20, 40),
        variant: 'line',
        theme: 'dark',
        card: true,
        height: 380,
        unit: 'percentunit',
        decimals: 3,
        showGrid: true,
        legend: true,
        tooltip: true,
    },
};