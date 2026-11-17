import { getApiUrl, getAuthHeaders } from "@/lib/api-client";
import type { PaymentRequest, PaymentResponse, PaymentScenario } from "@/types/order";

export class PaymentError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
  }
}

async function parseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function processPayment(
  orderId: string,
  request: PaymentRequest,
  idempotencyKey: string,
): Promise<PaymentResponse> {
  const response = await fetch(getApiUrl(`/api/orders/${encodeURIComponent(orderId)}/payments`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      ...getAuthHeaders(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new PaymentError(
      await parseError(response, "No se pudo procesar el pago simulado."),
      response.status,
    );
  }

  return (await response.json()) as PaymentResponse;
}

export async function getOrderPayments(orderId: string): Promise<PaymentResponse[]> {
  const response = await fetch(getApiUrl(`/api/orders/${encodeURIComponent(orderId)}/payments`), {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new PaymentError("No se pudo recuperar el estado del pago.", response.status);
  }

  return (await response.json()) as PaymentResponse[];
}

export async function resolvePayment(
  orderId: string,
  transactionId: string,
  scenario: Extract<PaymentScenario, "APPROVED" | "REJECTED">,
  idempotencyKey: string,
): Promise<PaymentResponse> {
  const response = await fetch(getApiUrl(`/api/orders/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(transactionId)}/resolve`), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey, ...getAuthHeaders() },
    body: JSON.stringify({ scenario }),
  });
  if (!response.ok) throw new PaymentError(await parseError(response, "No se pudo resolver el pago."), response.status);
  return (await response.json()) as PaymentResponse;
}

export async function settleCash(orderId: string, idempotencyKey: string): Promise<PaymentResponse> {
  const response = await fetch(getApiUrl(`/api/orders/${encodeURIComponent(orderId)}/payments/cash-settlement`), {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey, ...getAuthHeaders() },
  });
  if (!response.ok) throw new PaymentError(await parseError(response, "No se pudo registrar el settlement contra entrega."), response.status);
  return (await response.json()) as PaymentResponse;
}
