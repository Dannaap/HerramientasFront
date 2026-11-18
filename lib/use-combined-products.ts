// lib/use-combined-products.ts
"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/data/products";
import { apiProductToEcommerce, isPersistedProductId } from "@/lib/catalog";
import { productService } from "@/services/product.service";

/** Catálogo de tienda respaldado exclusivamente por productos persistidos. */
export function useCombinedProducts() {
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    productService
      .list()
      .then((items) => {
        if (!cancelled) {
          setError(null);
          setApiProducts(
            items
              .filter((item) => isPersistedProductId(item.id))
              .map(apiProductToEcommerce),
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setApiProducts([]);
          setError(error instanceof Error ? error : new Error("No se pudo cargar el catálogo."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    allProducts: apiProducts,
    adminProducts: apiProducts,
    isLoaded,
    error,
  };
}
