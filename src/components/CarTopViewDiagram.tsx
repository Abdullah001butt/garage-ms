export function CarTopViewDiagram() {
  return (
    <svg viewBox="0 0 220 340" className="h-full w-full" stroke="#1e293b" strokeWidth="2" fill="none">
      <rect x="55" y="20" width="110" height="300" rx="45" />
      <line x1="55" y1="95" x2="165" y2="95" />
      <line x1="55" y1="245" x2="165" y2="245" />
      <line x1="110" y1="95" x2="110" y2="245" />
      <rect x="30" y="55" width="25" height="45" rx="8" />
      <rect x="165" y="55" width="25" height="45" rx="8" />
      <rect x="30" y="240" width="25" height="45" rx="8" />
      <rect x="165" y="240" width="25" height="45" rx="8" />
      <rect x="85" y="35" width="50" height="35" rx="6" />
      <rect x="85" y="270" width="50" height="35" rx="6" />
    </svg>
  );
}
