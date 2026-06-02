interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div className="flex gap-2" role="progressbar" aria-valuenow={currentStep} aria-valuemax={totalSteps}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < currentStep ? "bg-indigo-600" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}
