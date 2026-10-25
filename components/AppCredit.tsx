export function AppCredit({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-xs text-slate-500 ${className}`.trim()}
      aria-label="Utviklet av Simen Navjord"
    >
      Utviklet av <span className="font-medium text-slate-600">Simen Navjord</span>
    </p>
  );
}
