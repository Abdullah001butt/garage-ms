export function CarTopViewDiagram() {
  return (
    <svg viewBox="0 0 240 420" className="h-full w-full" fill="none">
      {/* body outline */}
      <path
        d="M120 6
           C 168 6 190 22 196 55
           L 202 120
           C 205 140 206 160 206 210
           C 206 260 205 280 202 300
           L 196 365
           C 190 398 168 414 120 414
           C 72 414 50 398 44 365
           L 38 300
           C 35 280 34 260 34 210
           C 34 160 35 140 38 120
           L 44 55
           C 50 22 72 6 120 6 Z"
        stroke="#1e293b"
        strokeWidth="2.5"
      />

      {/* windshield */}
      <path d="M62 78 L178 78 L166 118 L74 118 Z" stroke="#1e293b" strokeWidth="1.5" />
      {/* rear windshield */}
      <path d="M70 330 L170 330 L162 300 L78 300 Z" stroke="#1e293b" strokeWidth="1.5" />
      {/* roof */}
      <rect x="74" y="118" width="92" height="182" rx="14" stroke="#1e293b" strokeWidth="1.5" />
      {/* roof centerline */}
      <line x1="120" y1="118" x2="120" y2="300" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />

      {/* hood lines */}
      <line x1="50" y1="60" x2="72" y2="76" stroke="#94a3b8" strokeWidth="1" />
      <line x1="190" y1="60" x2="168" y2="76" stroke="#94a3b8" strokeWidth="1" />
      {/* trunk lines */}
      <line x1="50" y1="360" x2="72" y2="332" stroke="#94a3b8" strokeWidth="1" />
      <line x1="190" y1="360" x2="168" y2="332" stroke="#94a3b8" strokeWidth="1" />

      {/* doors */}
      <line x1="34" y1="150" x2="74" y2="150" stroke="#94a3b8" strokeWidth="1" />
      <line x1="34" y1="270" x2="74" y2="270" stroke="#94a3b8" strokeWidth="1" />
      <line x1="206" y1="150" x2="166" y2="150" stroke="#94a3b8" strokeWidth="1" />
      <line x1="206" y1="270" x2="166" y2="270" stroke="#94a3b8" strokeWidth="1" />
      <line x1="120" y1="150" x2="120" y2="118" stroke="#94a3b8" strokeWidth="1" />
      <line x1="120" y1="270" x2="120" y2="300" stroke="#94a3b8" strokeWidth="1" />

      {/* mirrors */}
      <rect x="24" y="108" width="12" height="20" rx="4" stroke="#1e293b" strokeWidth="1.5" />
      <rect x="204" y="108" width="12" height="20" rx="4" stroke="#1e293b" strokeWidth="1.5" />

      {/* wheels */}
      <rect x="14" y="72" width="20" height="52" rx="7" fill="#1e293b" />
      <rect x="206" y="72" width="20" height="52" rx="7" fill="#1e293b" />
      <rect x="14" y="296" width="20" height="52" rx="7" fill="#1e293b" />
      <rect x="206" y="296" width="20" height="52" rx="7" fill="#1e293b" />

      {/* front/rear bumper accents */}
      <line x1="60" y1="14" x2="180" y2="14" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="60" y1="406" x2="180" y2="406" stroke="#1e293b" strokeWidth="1.5" />
    </svg>
  );
}
