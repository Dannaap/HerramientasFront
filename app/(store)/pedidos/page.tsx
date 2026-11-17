"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { listOrders } from "@/lib/orders";
import type { OrderPageResponse } from "@/types/order";

const labels: Record<string, string> = { YAPE: "Yape", PLIN: "Plin", CARD: "Tarjeta", TRANSFERENCIA: "Transferencia", EFECTIVO: "Contra entrega" };
const money = (value: number, currency: string) => new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value));

function Status({ value }: { value: string }) {
  const rejected = value === "REJECTED" || value === "PAYMENT_FAILED";
  const approved = value === "APPROVED" || value === "CONFIRMED";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${approved ? "bg-emerald-100 text-emerald-800" : rejected ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{value}</span>;
}

export default function PedidosPage() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<OrderPageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    listOrders(page).then((result) => { if (!cancelled) setOrders(result); }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el historial."); });
    return () => { cancelled = true; };
  }, [loading, user, page]);

  if (loading || !user) return <main className="mx-auto max-w-5xl px-4 py-12"><p className="text-sm text-muted-foreground">Cargando historial...</p></main>;
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">NEXORA STORE</p><h1 className="mt-2 text-3xl font-black tracking-tight">Mis pedidos</h1><p className="mt-2 text-muted-foreground">Consulta tus órdenes y estados de pago persistidos.</p></div><Link href="/productos" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Comprar productos <ArrowRight className="h-4 w-4" /></Link></div>{error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{!orders && !error && <div className="mt-10 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>}{orders?.content.length === 0 && <div className="mt-10 rounded-3xl border border-border bg-card p-10 text-center shadow-sm"><ClipboardList className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-4 text-xl font-bold">Todavía no tienes pedidos</h2><p className="mt-2 text-muted-foreground">Tus compras aparecerán aquí después de crear una orden.</p></div>}{orders && orders.content.length > 0 && <><div className="mt-8 space-y-3">{orders.content.map((order) => <Link key={order.id} href={`/pedidos/${order.id}`} className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-lg font-black">{order.orderNumber}</p><p className="mt-1 text-sm text-muted-foreground">{date(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? "producto" : "productos"}</p></div><div className="text-right"><p className="text-lg font-black">{money(order.total, order.currency)}</p><Status value={order.paymentStatus} /></div></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-4 text-sm text-muted-foreground"><span>Pago: <strong className="text-foreground">{labels[order.paymentMethod] ?? order.paymentMethod}</strong></span><span>Orden: <strong className="text-foreground">{order.status}</strong></span><span className="ml-auto inline-flex items-center gap-1 font-bold text-primary">Ver detalle <ArrowRight className="h-4 w-4" /></span></div></Link>)}</div>{orders.totalPages > 1 && <div className="mt-6 flex justify-between"><button disabled={orders.first} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold disabled:opacity-40">Anterior</button><span className="py-2 text-sm text-muted-foreground">Página {orders.number + 1} de {orders.totalPages}</span><button disabled={orders.last} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold disabled:opacity-40">Siguiente</button></div>}</>}</main>;
}
