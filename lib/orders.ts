import { getApiUrl, getAuthHeaders } from "@/lib/api-client";
import type {
  CreateOrderRequest,
  OrderErrorBody,
  OrderResponse,
  OrderPageResponse,
} from "@/types/order";

export class OrderError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(message: string, status: number, details?: Record<string, string>) {
    super(message);
    this.name = "OrderError";
    this.status = status;
    this.details = details;
  }
}

export async function createOrder(
  payload: CreateOrderRequest,
  idempotencyKey: string
): Promise<OrderResponse> {
  const response = await fetch(getApiUrl("/api/orders"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let body: OrderErrorBody = {};
    try {
      body = (await response.json()) as OrderErrorBody;
    } catch {
      // La respuesta de error puede no ser JSON.
    }

    const message =
      body.message ||
      body.error ||
      (response.status === 401 || response.status === 403
        ? "Debes iniciar sesión para finalizar la compra."
        : `Error ${response.status}: no se pudo crear el pedido.`);

    throw new OrderError(message, response.status, body.details);
  }

  return (await response.json()) as OrderResponse;
}

export async function getOrder(orderId: string): Promise<OrderResponse> {
  const response = await fetch(getApiUrl(`/api/orders/${encodeURIComponent(orderId)}`), {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new OrderError("No se pudo recuperar el pedido.", response.status);
  }

  return (await response.json()) as OrderResponse;
}

export async function listOrders(page = 0, size = 10): Promise<OrderPageResponse> {
  const response = await fetch(getApiUrl(`/api/orders?page=${page}&size=${size}`), {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new OrderError("No se pudo recuperar el historial de pedidos.", response.status);
  }
  return (await response.json()) as OrderPageResponse;
}
