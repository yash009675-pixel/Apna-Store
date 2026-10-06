const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const cartSource = fs.readFileSync(path.join(root, "cart.js"), "utf8");
const feedbackSource = fs.readFileSync(path.join(root, "bag-feedback.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "apnastore-bag-v1.css"), "utf8");
const cartHtml = fs.readFileSync(path.join(root, "cart.html"), "utf8");

/* The page bootstrap stays an explicit, single statement so tests can run the
 * module without starting the async load sequence. */
const bootstrap =
  'if (typeof document !== "undefined" && document.getElementById && document.getElementById("cart")) { boot(); }';
assert.ok(cartSource.includes(bootstrap), "test harness expects the bag bootstrap to remain explicit");
const testableCart = cartSource.replace(bootstrap, "");

const CONFIG_URL = "https://test-supabase.apna.test";
const BUCKET_PUBLIC = CONFIG_URL + "/storage/v1/object/public/product-images/";

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

function classList(owner) {
  const set = new Set();
  return {
    add(...values) { values.forEach((value) => set.add(value)); },
    remove(...values) { values.forEach((value) => set.delete(value)); },
    contains(value) { return set.has(value); },
    toggle(value, force) {
      const on = force === undefined ? !set.has(value) : Boolean(force);
      if (on) set.add(value); else set.delete(value);
      return on;
    },
    get size() { return set.size; },
    _owner: owner,
  };
}

function createNode(tag = "div", html = "") {
  const node = {
    tagName: String(tag).toUpperCase(),
    innerHTML: html,
    textContent: "",
    dataset: {},
    style: {},
    hidden: false,
    disabled: false,
    offsetWidth: 0,
    parentNode: null,
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) { child.parentNode = node; return child; },
    removeChild(child) { child.parentNode = null; return child; },
    remove() {},
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; },
  };
  node.classList = classList(node);
  return node;
}

/* Builds just enough of the rendered item list for the feedback paths
 * (quantity pulse, busy state) to find their nodes. */
function buildItemNodes(count) {
  const nodes = [];
  for (let index = 0; index < count; index++) {
    const node = createNode("article");
    node.dataset.index = String(index);
    const qtyValue = createNode("span");
    node.querySelector = (selector) => (selector === ".bag-qty-value" ? qtyValue : null);
    nodes.push(node);
  }
  return nodes;
}

function createBox() {
  const box = createNode("div");
  let html = "";
  Object.defineProperty(box, "innerHTML", {
    get() { return html; },
    set(value) {
      html = String(value);
      const matches = html.match(/data-index="/g);
      box.__items = buildItemNodes(matches ? matches.length : 0);
    },
  });
  box.__items = [];
  box.querySelectorAll = (selector) => (selector === ".bag-item" ? box.__items : []);
  return box;
}

function createSupabase(state) {
  const calls = [];

  function rowsFor(table) {
    if (table === "products") return state.products;
    if (table === "product_variants") return state.variants;
    if (table === "product_images") return state.images;
    return [];
  }

  function filter(rows, query) {
    let out = rows;
    if (query._in) {
      const values = query._in.values.map(String);
      out = out.filter((row) => values.includes(String(row[query._in.column])));
    }
    if (query._eq) {
      out = out.filter((row) => query._eq.every(([column, value]) => String(row[column]) === String(value)));
    }
    return out;
  }

  function makeQuery(table) {
    const query = {
      _table: table,
      _in: null,
      _eq: [],
      select() { return query; },
      in(column, values) { query._in = { column, values }; return query; },
      eq(column, value) { query._eq.push([column, value]); return query; },
      order() { return query; },
      limit() { return query; },
      maybeSingle() {
        calls.push({ table, single: true, query });
        const rows = filter(rowsFor(table), query);
        return Promise.resolve({ data: rows[0] || null, error: null });
      },
      then(onFulfilled, onRejected) {
        calls.push({ table, single: false, query });
        return Promise.resolve({ data: filter(rowsFor(table), query), error: null }).then(onFulfilled, onRejected);
      },
    };
    return query;
  }

  return {
    calls,
    from(table) { return makeQuery(table); },
    rpc(name, args) {
      calls.push({ rpc: name, args });
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      getSession() { return Promise.resolve({ data: { session: state.session } }); },
    },
    storage: {
      from(bucket) {
        return {
          getPublicUrl(storagePath) {
            if (state.publicUrlOverride) return { data: { publicUrl: state.publicUrlOverride(storagePath) } };
            return { data: { publicUrl: CONFIG_URL + "/storage/v1/object/public/" + bucket + "/" + storagePath } };
          },
        };
      },
    },
  };
}

function createHarness(options = {}) {
  const state = {
    products: options.products || [],
    variants: options.variants || [],
    images: options.images || [],
    session: options.session || null,
    publicUrlOverride: options.publicUrlOverride || null,
  };

  const box = createBox();
  const status = createNode("p");
  const alerts = [];
  const navigation = { href: "" };
  const supabase = createSupabase(state);

  const storage = new Map();
  const createStorage = () => ({
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
    removeItem: (key) => { storage.delete(key); },
  });
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  if (options.cart) localStorage.setItem("apnaCart", JSON.stringify(options.cart));

  const reduced = Boolean(options.reducedMotion);
  const document = {
    getElementById(id) {
      if (id === "cart") return box;
      if (id === "bagStatus") return status;
      return null;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => createNode(tag),
  };

  const window = {
    APNA_SUPABASE_CONFIG: { url: CONFIG_URL, anonKey: "test-anon-key" },
    matchMedia: (query) => ({ matches: reduced && /prefers-reduced-motion/.test(query) }),
    addEventListener() {},
  };

  const context = vm.createContext({
    window,
    document,
    localStorage,
    sessionStorage,
    apnaSupabase: options.supabase === null ? undefined : supabase,
    location: navigation,
    alert: (message) => alerts.push(String(message)),
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Math,
  });

  vm.runInContext(testableCart, context, { filename: "cart.js" });

  return {
    context,
    state,
    box,
    status,
    alerts,
    navigation,
    supabase,
    localStorage,
    sessionStorage,
    api: window.apnaBag,
    evaluate(expression) { return vm.runInContext(expression, context); },
    cart() { return JSON.parse(localStorage.getItem("apnaCart") || "[]"); },
    setCart(cart) { localStorage.setItem("apnaCart", JSON.stringify(cart)); },
  };
}

const ITEM = {
  key: "product-1|variant-1|M|Black",
  productId: "product-1",
  variantId: "variant-1",
  name: "Oversized Graphic T-Shirt",
  category: "Men",
  price: 799,
  size: "M",
  color: "Black",
  qty: 2,
};

const PRODUCTS = [{ id: "product-1", name: "Oversized Graphic T-Shirt", price: 799, category_id: "cat-1", status: "active" }];
const VARIANTS = [{ id: "variant-1", product_id: "product-1", size: "M", color: "Black", stock: 5 }];

function imageRow(storagePath = "products/product-1/front.webp") {
  return { product_id: "product-1", variant_id: null, storage_path: storagePath, is_primary: true, sort_order: 0 };
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

test("empty bag renders the premium empty state with a route back to shopping", async () => {
  const harness = createHarness({ cart: [] });
  await harness.api.draw();

  assert.match(harness.box.innerHTML, /class="empty-cart bag-empty"/);
  assert.match(harness.box.innerHTML, /Your bag is empty/);
  assert.match(harness.box.innerHTML, /href="shop\.html"/);
  assert.doesNotMatch(harness.box.innerHTML, /cart-layout/);
  assert.match(harness.box.innerHTML, /bag-status/);
});

test("bag items render the real Supabase product image when one exists", async () => {
  const harness = createHarness({
    cart: [ITEM],
    products: PRODUCTS,
    variants: VARIANTS,
    images: [imageRow()],
  });
  await harness.api.draw();

  const expected = BUCKET_PUBLIC + "products/product-1/front.webp";
  assert.match(harness.box.innerHTML, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(harness.box.innerHTML, /<img class="cart-item-image"/);
  assert.doesNotMatch(harness.box.innerHTML, /cart-item-monogram/);
});

test("variant-specific product images win over the product-level image", async () => {
  const harness = createHarness({
    cart: [ITEM],
    images: [
      { product_id: "product-1", variant_id: null, storage_path: "products/product-1/front.webp", is_primary: true, sort_order: 0 },
      { product_id: "product-1", variant_id: "variant-1", storage_path: "products/product-1/black.webp", is_primary: false, sort_order: 1 },
    ],
  });
  await harness.api.draw();

  assert.match(harness.box.innerHTML, /products\/product-1\/black\.webp/);
  assert.doesNotMatch(harness.box.innerHTML, /cart-item-image" src="[^"]*front\.webp/);
});

test("image URLs outside the product-images bucket are never rendered", async () => {
  const harness = createHarness({
    cart: [ITEM],
    images: [imageRow()],
    publicUrlOverride: () => "https://images.unsplash.com/photo-123?w=900",
  });
  await harness.api.draw();

  assert.doesNotMatch(harness.box.innerHTML, /unsplash/);
  assert.match(harness.box.innerHTML, /cart-item-monogram/);

  const api = harness.api;
  assert.equal(api.isProductImageUrl(BUCKET_PUBLIC + "a.webp"), true);
  assert.equal(api.isProductImageUrl("https://images.unsplash.com/a.webp"), false);
  assert.equal(api.isProductImageUrl("https://other.supabase.co/storage/v1/object/public/product-images/a.webp"), false);
  assert.equal(api.isProductImageUrl("/storage/v1/object/public/product-images/a.webp"), false);
  assert.equal(api.isProductImageUrl(""), false);
});

test("missing images and image-lookup failures degrade to the monogram", async () => {
  const withoutImages = createHarness({ cart: [ITEM], images: [] });
  await withoutImages.api.draw();
  assert.match(withoutImages.box.innerHTML, /cart-item-monogram/);
  assert.match(withoutImages.box.innerHTML, /OG/);

  const withoutSupabase = createHarness({ cart: [ITEM], supabase: null });
  await withoutSupabase.api.draw();
  assert.match(withoutSupabase.box.innerHTML, /cart-item-monogram/);
  assert.match(withoutSupabase.box.innerHTML, /cart-item-price/);
});

test("delivery stays ₹49 below ₹999 and free at or above ₹999", () => {
  const harness = createHarness();
  const { calculateTotals } = harness.api;

  const below = calculateTotals([{ price: 499, qty: 2 }]);
  assert.equal(below.subtotal, 998);
  assert.equal(below.delivery, 49);
  assert.equal(below.total, 1047);
  assert.equal(below.freeDeliveryGap, 1);

  const atThreshold = calculateTotals([{ price: 999, qty: 1 }]);
  assert.equal(atThreshold.subtotal, 999);
  assert.equal(atThreshold.delivery, 0);
  assert.equal(atThreshold.total, 999);

  const above = calculateTotals([{ price: 1200, qty: 1 }]);
  assert.equal(above.subtotal, 1200);
  assert.equal(above.delivery, 0);
  assert.equal(above.total, 1200);
});

test("summary shows the delivery charge, free-delivery gap and total", async () => {
  const harness = createHarness({ cart: [{ ...ITEM, price: 400, qty: 1 }] });
  await harness.api.draw();

  assert.match(harness.box.innerHTML, /Subtotal \(1 item\)/);
  assert.match(harness.box.innerHTML, /₹49/);
  assert.match(harness.box.innerHTML, /Add ₹599 more for free delivery\./);
  assert.match(harness.box.innerHTML, /bag-progress-bar/);
  assert.match(harness.box.innerHTML, /Proceed to checkout/);
  assert.match(harness.box.innerHTML, /class="total bag-total"/);
});

test("quantity controls are accessible and wired to data actions", async () => {
  const harness = createHarness({ cart: [ITEM] });
  await harness.api.draw();

  assert.match(harness.box.innerHTML, /data-action="decrease"/);
  assert.match(harness.box.innerHTML, /data-action="increase"/);
  assert.match(harness.box.innerHTML, /data-action="remove"/);
  assert.match(harness.box.innerHTML, /aria-label="Increase quantity of Oversized Graphic T-Shirt"/);
  assert.match(harness.box.innerHTML, /aria-label="Decrease quantity of Oversized Graphic T-Shirt"/);
  assert.match(harness.box.innerHTML, /role="group" aria-label="Quantity for Oversized Graphic T-Shirt"/);
  assert.match(harness.box.innerHTML, /role="status" aria-live="polite"/);
});

test("increasing quantity stops at live stock and leaves the cart untouched", async () => {
  const harness = createHarness({
    cart: [{ ...ITEM, qty: 2 }],
    variants: [{ ...VARIANTS[0], stock: 2 }],
  });

  await harness.api.changeCartQty(0, 1);

  assert.equal(harness.alerts.length, 1);
  assert.match(harness.alerts[0], /Only 2 item\(s\) are available/);
  assert.equal(harness.cart()[0].qty, 2);
});

test("stock verification failure warns instead of changing the cart", async () => {
  const harness = createHarness({
    cart: [ITEM],
    variants: [],
  });

  await harness.api.changeCartQty(0, 1);

  assert.equal(harness.alerts.length, 1);
  assert.match(harness.alerts[0], /couldn't verify this item's stock/);
  assert.equal(harness.cart()[0].qty, 2);
});

test("quantity decrease and increase update stored quantity and the badge copy", async () => {
  const harness = createHarness({ cart: [{ ...ITEM, qty: 3 }], products: PRODUCTS, variants: VARIANTS });

  await harness.api.changeCartQty(0, -1);
  assert.equal(harness.cart()[0].qty, 2);
  assert.match(harness.box.innerHTML, /bag-qty-value">2</);

  await harness.api.changeCartQty(0, 1);
  assert.equal(harness.cart()[0].qty, 3);
  assert.equal(harness.status.textContent, "Oversized Graphic T-Shirt quantity updated to 3.");
});

test("decreasing the last unit removes the item from the bag", async () => {
  const harness = createHarness({ cart: [{ ...ITEM, qty: 1 }], variants: VARIANTS });
  await harness.api.changeCartQty(0, -1);

  assert.deepEqual(harness.cart(), []);
  assert.match(harness.box.innerHTML, /bag-empty/);
});

test("removing an item drops it from storage and announces the change", async () => {
  const harness = createHarness({ cart: [ITEM, { ...ITEM, key: "product-1|variant-2|L|White", variantId: "variant-2", size: "L", color: "White" }] });
  await harness.api.removeCartItem(0);

  assert.equal(harness.cart().length, 1);
  assert.equal(harness.cart()[0].variantId, "variant-2");
  assert.equal(harness.status.textContent, "Oversized Graphic T-Shirt removed from your bag.");
});

test("catalog sync drops inactive or out-of-stock lines and clamps quantity to stock", async () => {
  const harness = createHarness({
    cart: [
      { ...ITEM, qty: 9 },
      { ...ITEM, key: "product-2|variant-9|M", productId: "product-2", variantId: "variant-9", name: "Basic Hoodie" },
      { ...ITEM, key: "product-3|variant-3|M", productId: "product-3", variantId: "variant-3", name: "Wide Leg Jeans" },
    ],
    products: [
      { id: "product-1", name: "Oversized Graphic T-Shirt", price: 799, status: "active" },
      { id: "product-2", name: "Basic Hoodie", price: 1299, status: "draft" },
      { id: "product-3", name: "Wide Leg Jeans", price: 1499, status: "active" },
    ],
    variants: [
      { id: "variant-1", product_id: "product-1", size: "M", color: "Black", stock: 4 },
      { id: "variant-3", product_id: "product-3", size: "M", color: "Blue", stock: 0 },
    ],
  });

  await harness.api.syncCartWithCatalog();

  const cart = harness.cart();
  assert.equal(cart.length, 1);
  assert.equal(cart[0].productId, "product-1");
  assert.equal(cart[0].qty, 4, "quantity is clamped to available stock");
});

test("abandoned-cart tracking still runs only for signed-in shoppers", async () => {
  const guest = createHarness({ cart: [ITEM], session: null });
  await guest.api.trackAbandonedCart();
  assert.deepEqual(guest.supabase.calls.filter((call) => call.rpc), []);

  const shopper = createHarness({ cart: [ITEM], session: { user: { id: "user-1" } } });
  await shopper.api.trackAbandonedCart();
  const rpcs = shopper.supabase.calls.filter((call) => call.rpc).map((call) => call.rpc);
  assert.deepEqual(rpcs, ["track_abandoned_cart", "record_abandoned_cart_event"]);
});

test("checkout keeps navigating to checkout.html with and without motion", async () => {
  const reduced = createHarness({ cart: [ITEM], reducedMotion: true });
  const reducedTrigger = createNode("a");
  reduced.api.startCheckout({ preventDefault() {} }, reducedTrigger);
  assert.equal(reduced.navigation.href, "checkout.html");

  const animated = createHarness({ cart: [ITEM] });
  const animatedTrigger = createNode("a");
  animated.api.startCheckout({ preventDefault() {} }, animatedTrigger);
  assert.equal(animated.navigation.href, "", "navigation waits for the feedback pulse");
  assert.equal(animatedTrigger.classList.contains("is-checkout"), true);

  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.equal(animated.navigation.href, "checkout.html");
});

test("prefers-reduced-motion removes staggered entrance animations", async () => {
  const reduced = createHarness({ cart: [ITEM, { ...ITEM, key: "b", variantId: "variant-2" }], reducedMotion: true });
  await reduced.api.draw();
  assert.doesNotMatch(reduced.box.innerHTML, /bag-item-enter/);
  assert.doesNotMatch(reduced.box.innerHTML, /animation-delay/);

  const animated = createHarness({ cart: [ITEM, { ...ITEM, key: "b", variantId: "variant-2" }] });
  await animated.api.draw();
  assert.match(animated.box.innerHTML, /bag-item-enter/);
  assert.match(animated.box.innerHTML, /animation-delay:45ms/);
});

test("duplicate cart lines are merged instead of duplicated", () => {
  const harness = createHarness();
  const merged = harness.api.normalizeCart([
    { key: "a", name: "Tee", qty: 2, price: 10 },
    { key: "a", name: "Tee", qty: 3, price: 10 },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].qty, 5);
});

test("bag feedback flies only product-images bucket URLs and respects reduced motion", () => {
  const run = (options) => {
    const context = vm.createContext({
      window: {
        APNA_SUPABASE_CONFIG: { url: CONFIG_URL },
        matchMedia: (query) => ({ matches: Boolean(options.reducedMotion) && /prefers-reduced-motion/.test(query) }),
      },
      document: {
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: (tag) => createNode(tag),
      },
      localStorage: { getItem: () => JSON.stringify([{ qty: 2 }]) },
      console,
      setTimeout,
    });
    vm.runInContext(feedbackSource, context, { filename: "bag-feedback.js" });
    const feedback = context.window.apnaBagFeedback;
    return {
      delay: feedback(options),
      isProductImageUrl: context.window.apnaBagFeedbackApi.isProductImageUrl,
    };
  };

  assert.equal(run({ imageUrl: BUCKET_PUBLIC + "a.webp" }).delay, 0, "no bag target in the harness, so no flight");
  assert.equal(run({ imageUrl: "https://images.unsplash.com/a.webp" }).delay, 0);
  assert.equal(run({ imageUrl: BUCKET_PUBLIC + "a.webp", reducedMotion: true }).delay, 0);
  assert.equal(run({}).isProductImageUrl(BUCKET_PUBLIC + "a.webp"), true);
  assert.equal(run({}).isProductImageUrl("https://cdn.example.com/a.webp"), false);
});

test("Phase 6 introduces no seller functionality and keeps the commerce contract", () => {
  for (const [name, source] of [
    ["cart.js", cartSource],
    ["bag-feedback.js", feedbackSource],
    ["apnastore-bag-v1.css", cssSource],
    ["cart.html", cartHtml],
  ]) {
    assert.doesNotMatch(source, /seller/i, `${name} must not introduce seller functionality`);
  }

  assert.match(cartSource, /apnaCart/, "cart storage key is unchanged");
  assert.match(cartSource, /track_abandoned_cart/, "abandoned-cart tracking is preserved");
  assert.match(cartSource, /record_abandoned_cart_event/, "abandoned-cart events are preserved");
  assert.match(cartSource, /FREE_DELIVERY_THRESHOLD = 999/, "free-delivery threshold is unchanged");
  assert.match(cartSource, /DELIVERY_FEE = 49/, "delivery fee is unchanged");
  assert.match(cartSource, /checkout\.html/, "checkout destination is unchanged");
  assert.match(cartSource, /product_variants/, "live variant stock checks are preserved");
  assert.doesNotMatch(cartSource, /cart_badge|fake|dummy|placeholderPrice/i, "no fake data");
  assert.doesNotMatch(cartSource, /three|webgl/i, "no WebGL/Three.js");
});

test("bag page loads the premium layer and the shared motion system", () => {
  assert.match(cartHtml, /apnastore-bag-v1\.css/);
  assert.match(cartHtml, /apnastore-motion-v1\.css/);
  assert.match(cartHtml, /<div id="cart"><\/div>/);
  const bagIndex = cartHtml.indexOf("apnastore-bag-v1.css");
  assert.ok(bagIndex > cartHtml.indexOf("styles.css"), "bag layer loads after styles.css");
  assert.ok(bagIndex > cartHtml.indexOf("apnastore-motion-v1.css"), "bag layer loads after the motion system");
});

test("bag stylesheet is balanced and honours reduced motion", () => {
  const opens = (cssSource.match(/{/g) || []).length;
  const closes = (cssSource.match(/}/g) || []).length;
  assert.equal(opens, closes, "CSS braces are balanced");
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /--apna-motion-ease/, "reuses the shared motion tokens");
  assert.match(cssSource, /@media \(max-width: 520px\)/);
  assert.match(cssSource, /@media \(max-width: 800px\)/);
});

test("product page add-to-bag waits for feedback only after the cart is saved", () => {
  const productSource = fs.readFileSync(path.join(root, "product.js"), "utf8");
  assert.match(productSource, /localStorage\.setItem\("apnaCart",\s*JSON\.stringify\(cart\)\);\s*const feedbackDelay=window\.apnaBagFeedback\?window\.apnaBagFeedback/);
  assert.match(productSource, /if\(!feedbackDelay\)\{location\.href="cart\.html";return\}\s*setTimeout/);
  assert.match(productSource, /Only "\+stock\+" item\(s\) are available for this variant\./, "stock limit messaging preserved");
  assert.match(productSource, /location\.href="cart\.html"/, "add-to-bag still routes to the bag page");
  assert.match(productSource, /specific\.length\?specific:general\.length\?general:images\|\|\[\]/, "existing gallery behaviour preserved");
});
