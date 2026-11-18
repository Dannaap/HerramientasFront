"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Clock3, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { EMPTY_CART, readCart, subscribeToCart, writeCart } from "@/lib/cart";
import { createOrder, getOrder, OrderError } from "@/lib/orders";
import { getOrderPayments, PaymentError, processPayment } from "@/lib/payments";
import { findUnavailableCartItems } from "@/lib/cart";
import { useCombinedProducts } from "@/lib/use-combined-products";
import type { CartItem } from "@/lib/cart";
import type { CreateOrderRequest, OrderResponse, PaymentMethod, PaymentResponse, PaymentScenario } from "@/types/order";
import CheckoutStepIndicator from "@/components/checkout/CheckoutStepIndicator";
import FictionalQr from "@/components/checkout/FictionalQr";
import PaymentMethodCard from "@/components/checkout/PaymentMethodCard";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKOUT_STATE_KEY = "nexora_checkout_state";

type FormState = { fullName: string; email: string; phone: string; address: string; city: string; notes: string };
type CheckoutState = { userId: string; orderId: string; orderKey: string; paymentKey: string; paymentMethod: PaymentMethod };

const fieldClass = "min-h-12 w-full rounded-xl border border-border bg-card px-4 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";
const buttonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50";

const paymentLabels: Record<PaymentMethod, string> = {
  YAPE: "Yape", PLIN: "Plin", CARD: "Tarjeta de crédito o débito",
};

function formatPrice(value: number, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value);
}

function makeKey(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function readPersistedState(userId: string): CheckoutState | null {
  try {
    const value = JSON.parse(localStorage.getItem(CHECKOUT_STATE_KEY) || "null") as CheckoutState | null;
    return value?.userId === userId && value.orderId && value.orderKey && value.paymentKey ? value : null;
  } catch { return null; }
}

function savePersistedState(state: CheckoutState) {
  localStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(state));
}

function clearPersistedState() {
  localStorage.removeItem(CHECKOUT_STATE_KEY);
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">{children}</main>;
}

function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return <div className={`flex gap-3 rounded-2xl border p-4 text-sm ${tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-primary/15 bg-primary/[0.04] text-foreground"}`} role="note"><CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div>{children}</div></div>;
}

function Summary({ items, total, currency = "PEN", order }: { items: CartItem[]; total: number; currency?: string; order?: OrderResponse | null }) {
  const lines = order?.items ?? items.map((item) => ({ productId: item.id, productName: item.nombre, quantity: item.cantidad, subtotal: item.precio * item.cantidad }));
  return <aside className="rounded-3xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6">
    <div className="flex items-center justify-between"><h2 className="font-bold">Resumen del pedido</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{lines.length} {lines.length === 1 ? "producto" : "productos"}</span></div>
    <ul className="mt-5 space-y-4">{lines.map((item) => <li key={item.productId} className="flex justify-between gap-4 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{item.productName}</span><span className="text-xs text-muted-foreground">Cantidad: {item.quantity}</span></span><span className="shrink-0 font-semibold">{formatPrice(item.subtotal, currency)}</span></li>)}</ul>
    <div className="mt-5 flex items-end justify-between border-t border-border pt-5"><span className="text-sm text-muted-foreground">Total</span><strong className="text-2xl tracking-tight">{formatPrice(order?.total ?? total, currency)}</strong></div>
    <p className="mt-2 text-xs text-muted-foreground">El total final siempre lo confirma el servidor.</p>
  </aside>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const approved = normalized === "APPROVED" || normalized === "CONFIRMED";
  const rejected = normalized === "REJECTED" || normalized === "PAYMENT_FAILED";
  const label = approved ? "Pago aprobado" : rejected ? "Pago rechazado" : normalized === "PROCESSING" ? "Procesando pago" : "Pago pendiente";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${approved ? "bg-emerald-100 text-emerald-800" : rejected ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const items = useSyncExternalStore(subscribeToCart, readCart, () => EMPTY_CART);
  const { allProducts, isLoaded: catalogLoaded, error: catalogError } = useCombinedProducts();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>("YAPE");
  const [form, setForm] = useState<FormState>({ fullName: "", email: "", phone: "", address: "", city: "", notes: "" });
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [scenario, setScenario] = useState<PaymentScenario>("APPROVED");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const createKeyRef = useRef<string | null>(null);
  const paymentKeyRef = useRef<string | null>(null);

  const currentItems = items.map((item) => {
    const product = allProducts.find((candidate) => candidate.id === item.id);
    return product
      ? { ...item, nombre: product.name, slug: product.slug, especificacion: product.sku, precio: product.price, imagen: product.image }
      : item;
  });
  const cartTotal = currentItems.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const currentPayment = payments[payments.length - 1] ?? null;
  const unavailableItems = catalogLoaded ? findUnavailableCartItems(items, allProducts) : items;

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const recover = async () => {
      try {
        const saved = readPersistedState(String(user.id));
        if (!saved) return;
        createKeyRef.current = saved.orderKey;
        paymentKeyRef.current = saved.paymentKey;
        const savedOrder = await getOrder(saved.orderId);
        if (items.length > 0 && savedOrder.paymentStatus !== "PENDING") {
          clearPersistedState();
          createKeyRef.current = null;
          paymentKeyRef.current = null;
          return;
        }
        let savedPayments: PaymentResponse[] = [];
        let paymentsUnavailable = false;
        try {
          savedPayments = await getOrderPayments(saved.orderId);
        } catch (paymentError) {
          paymentsUnavailable = true;
          if (!cancelled) setError(paymentError instanceof Error ? paymentError.message : "No se pudo recuperar el pago; la orden sigue protegida.");
        }
        if (cancelled) return;
        setOrder(savedOrder);
        setMethod(savedOrder.paymentMethod as PaymentMethod);
        setPayments(savedPayments);
        const terminal = savedOrder.paymentStatus !== "PENDING" || savedPayments.length > 0 || paymentsUnavailable;
        setStep(terminal ? 4 : 3);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo recuperar el checkout.");
      } finally {
        if (!cancelled) setRecovering(false);
      }
    };
    recover();
    return () => { cancelled = true; };
  }, [loading, user, items]);

  const setField = (name: keyof FormState, value: string) => setForm((previous) => ({ ...previous, [name]: value }));

  const validateCustomer = () => {
    const values = { ...form, fullName: form.fullName || user?.fullName || "", email: form.email || user?.email || "", phone: form.phone || user?.phone || "" };
    const required: Array<[keyof FormState, string]> = [["fullName", "nombre completo"], ["email", "correo"], ["phone", "teléfono"], ["address", "dirección"], ["city", "ciudad"]];
    const missing = required.find(([key]) => !values[key].trim());
    if (missing) { setError(`Completa tu ${missing[1]} para continuar.`); return false; }
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) { setError("Ingresa un correo electrónico válido."); return false; }
    if (!items.length) { setError("Tu carrito está vacío."); return false; }
    if (unavailableItems.length > 0) {
      setError("Hay productos sin stock suficiente o que ya no están disponibles. Revisa tu carrito.");
      return false;
    }
    if (items.some((item) => !UUID_REGEX.test(item.id))) { setError("Hay un producto de prueba no comprable en tu carrito."); return false; }
    return true;
  };

  const handleCustomerSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (validateCustomer()) setStep(2);
  };

  const handleCreateOrder = async () => {
    setError(null);
    if (!validateCustomer()) { setStep(1); return; }
    setBusy(true);
    try {
      const values = { ...form, fullName: form.fullName || user?.fullName || "", email: form.email || user?.email || "", phone: form.phone || user?.phone || "" };
      const orderKey = createKeyRef.current ?? makeKey("nexora-order");
      const paymentKey = paymentKeyRef.current ?? makeKey("nexora-payment");
      createKeyRef.current = orderKey;
      paymentKeyRef.current = paymentKey;
      const payload: CreateOrderRequest = { items: items.map((item) => ({ productId: item.id, quantity: item.cantidad })), customer: { fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim(), address: values.address.trim(), city: values.city.trim(), notes: values.notes.trim() || undefined }, paymentMethod: method };
      const created = await createOrder(payload, orderKey);
      savePersistedState({ userId: String(user?.id ?? ""), orderId: created.id, orderKey, paymentKey, paymentMethod: method });
      writeCart([]);
      setOrder(created);
       setStep(3);
    } catch (err) {
      setError(err instanceof OrderError ? err.message : "No se pudo crear el pedido. Inténtalo de nuevo.");
    } finally { setBusy(false); }
  };

  const handlePayment = async () => {
    if (!order || !paymentKeyRef.current) return;
    setError(null); setBusy(true);
    try {
      const result = await processPayment(order.id, { scenario }, paymentKeyRef.current);
      setPayments((previous) => previous.some((payment) => payment.transactionId === result.transactionId) ? previous : [...previous, result]);
      setOrder((previous) => previous ? { ...previous, status: result.orderStatus, paymentStatus: result.orderPaymentStatus } : previous);
      setStep(4);
    } catch (err) {
      setError(err instanceof PaymentError ? err.message : "No se pudo contactar al motor de simulación.");
    } finally { setBusy(false); }
  };

  const finishCheckout = () => { clearPersistedState(); router.push("/productos"); };

  if (catalogError) return <Shell><div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm"><h1 className="text-xl font-bold">No se pudo validar el catálogo</h1><p className="mt-2 text-sm text-amber-950">Recarga la página para comprobar el stock actual antes de comprar.</p></div></Shell>;
  if (loading || recovering || !catalogLoaded || !user) return <Shell><div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-10 text-center shadow-sm"><RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" aria-hidden="true" /><p className="mt-4 text-sm text-muted-foreground">Preparando tu checkout seguro...</p></div></Shell>;
  if (!order && items.length === 0) return <Shell><div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-10 text-center shadow-sm"><h1 className="text-2xl font-bold">Tu carrito está vacío</h1><p className="mt-2 text-muted-foreground">Agrega productos para iniciar una compra simulada.</p><Link href="/productos" className={`${buttonClass} mt-6 bg-primary text-primary-foreground`}>Ver productos <ArrowRight className="h-4 w-4" /></Link></div></Shell>;

  const displayValues = { ...form, fullName: form.fullName || user.fullName, email: form.email || user.email, phone: form.phone || user.phone || "" };

  return <Shell>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><Link href="/carrito" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver al carrito</Link><p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">NEXORA PAY</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Finalizar compra</h1></div>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" /> Sesión protegida</div>
    </div>
    <CheckoutStepIndicator current={step} />
    {error && <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> <span>{error}</span></div>}

    {!order && step === 1 && <form onSubmit={handleCustomerSubmit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"><div className="mb-7 flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">1</span><div><h2 className="text-xl font-bold">Datos y entrega</h2><p className="mt-1 text-sm text-muted-foreground">Usaremos estos datos para preparar tu pedido.</p></div></div><div className="grid gap-5 sm:grid-cols-2">
        {([["fullName", "Nombre completo", "name"], ["email", "Correo electrónico", "email"], ["phone", "Teléfono", "tel"], ["city", "Ciudad", "address-level2"], ["address", "Dirección de entrega", "street-address"]] as const).map(([name, label, autoComplete]) => <label key={name} className={name === "address" ? "sm:col-span-2" : ""}><span className="mb-2 block text-sm font-bold">{label} <span className="text-primary">*</span></span><input className={fieldClass} type={name === "email" ? "email" : name === "phone" ? "tel" : "text"} autoComplete={autoComplete} value={displayValues[name]} onChange={(event) => setField(name, event.target.value)} /></label>)}
        <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold">Notas <span className="font-normal text-muted-foreground">(opcional)</span></span><textarea className={`${fieldClass} py-3`} rows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Referencia para la entrega, si la necesitas" /></label>
      </div><div className="mt-8 flex justify-end"><button type="submit" className={`${buttonClass} bg-primary text-primary-foreground`}>Elegir método <ArrowRight className="h-4 w-4" /></button></div></section>
       <Summary items={currentItems} total={cartTotal} />
    </form>}

     {!order && step === 2 && <div className="grid gap-8 lg:grid-cols-[1fr_360px]"><section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"><div className="mb-7 flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">2</span><div><h2 className="text-xl font-bold">Selecciona tu método de pago</h2></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(["YAPE", "PLIN", "CARD"] as PaymentMethod[]).map((value) => <PaymentMethodCard key={value} method={value} selected={method === value} onSelect={() => setMethod(value)} />)}</div><Notice>Este entorno utiliza una simulación de pago y no procesa dinero real.</Notice><div className="mt-8 flex flex-wrap justify-between gap-3"><button type="button" className={`${buttonClass} border border-border bg-card hover:bg-muted`} onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Atrás</button><button type="button" disabled={busy} className={`${buttonClass} bg-primary text-primary-foreground`} onClick={handleCreateOrder}>{busy ? "Procesando pago" : "Continuar al pago"}<ArrowRight className="h-4 w-4" /></button></div></section><Summary items={currentItems} total={cartTotal} /></div>}

     {order && step === 3 && <div className="grid gap-8 lg:grid-cols-[1fr_360px]"><section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"><div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">3</span><div><h2 className="text-xl font-bold">Pago</h2><p className="mt-1 text-sm text-muted-foreground">Pedido <strong className="text-foreground">{order.orderNumber}</strong> · {paymentLabels[method]}</p></div></div><StatusBadge status="PENDING" /></div>
       {(method === "YAPE" || method === "PLIN") && <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr] md:items-center"><FictionalQr seed={order.id} wallet={method} /><div><p className="text-sm font-semibold text-muted-foreground">Billetera seleccionada</p><h3 className="mt-1 text-2xl font-black">{paymentLabels[method]}</h3><p className="mt-3 text-sm text-muted-foreground">Escanea únicamente este código ficticio dentro de la demostración. No contiene una dirección real de pago.</p><p className="mt-4 text-2xl font-black text-primary">{formatPrice(order.total, order.currency)}</p></div></div>}
       {method === "CARD" && <div className="relative mt-6 aspect-[1.7/1] max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-primary to-indigo-400 p-6 text-white shadow-xl"><Sparkles className="absolute right-6 top-6 h-5 w-5 text-cyan-200" /><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">NEXORA PAY</p><p className="mt-10 text-xl tracking-[0.28em]">•••• •••• •••• ••••</p><div className="mt-5 flex justify-between text-xs uppercase tracking-widest text-slate-200"><span>Tarjeta</span><span>Pago seguro</span></div></div>}
       <div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 flex items-center gap-2 text-sm font-bold">Resultado del pago <span className="text-primary">*</span></span><select className={fieldClass} value={scenario} onChange={(event) => setScenario(event.target.value as PaymentScenario)}><option value="APPROVED">Pago aprobado</option><option value="REJECTED">Pago rechazado</option><option value="PENDING">Pago pendiente</option></select></label></div>
       <div className="mt-8 flex flex-wrap justify-between gap-3"><span className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-muted/50 px-5 text-sm font-semibold text-muted-foreground"><LockKeyhole className="h-4 w-4" /> Método fijado al pedido</span><button type="button" disabled={busy} className={`${buttonClass} bg-primary text-primary-foreground`} onClick={handlePayment}>{busy ? "Procesando pago" : "Continuar"}<ShieldCheck className="h-4 w-4" /></button></div>
    </section><Summary items={[]} total={0} order={order} currency={order.currency} /></div>}

    {order && step === 4 && <Confirmation order={order} payment={currentPayment} customer={order.customer ?? displayValues} onFinish={finishCheckout} />}
  </Shell>;
}

function Confirmation({ order, payment, customer, onFinish }: { order: OrderResponse; payment: PaymentResponse | null; customer: FormState | NonNullable<OrderResponse["customer"]>; onFinish: () => void }) {
  const approved = order.paymentStatus === "APPROVED";
  const rejected = order.paymentStatus === "REJECTED";
    const title = approved ? "Pago aprobado" : rejected ? "Pago rechazado" : "Pago pendiente";
  return <div className="mx-auto max-w-5xl"><div className={`rounded-3xl border p-6 shadow-sm sm:p-10 ${approved ? "border-emerald-200 bg-emerald-50/60" : rejected ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/70"}`}><div className="flex flex-col items-start justify-between gap-5 sm:flex-row"><div className="flex items-start gap-4"><span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${approved ? "bg-emerald-600 text-white" : rejected ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>{approved ? <CheckCircle2 className="h-7 w-7" /> : rejected ? <AlertCircle className="h-7 w-7" /> : <Clock3 className="h-7 w-7" />}</span><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">NEXORA PAY · SIMULACIÓN ACADÉMICA</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">No se ha transferido dinero real. Conserva este resumen para la demostración.</p></div></div><StatusBadge status={order.paymentStatus} /></div><div className="mt-8 grid gap-4 border-t border-current/10 pt-6 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pedido</p><p className="mt-1 text-xl font-black">{order.orderNumber}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</p><p className="mt-1 text-xl font-black">{formatPrice(order.total, order.currency)}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Método</p><p className="mt-1 text-xl font-black">{paymentLabels[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado de orden</p><p className="mt-1 text-xl font-black">{order.status}</p></div></div></div><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]"><div className="rounded-3xl border border-border bg-card p-6 shadow-sm"><h2 className="text-lg font-bold">Detalle de la orden</h2><div className="mt-5 divide-y divide-border">{order.items.map((item) => <div key={item.productId} className="flex justify-between gap-4 py-4 text-sm"><div><p className="font-semibold">{item.productName}</p><p className="text-muted-foreground">{item.quantity} × {formatPrice(item.unitPrice, order.currency)}</p></div><strong>{formatPrice(item.subtotal, order.currency)}</strong></div>)}</div>{payment && <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Referencia simulada</dt><dd className="font-semibold">{payment.transactionReference}</dd></div>{payment.operationCode && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Código de operación</dt><dd className="font-semibold">{payment.operationCode}</dd></div>}{payment.failureReason && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Motivo</dt><dd className="text-right font-semibold text-red-700">{payment.failureReason}</dd></div>}</dl>}</div><div className="space-y-5"><div className="rounded-3xl border border-border bg-card p-6 shadow-sm"><h2 className="font-bold">Entrega</h2><div className="mt-4 space-y-2 text-sm"><p className="font-semibold">{customer.fullName}</p><p className="text-muted-foreground">{customer.email}</p><p className="text-muted-foreground">{customer.phone}</p><p className="pt-2 text-muted-foreground">{customer.address}<br />{customer.city}</p></div></div><div className="rounded-3xl border border-primary/15 bg-primary/[0.04] p-6"><div className="flex gap-3"><Truck className="h-5 w-5 shrink-0 text-primary" /><p className="text-sm text-muted-foreground">Siguiente paso: coordinaremos la entrega con los datos registrados.</p></div></div></div></div><div className="mt-8 flex flex-wrap justify-end gap-3"><button type="button" onClick={onFinish} className={`${buttonClass} bg-primary text-primary-foreground`}>Seguir comprando <ArrowRight className="h-4 w-4" /></button></div></div>;
}
