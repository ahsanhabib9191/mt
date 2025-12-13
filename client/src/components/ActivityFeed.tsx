

import { Skeleton } from './Skeleton';

export interface ActivityLog {
    _id: string;
    action: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'ACTION' | 'ERROR';
    executedAt: string; // ISO Date String
}

interface ActivityFeedProps {
    logs: ActivityLog[];
    isLoading?: boolean;
}

export function ActivityFeed({ logs, isLoading }: ActivityFeedProps) {

    const getIcon = (severity: string) => {
        switch (severity) {
            case 'ACTION': return 'bolt'; // Lightning for actions
            case 'WARNING': return 'warning';
            case 'ERROR': return 'error';
            case 'INFO': default: return 'info';
        }
    };

    const getColor = (severity: string) => {
        switch (severity) {
            case 'ACTION': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
            case 'WARNING': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'ERROR': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
            case 'INFO': default: return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
        }
    };

    if (isLoading) {
        return (
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden h-[400px]">
                <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                    <Skeleton width={180} height={24} />
                    <Skeleton width={60} height={20} rounded="full" />
                </div>
                <div className="p-6 space-y-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton width={32} height={32} rounded="full" className="shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between">
                                    <Skeleton width={100} height={16} />
                                    <Skeleton width={40} height={16} />
                                </div>
                                <Skeleton width="100%" height={16} />
                                <Skeleton width="80%" height={16} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!logs || logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-surface-light dark:bg-surface-dark rounded-2xl border border-dashed border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">history</span>
                <p className="text-text-secondary-light dark:text-text-secondary-dark">No activity yet. Launch a campaign to wake me up.</p>
            </div>
        );
    }

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                <h3 className="font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">smart_toy</span>
                    Invisible Friend Activity
                </h3>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Online
                </span>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
                {logs.map((log) => (
                    <div key={log._id} className="relative pl-6 pb-2 last:pb-0">
                        {/* Timeline Line */}
                        <div className="absolute left-0 top-2 bottom-0 w-px bg-border-light dark:border-border-dark last:hidden"></div>

                        <div className="flex gap-4 items-start relative">
                            {/* Timeline Dot/Icon */}
                            <div className={`absolute -left-6 z-10 w-8 h-8 rounded-full border-4 border-white dark:border-surface-dark flex items-center justify-center ${getColor(log.severity)}`}>
                                <span className="material-symbols-outlined text-sm">{getIcon(log.severity)}</span>
                            </div>

                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                                        {log.action.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                        {new Date(log.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                                    {log.message}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
