// lib/use-combined-products.ts
"use client";

import { useEffect, useState } from "react";
import { newArrivals, moreProducts, Product } from "@/data/products";
import { apiProductToEcommerce } from "@/lib/catalog";
import { productService } from "@/services/product.service";

const localProducts = [...newArrivals, ...moreProducts];
const persistedSkuByLocalId: Record<string, string> = {
  "1": "GXK20",
  "2": "LOGITECH-G",
  "3": "NEXORA-ORIGINAL-03",
  "4": "NEXORA-ORIGINAL-04",
  "5": "NEXORA-ORIGINAL-05",
  "6": "NEXORA-ORIGINAL-06",
  "7": "NEXORA-ORIGINAL-07",
  "8": "NEXORA-ORIGINAL-08",
  "9": "NEXORA-ORIGINAL-09",
  "10": "NEXORA-ORIGINAL-10",
  "11": "NEXORA-ORIGINAL-11",
  "12": "NEXORA-ORIGINAL-12",
  "13": "NEXORA-ORIGINAL-13",
  "14": "NEXORA-ORIGINAL-14",
  "15": "NEXORA-ORIGINAL-15",
  "16": "NEXORA-ORIGINAL-16",
};

/**
 * Combina el catálogo de la API (productos creados desde el panel admin,
 * persistidos en PostgreSQL) con los productos de demostración hardcodeados.
 */
export function useCombinedProducts() {
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    productService
      .list()
      .then((items) => {
        if (!cancelled) {
          setApiProducts(
            items.map((item) => {
              const apiProduct = apiProductToEcommerce(item);
              const original = localProducts.find(
                (localProduct) =>
                  persistedSkuByLocalId[localProduct.id] === item.sku,
              );

              if (!original) return apiProduct;

              // El API es la autoridad para identidad, precio y stock. Los
              // campos de detalle locales completan información no persistida.
              return {
                ...original,
                id: apiProduct.id,
                sku: apiProduct.sku,
                slug: apiProduct.slug,
                name: apiProduct.name,
                category: apiProduct.category,
                price: apiProduct.price,
                stock: apiProduct.stock,
                image: item.imageUrl ? apiProduct.image : original.image,
                imageHover: item.imageHoverUrl
                  ? apiProduct.imageHover
                  : original.imageHover,
                images: original.images,
              };
            }),
          );
        }
      })
      .catch((error) => {
        // La tienda sigue funcionando con el catálogo de demostración.
        console.warn("No se pudo cargar el catálogo desde la API:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // PostgreSQL tiene prioridad para los productos que ya fueron sincronizados;
  // los demás productos originales siguen visibles desde la fuente local.
  const allProducts = [
    ...apiProducts,
    ...localProducts.filter(
      (localProduct) =>
        !apiProducts.some(
          (apiProduct) => apiProduct.sku === persistedSkuByLocalId[localProduct.id],
        ),
    ),
  ];

  return {
    allProducts,
    adminProducts: apiProducts,
    isLoaded,
  };
}
