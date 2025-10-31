import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

/**
 * Calculates the current streak and daily activity data.
 * @returns An object with streak count and activity data for the grid.
 */
function useStreakData() {
  const testSessions = useLiveQuery(() => db.testSessions.orderBy('completedAt').toArray(), []);

  if (!testSessions || testSessions.length === 0) {
    return { streak: 0, activity: new Map<string, number>() };
  }

  const activity = new Map<string, number>();
  const uniqueDays = new Set<string>();

  // Aggregate test counts per day
  for (const event of testSessions) {
    const day = event.completedAt.toISOString().split('T')[0];
    activity.set(day, (activity.get(day) || 0) + 1);
    uniqueDays.add(day);
  }

  // Calculate streak
  let streak = 0;
  const today = new Date();
  let currentDay = new Date(today);

  // A streak is only valid if there was activity today OR yesterday.
  // If there was no activity today, start checking from yesterday.
  const todayStr = currentDay.toISOString().split('T')[0];
  if (!uniqueDays.has(todayStr)) {
    currentDay.setDate(currentDay.getDate() - 1);
  }

  // Now, walk backwards day-by-day to count the streak.
  while (true) {
    const dayStr = currentDay.toISOString().split('T')[0];
    if (uniqueDays.has(dayStr)) {
      streak++;
      // Move to the previous day
      currentDay.setDate(currentDay.getDate() - 1);
    } else {
      // The streak is broken
      break;
    }
  }

  return { streak, activity };
}

/**
 * Renders the daily activity grid.
 */
function ActivityGrid({ activity }: { activity: Map<string, number> }) {
  const today = new Date();
  const days = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const getColor = (count: number) => {
    if (count === 0) return 'bg-zinc-800';
    if (count <= 2) return 'bg-green-900';
    if (count <= 5) return 'bg-green-700';
    if (count <= 10) return 'bg-green-500';
    return 'bg-green-400';
  };

  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1 justify-start">
      {days.map(day => {
        const count = activity.get(day) || 0;
        return (
          <div
            key={day}
            className={`h-3 w-3 rounded-sm ${getColor(count)}`}
            title={`${count} review${count !== 1 ? 's' : ''} on ${day}`}
          />
        );
      })}
    </div>
  );
}

export function TestStreak() {
  const { streak, activity } = useStreakData();

  return (
    <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Your Activity</h3>
        <p className="text-lg font-bold text-orange-400">
          {streak} day streak!
        </p>
      </div>
      <ActivityGrid activity={activity} />
    </div>
  );
}
