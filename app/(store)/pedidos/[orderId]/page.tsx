"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getOrder } from "@/lib/orders";
import { getOrderPayments } from "@/lib/payments";
import type { OrderResponse, PaymentResponse } from "@/types/order";

const labels: Record<string, string> = { YAPE: "Yape", PLIN: "Plin", CARD: "Tarjeta", TRANSFERENCIA: "Transferencia", EFECTIVO: "Contra entrega" };
const money = (value: number, currency: string) => new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value);

export default function PedidoDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const savedOrder = await getOrder(orderId);
        if (cancelled) return;
        setOrder(savedOrder);
        try {
          setPayments(await getOrderPayments(orderId));
        } catch (paymentError) {
          if (!cancelled) setError(paymentError instanceof Error ? paymentError.message : "No se pudo cargar el detalle del pago.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el pedido.");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [loading, user, orderId]);

  if (loading || !user || (!order && !error)) return <main className="mx-auto max-w-5xl px-4 py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></main>;
  if (!order) return <main className="mx-auto max-w-5xl px-4 py-12"><p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error ?? "Pedido no encontrado."}</p></main>;
  const payment = payments[payments.length - 1];
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12"><Link href="/pedidos" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Mis pedidos</Link>{error && <p role="alert" className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{error} La orden mostrada proviene del backend.</p>}<div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Detalle de pedido</p><h1 className="mt-2 text-3xl font-black">{order.orderNumber}</h1><p className="mt-2 text-muted-foreground">{labels[order.paymentMethod] ?? order.paymentMethod} · Estado de orden: <strong className="text-foreground">{order.status}</strong></p></div><div className="text-right"><p className="text-2xl font-black">{money(order.total, order.currency)}</p><p className="mt-1 text-sm font-bold text-amber-800">Pago: {order.paymentStatus}</p></div></div><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]"><section><h2 className="text-lg font-bold">Productos</h2><div className="mt-4 divide-y divide-border">{order.items.map((item) => <div key={item.productId} className="flex justify-between gap-4 py-4 text-sm"><div><p className="font-semibold">{item.productName}</p><p className="text-muted-foreground">{item.quantity} × {money(item.unitPrice, order.currency)}</p></div><strong>{money(item.subtotal, order.currency)}</strong></div>)}</div></section><aside className="space-y-5"><div className="rounded-2xl bg-muted/60 p-5"><h2 className="font-bold">Pago simulado</h2>{payment ? <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted-foreground">Estado</dt><dd className="font-bold">{payment.status}</dd></div><div><dt className="text-muted-foreground">Referencia</dt><dd className="break-all font-bold">{payment.transactionReference}</dd></div>{payment.operationCode && <div><dt className="text-muted-foreground">Operación</dt><dd className="font-bold">{payment.operationCode}</dd></div>}</dl> : <p className="mt-3 text-sm text-muted-foreground">{order.paymentMethod === "EFECTIVO" ? "Pago pendiente contra entrega. No existe transacción electrónica." : "Todavía no hay una transacción registrada o la consulta temporalmente no está disponible."}</p>}</div><div className="rounded-2xl border border-border p-5"><h2 className="font-bold">Entrega</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{order.customer?.fullName}<br />{order.customer?.email}<br />{order.customer?.phone}<br />{order.customer?.address}<br />{order.customer?.city}</p></div></aside></div></div><div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" /> La información se consulta desde PostgreSQL.</div></main>;
}
