import React from 'react';

type ReviewListControlsProps = {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
};

export function ReviewListControls({
  searchTerm,
  onSearchTermChange,
  sortBy,
  onSortByChange,
}: ReviewListControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <input
        type="text"
        placeholder="Search cards..."
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
        className="flex-grow rounded-md border border-zinc-600 bg-zinc-800 p-2 text-sm text-white placeholder-zinc-500"
      />
      <select
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value)}
        className="rounded-md border border-zinc-600 bg-zinc-800 p-2 text-sm text-white"
      >
        <option value="concept">Sort by Concept (A-Z)</option>
        <option value="createdAt_desc">Sort by Created (Newest)</option>
        <option value="createdAt_asc">Sort by Created (Oldest)</option>
        <option value="dueDate_asc">Sort by Due Date (Soonest)</option>
      </select>
    </div>
  );
}