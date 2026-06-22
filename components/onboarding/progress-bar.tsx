interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div style={{ display: "flex", gap: "4px" }} role="progressbar" aria-valuenow={currentStep} aria-valuemax={totalSteps}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          style={{
            height: "6px",
            flex: 1,
            borderRadius: "2px",
            background: i < currentStep ? "#3b5998" : "#c8d0e0",
          }}
        />
      ))}
    </div>
  );
}
