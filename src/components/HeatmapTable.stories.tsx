import type { Meta, StoryObj } from '@storybook/react';
import { HeatmapTable } from './HeatmapTable';

// ── TypeScript Type (Aapke data structure ke hisaab se) ──
type TimeSeries = {
    labels: Record<string, string>;
    points: [number, number][];
};

// ── Helper Function ──
function nodeSeries(node: string, cluster: string, value: number): TimeSeries {
    return {
        labels: { node, cluster },
        points: [[Date.now(), value]],
    };
}

// ── Series data (each key = one PromQL query result) ──
const podLimitData = [
    nodeSeries('node-east-01', 'prod-east', 104),
    nodeSeries('node-east-02', 'prod-east', 117),
    nodeSeries('node-west-01', 'prod-west', 139),
    nodeSeries('node-west-02', 'prod-west', 153),
    nodeSeries('node-stg-01', 'staging', 94),
    nodeSeries('node-stg-02', 'staging', 85),
    nodeSeries('node-dev-01', 'dev', 89),
];

const podCountData = podLimitData.map(s => ({
    ...s, points: [[Date.now(), 3000]] as TimeSeries['points'],
}));

const cpuUsageData = [
    nodeSeries('node-east-01', 'prod-east', 10),
    nodeSeries('node-east-02', 'prod-east', 22),
    nodeSeries('node-west-01', 'prod-west', 40),
    nodeSeries('node-west-02', 'prod-west', 38),
    nodeSeries('node-stg-01', 'staging', 23),
    nodeSeries('node-stg-02', 'staging', 46),
    nodeSeries('node-dev-01', 'dev', 53),
];

const cpuRequestData = [
    nodeSeries('node-east-01', 'prod-east', 20),
    nodeSeries('node-east-02', 'prod-east', 22),
    nodeSeries('node-west-01', 'prod-west', 10),
    nodeSeries('node-west-02', 'prod-west', 27),
    nodeSeries('node-stg-01', 'staging', 12),
    nodeSeries('node-stg-02', 'staging', 13),
    nodeSeries('node-dev-01', 'dev', 18),
];

const memRequestData = [
    nodeSeries('node-east-01', 'prod-east', 44),
    nodeSeries('node-east-02', 'prod-east', 41),
    nodeSeries('node-west-01', 'prod-west', 41),
    nodeSeries('node-west-02', 'prod-west', 20),
    nodeSeries('node-stg-01', 'staging', 19),
    nodeSeries('node-stg-02', 'staging', 21),
    nodeSeries('node-dev-01', 'dev', 24),
];

const cpuLimitData = [
    nodeSeries('node-east-01', 'prod-east', 52),
    nodeSeries('node-east-02', 'prod-east', 41),
    nodeSeries('node-west-01', 'prod-west', 65),
    nodeSeries('node-west-02', 'prod-west', 64),
    nodeSeries('node-stg-01', 'staging', 46),
    nodeSeries('node-stg-02', 'staging', 78),
    nodeSeries('node-dev-01', 'dev', 92),
];

const memLimitData = [
    nodeSeries('node-east-01', 'prod-east', 52),
    nodeSeries('node-east-02', 'prod-east', 48),
    nodeSeries('node-west-01', 'prod-west', 52),
    nodeSeries('node-west-02', 'prod-west', 25),
    nodeSeries('node-stg-01', 'staging', 24),
    nodeSeries('node-stg-02', 'staging', 24),
    nodeSeries('node-dev-01', 'dev', 30),
];

const diskUsageData = [
    nodeSeries('node-east-01', 'prod-east', 35),
    nodeSeries('node-east-02', 'prod-east', 58),
    nodeSeries('node-west-01', 'prod-west', 72),
    nodeSeries('node-west-02', 'prod-west', 44),
    nodeSeries('node-stg-01', 'staging', 18),
    nodeSeries('node-stg-02', 'staging', 91),
    nodeSeries('node-dev-01', 'dev', 67),
];

const networkData = [
    nodeSeries('node-east-01', 'prod-east', 124),
    nodeSeries('node-east-02', 'prod-east', 87),
    nodeSeries('node-west-01', 'prod-west', 156),
    nodeSeries('node-west-02', 'prod-west', 43),
    nodeSeries('node-stg-01', 'staging', 22),
    nodeSeries('node-stg-02', 'staging', 178),
    nodeSeries('node-dev-01', 'dev', 95),
];

// ── Storybook Meta Setup ──
const meta: Meta<typeof HeatmapTable> = {
    title: 'Library/HeatmapTable',
    component: HeatmapTable,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
};

export default meta;
type Story = StoryObj<typeof HeatmapTable>;

// ── Default Story Render ──
export const Default: Story = {
    args: {
        title: "Node Information Detail",
        description: "Kubernetes cluster · 7 nodes · live metrics",
        theme: "dark",
        joinBy: "node",
        stat: "last",
        pageSize: 10,
        series: [
            { key: 'podLimit', query: 'kube_node_status_capacity{resource="pods"}', data: podLimitData },
            { key: 'podCount', query: 'kubelet_running_pods', data: podCountData },
            { key: 'cpuUsage', query: 'rate(node_cpu_seconds_total{mode!="idle"}[5m]) * 100', data: cpuUsageData },
            { key: 'cpuReq', query: 'kube_pod_container_resource_requests{resource="cpu"} * 100', data: cpuRequestData },
            { key: 'memReq', query: 'node_memory_Active_bytes / node_memory_MemTotal_bytes * 100', data: memRequestData },
            { key: 'cpuLimit', query: 'kube_pod_container_resource_limits{resource="cpu"} * 100', data: cpuLimitData },
            { key: 'memLimit', query: 'kube_pod_container_resource_limits{resource="memory"} * 100', data: memLimitData },
            { key: 'diskUsage', query: '(node_filesystem_size_bytes - node_filesystem_avail_bytes) / node_filesystem_size_bytes * 100', data: diskUsageData },
            { key: 'network', query: 'rate(node_network_transmit_bytes_total[5m])', data: networkData },
        ],
        columns: [
            // Label columns
            { type: 'label', key: 'node', label: 'Node', width: 160 },
            { type: 'label', key: 'cluster', label: 'Cluster', width: 110 },

            // Plain value columns (no heatmap)
            { type: 'value', key: 'podLimit', label: 'Pod Limit', unit: 'short', heat: false },
            { type: 'value', key: 'podCount', label: 'Pod Count', unit: 'short', heat: false },

            // Heatmap value columns (auto green → yellow → red)
            { type: 'value', key: 'cpuUsage', label: 'CPU Usage %', unit: 'percent' },
            { type: 'value', key: 'cpuReq', label: 'CPU Request %', unit: 'percent' },
            { type: 'value', key: 'memReq', label: 'Memory Req %', unit: 'percent' },
            { type: 'value', key: 'cpuLimit', label: 'CPU Limit %', unit: 'percent' },
            { type: 'value', key: 'memLimit', label: 'Memory Limit %', unit: 'percent' },
            { type: 'value', key: 'diskUsage', label: 'Disk Usage %', unit: 'percent' },
        ]
    },
};