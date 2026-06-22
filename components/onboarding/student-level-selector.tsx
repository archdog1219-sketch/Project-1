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
    <div style={{ display: "flex", gap: "8px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            padding: "16px",
            cursor: "pointer",
            borderRadius: "2px",
            border: selected === opt.value ? "1px solid #29487d" : "1px solid #c8d0e0",
            background: selected === opt.value ? "#e8edf5" : "#fff",
          }}
        >
          <span style={{ fontSize: "28px" }}>{opt.icon}</span>
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998" }}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
