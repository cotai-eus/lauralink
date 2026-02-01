export function StatsCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: string;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 sm:p-6 backdrop-blur border border-gray-700 hover:border-purple-500 transition-colors">
      <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4 text-center sm:text-left">
        <div className="text-3xl sm:text-4xl flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-gray-400">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-white truncate">{value}</p>
          {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}
