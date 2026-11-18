/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const root = process.cwd();
const read = (file) => fs.readFileSync(`${root}/${file}`, "utf8");

const checkout = read("app/(store)/checkout/page.tsx");
assert.match(checkout, /\["YAPE", "PLIN", "CARD"\]/);
assert.doesNotMatch(checkout, /TRANSFERENCIA|EFECTIVO/);

const paymentCard = read("components/checkout/PaymentMethodCard.tsx");
assert.match(paymentCard, /YAPE: Smartphone/);
assert.match(paymentCard, /PLIN: Smartphone/);
assert.match(paymentCard, /CARD: CreditCard/);
assert.doesNotMatch(paymentCard, /TRANSFERENCIA|EFECTIVO/);

const combinedProducts = read("lib/use-combined-products.ts");
assert.doesNotMatch(combinedProducts, /newArrivals|moreProducts|persistedSkuByLocalId/);
assert.match(combinedProducts, /allProducts: apiProducts/);
assert.match(combinedProducts, /filter\(\(item\) => isPersistedProductId\(item\.id\)\)/);

const catalog = read("lib/catalog.ts");
assert.match(catalog, /id: product\.id/);
assert.match(catalog, /stock: product\.stock/);
assert.match(catalog, /price: product\.price/);

const productCard = read("components/store/ProductCard.tsx");
assert.match(productCard, /product\.stock > 0/);
assert.match(productCard, /Sin stock/);

const cartSource = ts.transpileModule(read("lib/cart.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const cartModule = { exports: {} };
vm.runInNewContext(cartSource, { module: cartModule, exports: cartModule.exports, window: {} });
const { findUnavailableCartItems } = cartModule.exports;
const products = [{ id: "persisted-id", stock: 1 }];
assert.deepEqual(
  findUnavailableCartItems([{ id: "persisted-id", cantidad: 1 }, { id: "missing", cantidad: 1 }], products).map((item) => item.id),
  ["missing"],
);
assert.deepEqual(
  findUnavailableCartItems([{ id: "persisted-id", cantidad: 2 }], products).map((item) => item.id),
  ["persisted-id"],
);

console.log("Checkout y catálogo persistido verificados.");
