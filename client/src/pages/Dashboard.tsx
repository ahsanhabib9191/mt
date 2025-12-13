import { useState, useEffect } from 'react';
import { ActivityFeed } from '../components/ActivityFeed';
import type { ActivityLog } from '../components/ActivityFeed';
import { StatCard } from '../components/StatCard';
import { PerformanceChart } from '../components/PerformanceChart';
import { motion } from 'framer-motion';

interface ConnectedAccountData {
    availableAccounts: Array<{
        id: string;
        name: string;
        currency: string;
    }>;
}

interface PerformanceTrend {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    roas: number;
}

interface Campaign {
    campaignId: string;
    name: string;
    status: string;
    objective: string;
    budget: number;
}

export default function Dashboard() {
    const [adAccountId, setAdAccountId] = useState<string | null>(null);
    const [accountName, setAccountName] = useState<string>('');
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Stats State
    const [stats, setStats] = useState({
        spend: 0,
        impressions: 0,
        clicks: 0,
        roas: 0
    });

    const [trends, setTrends] = useState<PerformanceTrend[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [config, setConfig] = useState<{ mode: string }>({ mode: 'LOADING' });

    useEffect(() => {
        // 1. Get Ad Account from LocalStorage
        const stored = localStorage.getItem('connected_account');
        if (stored) {
            try {
                const data: ConnectedAccountData = JSON.parse(stored);
                if (data.availableAccounts && data.availableAccounts.length > 0) {
                    const account = data.availableAccounts[0]; // Pick first for MVP
                    setAdAccountId(account.id);
                    setAccountName(account.name);
                }
            } catch (e) {
                console.error('Failed to parse stored account');
            }
        } else {
            // Fallback for dev/demo if needed
            // setAdAccountId('act_123456789'); // Uncomment for testing without localstorage
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!adAccountId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Activity Logs
                const logsRes = await fetch(`/api/optimization/activity/${adAccountId}?limit=20`);
                const logsData = await logsRes.json();
                if (logsData.success) {
                    setLogs(logsData.logs);
                }

                // 2. Fetch Performance Stats
                const statsRes = await fetch(`/api/performance/dashboard?accountId=${adAccountId}`);
                const statsData = await statsRes.json();
                if (statsData.success && statsData.data && statsData.data.metrics) {
                    const m = statsData.data.metrics;
                    setStats({
                        spend: m.spend,
                        impressions: m.impressions,
                        clicks: m.clicks,
                        roas: m.roas
                    });
                }

                // 3. Fetch Performance Trends
                const trendsRes = await fetch(`/api/performance/trends?accountId=${adAccountId}&days=7`);
                const trendsData = await trendsRes.json();
                if (trendsData.success && Array.isArray(trendsData.data)) {
                    // Start from default empty array
                    const formattedTrends = trendsData.data.map((item: any) => ({
                        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        spend: item.spend,
                        impressions: item.impressions,
                        roas: item.spend > 0 ? Number((item.revenue / item.spend).toFixed(2)) : 0
                    }));
                    setTrends(formattedTrends);
                }

                // 4. Fetch Campaigns
                const campaignsRes = await fetch(`/api/campaigns?accountId=${adAccountId}&limit=5`);
                const campaignsData = await campaignsRes.json();
                if (campaignsData.data) {
                    setCampaigns(campaignsData.data);
                }

                // 5. Fetch Config
                const configRes = await fetch('/api/optimization/config');
                const configData = await configRes.json();
                if (configData.success && configData.config) {
                    setConfig(configData.config);
                }

            } catch (error) {
                console.error('Failed to fetch dashboard data', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        // Poll every 30s
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);

    }, [adAccountId]);

    if (!adAccountId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-4">No Ad Account Connected</h2>
                    <p className="mb-6 text-text-secondary-light dark:text-text-secondary-dark">Please launch a boost campaign to connect your account.</p>
                    <a href="/" className="px-6 py-2 bg-primary text-background-dark rounded-lg font-medium">Go to Boost</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark p-6 lg:p-10">

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex justify-between items-center mb-8"
            >
                <div>
                    <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
                        Command Center
                    </h1>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark">
                        Managing <strong>{accountName}</strong> ({adAccountId})
                    </p>
                </div>
                <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-primary/10 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                    <span className="material-symbols-outlined">add</span>
                    New Boost
                </button>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Stats & Charts */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Stats Row */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    >
                        <StatCard
                            title="Total Spend"
                            value={`$${stats.spend.toLocaleString()}`}
                            icon="payments"
                            trend="12%"
                            trendDirection="up"
                        />
                        <StatCard
                            title="Impressions"
                            value={stats.impressions.toLocaleString()}
                            icon="visibility"
                            trend="5%"
                            trendDirection="up"
                        />
                        <StatCard
                            title="Clicks"
                            value={stats.clicks.toLocaleString()}
                            icon="ads_click"
                            trend="8%"
                            trendDirection="up"
                        />
                        <StatCard
                            title="ROAS"
                            value={`${stats.roas}x`}
                            icon="trending_up"
                            trend="2%"
                            trendDirection="down" // Just to show variety
                        />
                    </motion.div>

                    {/* Main Chart */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {/* Only show chart if we have trends, otherwise internal mock might show or empty */}
                        <PerformanceChart data={trends.length > 0 ? trends : undefined} />
                    </motion.div>

                    {/* Recent Campaigns List (Placeholder) */}
                    {/* Recent Campaigns List */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden"
                    >
                        <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                            <h3 className="font-semibold text-lg text-text-primary-light dark:text-text-primary-dark">Recent Campaigns</h3>
                            <button className="text-primary text-sm font-medium hover:underline">View All</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark text-sm">
                                        <th className="p-4 font-medium">Name</th>
                                        <th className="p-4 font-medium">Status</th>
                                        <th className="p-4 font-medium">Objective</th>
                                        <th className="p-4 font-medium text-right">Budget</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaigns.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-text-secondary-light dark:text-text-secondary-dark">
                                                No campaigns found.
                                            </td>
                                        </tr>
                                    ) : (
                                        campaigns.map((campaign) => (
                                            <tr key={campaign.campaignId} className="border-b border-border-light/50 dark:border-border-dark/50 last:border-0 hover:bg-background-light/50 dark:hover:bg-background-dark/50 transition-colors">
                                                <td className="p-4 font-medium text-text-primary-light dark:text-text-primary-dark truncate max-w-[200px]">
                                                    {campaign.name}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${campaign.status === 'ACTIVE'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                                        }`}>
                                                        {campaign.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                                    {campaign.objective.replace('OUTCOME_', '').toLowerCase().replace(/_/g, ' ')}
                                                </td>
                                                <td className="p-4 text-right font-medium text-text-primary-light dark:text-text-primary-dark">
                                                    ${campaign.budget.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>

                {/* Right Column: Invisible Friend Feed */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="lg:col-span-1"
                >
                    <ActivityFeed logs={logs} isLoading={isLoading} />

                    <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20">
                        <h4 className="font-semibold text-text-primary-light dark:text-text-primary-dark mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">psychology</span>
                            AI Insight
                        </h4>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            "Optimization engine is <strong>{config.mode}</strong>. Monitoring for high ROAS opportunities."
                        </p>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
