import { CreditCard, Landmark, Smartphone, Truck } from "lucide-react";
import type { PaymentMethod } from "@/types/order";

const icons = {
  YAPE: Smartphone,
  PLIN: Smartphone,
  CARD: CreditCard,
  TRANSFERENCIA: Landmark,
  EFECTIVO: Truck,
} satisfies Record<PaymentMethod, typeof Smartphone>;

const descriptions: Record<PaymentMethod, string> = {
  YAPE: "Pago con billetera móvil",
  PLIN: "Pago con billetera móvil",
  CARD: "Crédito o débito",
  TRANSFERENCIA: "Transferencia bancaria",
  EFECTIVO: "Pago contra entrega",
};

const labels: Record<PaymentMethod, string> = {
  YAPE: "Yape",
  PLIN: "Plin",
  CARD: "Tarjeta de crédito o débito",
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Contra entrega",
};

export default function PaymentMethodCard({ method, selected, onSelect }: { method: PaymentMethod; selected: boolean; onSelect: () => void }) {
  const Icon = icons[method];
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`group flex min-h-32 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${selected ? "border-primary bg-primary/[0.04] shadow-sm ring-2 ring-primary/15" : "border-border bg-card"}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-primary"}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span><span className="block font-bold">{labels[method]}</span><span className="mt-0.5 block text-xs text-muted-foreground">{descriptions[method]}</span></span>
    </button>
  );
}
