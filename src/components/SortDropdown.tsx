"use client";

export type SortOption = "newest" | "downloads" | "rating" | "name";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const options: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "downloads", label: "Most Downloaded" },
  { value: "rating", label: "Top Rated" },
  { value: "name", label: "A → Z" },
];

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-sm">Sort by:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
