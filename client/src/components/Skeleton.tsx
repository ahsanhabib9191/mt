

/**
 * A reusable Skeleton component for loading states.
 * Uses Tailwind 'animate-pulse' for the shimmer effect.
 */
interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Skeleton({ className = '', width, height, rounded = 'md' }: SkeletonProps) {
    const style = {
        width: width,
        height: height
    };

    // Map rounded prop to tailwind class
    const roundedClass =
        rounded === 'sm' ? 'rounded-sm' :
            rounded === 'md' ? 'rounded-md' :
                rounded === 'lg' ? 'rounded-lg' :
                    rounded === 'xl' ? 'rounded-xl' :
                        rounded === 'full' ? 'rounded-full' : 'rounded';

    return (
        <div
            className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${roundedClass} ${className}`}
            style={style}
        />
    );
}
