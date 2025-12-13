
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area
} from 'recharts';

interface PerformanceData {
    date: string;
    spend: number;
    impressions: number;
    roas: number;
}

// Mock Data (will replace later)
const MOCK_DATA: PerformanceData[] = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        spend: Math.floor(Math.random() * 500) + 100,
        impressions: Math.floor(Math.random() * 20000) + 5000,
        roas: Number((Math.random() * 3 + 1.5).toFixed(2))
    };
});

export function PerformanceChart({ data = MOCK_DATA }: { data?: PerformanceData[] }) {
    return (
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm h-96 w-full">
            <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-6 flex items-center gap-2">
                Performance Trends
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Last 7 Days</span>
            </h3>

            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                        <defs>
                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickMargin={10}
                        />
                        {/* Spend Axis */}
                        <YAxis
                            yAxisId="left"
                            orientation="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `$${value}`}
                        />
                        {/* ROAS Axis */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `${value}x`}
                            domain={[0, 'auto']}
                        />

                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                            }}
                            cursor={{ fill: 'transparent' }} // Hide gray bar
                        />

                        <Bar
                            yAxisId="left"
                            dataKey="spend"
                            barSize={32}
                            fill="url(#colorSpend)"
                            radius={[4, 4, 0, 0]}
                            name="Spend ($)"
                        />

                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="roas"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4, stroke: '#fff' }}
                            activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
                            name="ROAS (Return)"
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
