

interface StatCardProps {
    title: string;
    value: string | number;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
    icon: string;
}

export function StatCard({ title, value, trend, trendDirection = 'neutral', icon }: StatCardProps) {
    const trendColor =
        trendDirection === 'up' ? 'text-green-500' :
            trendDirection === 'down' ? 'text-red-500' :
                'text-gray-500';

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <span className="material-symbols-outlined text-primary text-xl">
                        {icon}
                    </span>
                </div>
                {trend && (
                    <div className={`text-sm font-medium ${trendColor} flex items-center`}>
                        {trendDirection === 'up' ? '↗' : trendDirection === 'down' ? '↘' : '–'} {trend}
                    </div>
                )}
            </div>

            <div className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
                {value}
            </div>
            <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">
                {title}
            </div>
        </div>
    );
}
