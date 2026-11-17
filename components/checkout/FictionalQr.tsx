import { useMemo } from "react";

function hash(value: string) {
  return value.split("").reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 997, 17);
}

export default function FictionalQr({ seed, wallet }: { seed: string; wallet: "YAPE" | "PLIN" }) {
  const cells = useMemo(() => {
    const base = hash(`${wallet}:${seed}`);
    return Array.from({ length: 169 }, (_, index) => ((base + index * 17 + index * index) % 7) < 3);
  }, [seed, wallet]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" role="img" aria-label={`QR ficticio de demostración para ${wallet}`}>
      <svg viewBox="0 0 13 13" className="mx-auto block h-44 w-44" shapeRendering="crispEdges" aria-hidden="true">
        <rect width="13" height="13" fill="white" />
        {cells.map((filled, index) => filled && <rect key={index} x={index % 13} y={Math.floor(index / 13)} width="1" height="1" fill="#0b1c30" />)}
        {[0, 8].map((offset) => <rect key={`outer-${offset}`} x={offset} y="0" width="5" height="5" fill="white" stroke="#0b1c30" strokeWidth="0.6" />)}
        <rect x="1" y="1" width="3" height="3" fill="#0b1c30" />
        <rect x="9" y="1" width="3" height="3" fill="#0b1c30" />
        <rect x="1" y="9" width="3" height="3" fill="#0b1c30" />
      </svg>
      <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">QR ficticio · solo demo</p>
    </div>
  );
}
