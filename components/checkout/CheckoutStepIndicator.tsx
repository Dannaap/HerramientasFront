import { Check } from "lucide-react";

const steps = [
  { number: 1, label: "Datos" },
  { number: 2, label: "Método" },
  { number: 3, label: "Pago" },
  { number: 4, label: "Confirmación" },
];

export default function CheckoutStepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Progreso del checkout" className="mb-8 overflow-x-auto pb-1">
      <ol className="mx-auto flex min-w-[560px] items-center justify-center">
        {steps.map((step, index) => {
          const done = current > step.number;
          const active = current === step.number;
          return (
            <li key={step.number} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition-colors ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary bg-primary/10 text-primary ring-4 ring-primary/10"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden="true" /> : step.number}
                </span>
                <span className={`hidden text-sm font-semibold sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <span className={`mx-3 h-px flex-1 ${current > step.number ? "bg-primary" : "bg-border"}`} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
