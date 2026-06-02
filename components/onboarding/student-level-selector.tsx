"use client";

interface StudentLevelSelectorProps {
  selected: "High School" | "College" | "";
  onSelect: (level: "High School" | "College") => void;
}

export function StudentLevelSelector({
  selected,
  onSelect,
}: StudentLevelSelectorProps) {
  const options = [
    { value: "High School" as const, icon: "🏫", label: "High School" },
    { value: "College" as const, icon: "🎓", label: "College" },
  ];

  return (
    <div className="flex gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`flex-1 flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            selected === opt.value
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <span className="text-3xl">{opt.icon}</span>
          <span className="font-semibold text-gray-900">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
