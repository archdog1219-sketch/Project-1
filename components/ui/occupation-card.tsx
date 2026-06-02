"use client";

interface OccupationCardProps {
  icon: string;
  title: string;
  description: string;
  value: string;
  selected: boolean;
  onSelect: (value: string) => void;
}

export function OccupationCard({
  icon,
  title,
  description,
  value,
  selected,
  onSelect,
}: OccupationCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        selected
          ? "border-indigo-500 bg-indigo-50"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </button>
  );
}
