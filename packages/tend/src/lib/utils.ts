import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date as relative time (e.g., "2 minutes ago", "3 hours ago")
 */
export function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  let result: string;

  if (diffSec < 60) {
    result = diffSec === 1 ? '1 second' : `${diffSec} seconds`;
  } else if (diffMin < 60) {
    result = diffMin === 1 ? '1 minute' : `${diffMin} minutes`;
  } else if (diffHour < 24) {
    result = diffHour === 1 ? '1 hour' : `${diffHour} hours`;
  } else if (diffDay < 30) {
    result = diffDay === 1 ? '1 day' : `${diffDay} days`;
  } else {
    const diffMonth = Math.floor(diffDay / 30);
    result = diffMonth === 1 ? '1 month' : `${diffMonth} months`;
  }

  return options?.addSuffix ? `${result} ago` : result;
}
