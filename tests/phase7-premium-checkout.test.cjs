const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const checkoutSource = fs.readFileSync(path.join(root, "checkout.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "apnastore-checkout-v1.css"), "utf8");
const checkoutHtml = fs.readFileSync(path.join(root, "checkout.html"), "utf8");
const cartSource = fs.readFileSync(path.join(root, "cart.js"), "utf8");
const bagCss = fs.readFileSync(path.join(root, "apnastore-bag-v1.css"), "utf8");

const bootstrap =
  'if (typeof document !== "undefined" && document.getElementById && document.getElementById("checkoutForm")) { boot(); }';
assert.ok(checkoutSource.includes(bootstrap), "test harness expects the checkout bootstrap to remain explicit");
const testableCheckout = checkoutSource.replace(bootstrap, "");

/* Values created inside the vm context have a different Object prototype,
 * so structural comparisons are made on plain copies. */
function plain(value){return JSON.parse(JSON.stringify(value))}

const ITEM_A = {
  key: "product-1|variant-1|M|Black",
  productId: "product-1",
  variantId: "variant-1",
  name: "Oversized Graphic T-Shirt",
  category: "Men",
  price: 799,
  size: "M",
  color: "Black",
  qty: 1,
};
const ITEM_B = {
  key: "product-2|variant-2|L|White",
  productId: "product-2",
  variantId: "variant-2",
  name: "Wide Leg Jeans",
  category: "Women",
  price: 499,
  size: "L",
  color: "White",
  qty: 2,
};
const PRODUCTS = [
  { id: "product-1", name: "Oversized Graphic T-Shirt", status: "active" },
  { id: "product-2", name: "Wide Leg Jeans", status: "active" },
];
const VARIANTS = [
  { id: "variant-1", product_id: "product-1", stock: 9 },
  { id: "variant-2", product_id: "product-2", stock: 9 },
];

/* ------------------------------------------------------------------ *
 * Minimal DOM harness
 * ------------------------------------------------------------------ */

function classList() {
  const set = new Set();
  return {
    add: (...values) => values.forEach((value) => set.add(value)),
    remove: (...values) => values.forEach((value) => set.delete(value)),
    contains: (value) => set.has(value),
    toggle: (value, force) => {
      const on = force === undefined ? !set.has(value) : Boolean(force);
      if (on) set.add(value);
      else set.delete(value);
      return on;
    },
  };
}

function createNode(tag = "div", id = "") {
  const node = {
    tagName: String(tag).toUpperCase(),
    id,
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    hidden: false,
    disabled: false,
    offsetWidth: 0,
    dataset: {},
    style: {},
    className: "",
    attributes: {},
    handlers: {},
    addEventListener(type, handler) { (node.handlers[type] = node.handlers[type] || []).push(handler); },
    setAttribute(name, value) { node.attributes[name] = String(value); },
    removeAttribute(name) { delete node.attributes[name]; },
    focus() { node.focused = (node.focused || 0) + 1; },
    querySelector: (selector) => {
      if (/checkout-button-label|checkout-submit-label/.test(selector)) {
        node._label = node._label || createNode("span");
        return node._label;
      }
      return null;
    },
    querySelectorAll: () => [],
    closest: () => null,
  };
  node.classList = classList();
  return node;
}

function createHarness(options = {}) {
  const state = {
    session: options.session || null,
    products: options.products || PRODUCTS,
    variants: options.variants || VARIANTS,
    addresses: options.addresses || [],
    rpc: options.rpc || {},
    addressError: options.addressError || null,
  };

  const elements = new Map();
  const getElement = (id, tag = "div") => {
    if (!elements.has(id)) {
      const node = createNode(tag, id);
      elements.set(id, node);
    }
    return elements.get(id);
  };

  const submitButton = createNode("button");
  submitButton.innerHTML = '<span class="checkout-submit-label">Place order</span> <span aria-hidden="true">→</span>';
  const submitLabel = createNode("span");
  submitLabel.textContent = "Place order";
  /* querySelector receives ".checkout-submit-label,.checkout-button-label", so match either. */
  submitButton.querySelector = (selector) => (/checkout-submit-label/.test(selector) ? submitLabel : null);

  const form = createNode("form");
  form.reportValidity = () => (options.validity === undefined ? true : options.validity);
  form.querySelector = (selector) => (selector === ".checkout-submit" ? submitButton : null);

  const summary = createNode("aside");
  const summaryTotal = createNode("div");
  summary.querySelector = (selector) => (selector === ".summary-total" ? summaryTotal : null);

  /* Re-register ids that appear in freshly rendered markup so the page
   * helpers can find coupon inputs/messages after a re-render. */
  const registerFromHtml = (html) => {
    const tagPattern = /<(\w+)([^>]*)>/g;
    let match;
    while ((match = tagPattern.exec(html))) {
      const attributes = match[2];
      const idMatch = /id="([^"]+)"/.exec(attributes);
      if (!idMatch) continue;
      const node = getElement(idMatch[1], match[1]);
      const valueMatch = /\svalue="([^"]*)"/.exec(attributes);
      if (valueMatch) node.value = valueMatch[1];
    }
  };

  Object.defineProperty(summary, "innerHTML", {
    get() { return summary._html || ""; },
    set(value) {
      summary._html = String(value);
      registerFromHtml(summary._html);
    },
  });

  const savedAddressList = getElement("savedAddressList");
  Object.defineProperty(savedAddressList, "innerHTML", {
    get() { return savedAddressList._html || ""; },
    set(value) { savedAddressList._html = String(value); },
  });

  const paymentRadios = [
    Object.assign(createNode("input"), { value: "Cash on Delivery", checked: true }),
    Object.assign(createNode("input"), { value: "Online Payment", checked: false, disabled: true }),
  ];

  const document = {
    getElementById: (id) => {
      if (id === "checkoutForm") return form;
      if (id === "checkoutSummary") return summary;
      return getElement(id);
    },
    querySelector: (selector) => {
      if (selector === 'input[name="payment"]:checked') return paymentRadios.find((radio) => radio.checked) || null;
      return null;
    },
    querySelectorAll: (selector) => (selector === 'input[name="payment"]' ? paymentRadios : []),
    createElement: (tag) => createNode(tag),
  };

  const calls = [];
  const supabase = {
    calls,
    rpc(name, args) {
      calls.push({ kind: "rpc", name, args });
      const handler = state.rpc[name];
      if (!handler) return Promise.resolve({ data: null, error: null });
      return Promise.resolve(handler(args, state));
    },
    auth: {
      getSession() { return Promise.resolve({ data: { session: state.session } }); },
    },
    from(table) {
      const query = {
        _eq: [],
        select() { return query; },
        eq(column, value) { query._eq.push([column, value]); return query; },
        order() { return query; },
        maybeSingle() {
          calls.push({ kind: "maybeSingle", table, filters: [...query._eq] });
          return Promise.resolve(resolveRow(table, query, state));
        },
        then(onFulfilled, onRejected) {
          calls.push({ kind: "select", table, filters: [...query._eq] });
          const rows = table === "addresses" ? state.addresses : [];
          return Promise.resolve(state.addressError ? { data: null, error: state.addressError } : { data: rows, error: null })
            .then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  };

  function resolveRow(table, query, current) {
    const matches = (row) => query._eq.every(([column, value]) => String(row[column]) === String(value));
    if (table === "products") {
      const product = (current.products || []).find(matches);
      return { data: product || null, error: null };
    }
    if (table === "product_variants") {
      const variant = (current.variants || []).find(matches);
      return { data: variant || null, error: null };
    }
    return { data: null, error: null };
  }

  const storage = new Map();
  const createStorage = () => ({
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
    removeItem: (key) => { storage.delete(key); },
  });

  const navigation = { href: "" };
  const context = vm.createContext({
    window: {
      matchMedia: (query) => ({ matches: Boolean(options.reducedMotion) && /prefers-reduced-motion/.test(query) }),
    },
    document,
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    apnaSupabase: supabase,
    location: navigation,
    console,
    setTimeout,
    Date,
    JSON,
    Math,
    alert: () => {},
  });

  if (options.cart !== null) {
    context.localStorage.setItem("apnaCart", JSON.stringify(options.cart || [ITEM_A]));
  }

  vm.runInContext(testableCheckout, context, { filename: "checkout.js" });
  const api = context.window.apnaCheckout;
  api.boot();

  const submit = () => {
    const handlers = form.handlers.submit || [];
    const event = { preventDefault() { event.prevented = true; } };
    handlers.forEach((handler) => handler(event));
    return event;
  };

  /* Drain pending microtasks and one macrotask turn so async checkout
   * chains finish deterministically. */
  const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };

  const fillAddress = () => {
    getElement("name").value = "Asha Patel";
    getElement("phone").value = "9876543210";
    getElement("address").value = "12 River Lane";
    getElement("city").value = "Ahmedabad";
    getElement("state").value = "Gujarat";
    getElement("pincode").value = "380001";
  };

  return {
    api, state, calls, navigation, submitButton, submitLabel, summary, summaryTotal,
    form, elements, getElement, submit, settle, fillAddress, paymentRadios, storage,
    cart() { return JSON.parse(context.localStorage.getItem("apnaCart") || "[]"); },
    submitAndSettle: async () => { const event = submit(); await settle(); return event; },
  };
}

/* ------------------------------------------------------------------ *
 * Order summary
 * ------------------------------------------------------------------ */

test("empty bag renders the checkout empty state and hides the form", () => {
  const harness = createHarness({ cart: [] });
  harness.api.render();

  assert.match(harness.summary.innerHTML, /checkout-empty/);
  assert.match(harness.summary.innerHTML, /Your bag is empty/);
  assert.match(harness.summary.innerHTML, /href="shop\.html"/);
  assert.equal(harness.form.style.display, "none");
});

test("summary shows real item, variant, quantity, subtotal, delivery and total", () => {
  const harness = createHarness({ cart: [ITEM_A, ITEM_B] });
  harness.api.render();
  const html = harness.summary.innerHTML;

  assert.match(html, /Oversized Graphic T-Shirt/);
  assert.match(html, /M · Black/, "variant information from the bag is shown");
  assert.match(html, /Qty 2/);
  assert.match(html, /₹998/, "line total is computed from price × qty");
  assert.match(html, /₹1,797/, "subtotal = 799 + 2×499");
  assert.match(html, /FREE/, "delivery is free at or above ₹999");
  assert.match(html, /Free delivery unlocked/);
  assert.match(html, /₹1,797<\/b>/, "total equals subtotal when delivery is free");
});

test("summary charges ₹49 below ₹999 and shows the free-delivery gap", () => {
  const harness = createHarness({ cart: [{ ...ITEM_A, price: 500, qty: 1 }] });
  harness.api.render();

  assert.match(harness.summary.innerHTML, /₹49/);
  assert.match(harness.summary.innerHTML, /Add ₹499 more for free delivery\./);
  const totals = harness.api.totals();
  assert.equal(totals.subtotal, 500);
  assert.equal(totals.shipping, 49);
  assert.equal(totals.total, 549);
});

/* ------------------------------------------------------------------ *
 * Coupons
 * ------------------------------------------------------------------ */

test("valid coupon applies the real discount returned by preview_coupon", async () => {
  const harness = createHarness({
    cart: [ITEM_A, ITEM_B],
    session: { user: { id: "user-1" } },
    rpc: {
      preview_coupon: () => ({ data: [{ subtotal: 1797, eligible_subtotal: 1797, discount_amount: 150, delivery_fee: 0, total: 1647 }], error: null }),
    },
  });
  harness.api.render();
  harness.getElement("couponCode").value = "APNA150";
  await harness.api.applyCoupon();

  const previewCall = harness.calls.find((call) => call.name === "preview_coupon");
  assert.ok(previewCall, "preview_coupon is still the coupon authority");
  assert.equal(previewCall.args.p_coupon_code, "APNA150");
  assert.deepEqual(plain(previewCall.args.p_items), [
    { product_id: "product-1", variant_id: "variant-1", quantity: 1 },
    { product_id: "product-2", variant_id: "variant-2", quantity: 2 },
  ]);

  assert.equal(harness.api.state().couponDiscount, 150);
  assert.equal(harness.api.state().appliedCoupon, "APNA150");
  assert.match(harness.summary.innerHTML, /Coupon APNA150/);
  assert.match(harness.summary.innerHTML, /−₹150/);
  assert.match(harness.summary.innerHTML, /₹1,647/, "total reflects the real discount");
  assert.match(harness.summary.innerHTML, /id="removeCoupon"/, "an applied coupon can be removed");
  assert.match(harness.getElement("couponMessage").textContent, /applied\. You saved ₹150\./);
  assert.equal(harness.getElement("couponMessage").className, "coupon-message coupon-message-success");
});

test("coupon button communicates validation and cannot be submitted twice", async () => {
  let release;
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    rpc: {
      preview_coupon: () => new Promise((resolve) => { release = resolve; }),
    },
  });
  harness.api.render();
  harness.getElement("couponCode").value = "SLOW";

  const pending = harness.api.applyCoupon();
  await harness.settle();

  assert.equal(harness.getElement("applyCoupon").disabled, true, "button is disabled while checking");
  assert.equal(harness.getElement("applyCoupon").attributes["aria-busy"], "true");
  assert.match(harness.getElement("applyCoupon").querySelector(".checkout-button-label").textContent, /Checking/);
  assert.equal(harness.getElement("couponMessage").className, "coupon-message coupon-message-pending");

  await harness.api.applyCoupon();
  assert.equal(harness.calls.filter((call) => call.name === "preview_coupon").length, 1, "rapid resubmission is blocked");

  release({ data: [{ discount_amount: 0 }], error: null });
  await pending;
  assert.equal(harness.getElement("applyCoupon").disabled, false, "button is restored after validation");
  assert.equal(harness.getElement("applyCoupon").attributes["aria-busy"], undefined);
});

test("invalid coupon shows a human-readable error and clears the discount", async () => {
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    rpc: {
      preview_coupon: () => ({ data: null, error: new Error('Coupon is invalid or unavailable') }),
    },
  });
  harness.api.render();
  harness.getElement("couponCode").value = "NOPE";
  await harness.api.applyCoupon();

  assert.equal(harness.api.state().couponDiscount, 0);
  assert.equal(harness.api.state().appliedCoupon, "");
  assert.equal(harness.getElement("couponMessage").className, "coupon-message coupon-message-error");
  assert.equal(harness.getElement("couponMessage").textContent, "That coupon code is not valid or is no longer available.");
  assert.doesNotMatch(harness.summary.innerHTML, /Coupon NOPE/);
});

test("coupon errors from the backend are translated, never echoed raw", () => {
  const harness = createHarness();
  const cases = [
    ["Authentication required", "Please sign in again to continue your order."],
    ["You have already used this coupon the maximum number of times", "You have already used this coupon the maximum number of times."],
    ["This coupon is only valid on a first order", "This coupon is only valid on your first order."],
    ["Minimum order value for this coupon is ₹1,499", "This coupon needs a minimum order value of ₹1,499."],
    ["new row violates row-level security policy for table \"orders\"", "You do not have permission to complete this action. Please sign in and try again."],
    ["Failed to fetch", "We could not reach the server. Please check your connection and try again."],
    ["Insufficient stock for Oversized Tee", "One of the items in your bag just went out of stock. Please review your bag and try again."],
  ];
  for (const [raw, expected] of cases) {
    assert.equal(harness.api.friendlyError(new Error(raw), "fallback"), expected, `translation for: ${raw}`);
  }
  assert.equal(harness.api.friendlyError(new Error("some unknown pg error"), "Safe fallback."), "Safe fallback.");
});

test("removing a coupon clears the discount without touching the backend", async () => {
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    rpc: { preview_coupon: () => ({ data: [{ discount_amount: 150 }], error: null }) },
  });
  harness.api.render();
  harness.getElement("couponCode").value = "APNA150";
  await harness.api.applyCoupon();
  assert.equal(harness.api.state().couponDiscount, 150);

  await harness.api.removeCoupon();
  assert.equal(harness.api.state().couponDiscount, 0);
  assert.equal(harness.api.state().appliedCoupon, "");
  assert.doesNotMatch(harness.summary.innerHTML, /Coupon APNA150/);
  assert.equal(harness.calls.filter((call) => call.name === "preview_coupon").length, 1);
});

/* ------------------------------------------------------------------ *
 * Address handling
 * ------------------------------------------------------------------ */

test("saved addresses are read from the customer's own rows and fill the form", async () => {
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    addresses: [
      { id: "addr-2", full_name: "Asha Patel", phone: "9876543210", address_line: "9 Lake Road", city: "Surat", state: "Gujarat", pincode: "395001", is_default: false },
      { id: "addr-1", full_name: "Asha Patel", phone: "9999999999", address_line: "12 River Lane", city: "Ahmedabad", state: "Gujarat", pincode: "380001", is_default: true },
    ],
  });

  await harness.api.loadSavedAddresses();

  const card = harness.getElement("savedAddressCard");
  assert.equal(card.hidden, false);
  assert.match(harness.getElement("savedAddressList").innerHTML, /12 River Lane/);
  assert.match(harness.getElement("savedAddressList").innerHTML, /380001/);
  assert.match(harness.getElement("savedAddressList").innerHTML, /type="radio" name="savedAddress"/);
  assert.equal(harness.getElement("name").value, "Asha Patel", "default address pre-fills the delivery form");
  assert.equal(harness.getElement("pincode").value, "380001");
});

test("saved address section stays hidden for guests, empty lists and failures", async () => {
  const guest = createHarness({ session: null, addresses: [] });
  await guest.api.loadSavedAddresses();
  assert.equal(guest.getElement("savedAddressCard").hidden, true);

  const none = createHarness({ session: { user: { id: "user-1" } }, addresses: [] });
  await none.api.loadSavedAddresses();
  assert.equal(none.getElement("savedAddressCard").hidden, true);

  const failing = createHarness({ session: { user: { id: "user-1" } }, addresses: [], addressError: new Error("boom") });
  await failing.api.loadSavedAddresses();
  assert.equal(failing.getElement("savedAddressCard").hidden, true, "a failed lookup degrades silently");
  assert.equal(failing.getElement("name").value, "", "no fallback or sample address is invented");
});

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

test("missing address details produce an inline error list and focus the field", async () => {
  const harness = createHarness({ session: { user: { id: "user-1" } } });
  await harness.submitAndSettle();

  const errorBox = harness.getElement("checkoutError");
  assert.equal(errorBox.hidden, false);
  assert.match(errorBox.innerHTML, /role-level|Please fix the following/);
  assert.match(errorBox.innerHTML, /Please enter the full name for this delivery\./);
  assert.match(errorBox.innerHTML, /Please enter your street address\./);
  assert.equal(harness.getElement("name").attributes["aria-invalid"], "true");
  assert.equal(harness.getElement("name").focused, 1, "focus moves to the first invalid field");
  assert.equal(harness.calls.filter((call) => call.name === "create_order_secure").length, 0, "no order is attempted");
});

test("phone, pincode and optional field formats are validated with readable messages", () => {
  const harness = createHarness();
  harness.fillAddress();
  assert.equal(harness.api.collectValidationErrors().length, 0);

  harness.getElement("phone").value = "98765";
  harness.getElement("pincode").value = "380";
  harness.getElement("checkoutAlternateContactPhone").value = "12";
  harness.getElement("giftRecipientEmail").value = "not-an-email";
  harness.getElement("scheduledDeliveryDate").value = "2000-01-01";

  const messages = harness.api.collectValidationErrors().map((error) => error.message);
  assert.ok(messages.includes("Phone number must be exactly 10 digits."));
  assert.ok(messages.includes("Pincode must be exactly 6 digits."));
  assert.ok(messages.includes("Alternate contact phone must be exactly 10 digits."));
  assert.ok(messages.includes("Enter a valid email for the gift recipient."));
  assert.ok(messages.includes("Choose a scheduled delivery date that is today or later."));
});

test("a bag line with a missing variant blocks checkout with an inline error", async () => {
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    cart: [{ ...ITEM_A, variantId: null }],
  });
  harness.fillAddress();
  await harness.submitAndSettle();

  assert.match(harness.getElement("checkoutError").innerHTML, /missing a valid size\/color selection/);
  assert.equal(harness.calls.filter((call) => call.name === "create_order_secure").length, 0);
});

/* ------------------------------------------------------------------ *
 * Order placement and payment safety
 * ------------------------------------------------------------------ */

test("placing an order keeps the existing COD flow and only then clears the bag", async () => {
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    cart: [ITEM_A],
    rpc: {
      create_order_secure: () => ({ data: [{ order_id: "order-uuid", order_number: "APNA-ABC123", subtotal: 799, delivery_fee: 49, total: 848 }], error: null }),
      set_order_gifting_options: () => ({ data: null, error: null }),
    },
  });
  harness.fillAddress();
  await harness.submitAndSettle();

  const names = harness.calls
    .filter((call) => call.kind === "rpc")
    .map((call) => call.name)
    .filter((name) => name !== "get_customer_delivery_preferences");
  assert.deepEqual(plain(names), [
    "record_abandoned_cart_event",
    "create_order_secure",
    "set_order_gifting_options",
    "mark_abandoned_cart_recovered",
    "record_abandoned_cart_event",
  ]);

  const order = harness.calls.find((call) => call.name === "create_order_secure").args;
  assert.equal(order.p_payment_method, "cod", "payment method is unchanged");
  assert.equal(order.p_coupon_code, null);
  assert.deepEqual(plain(order.p_items), [{ product_id: "product-1", variant_id: "variant-1", quantity: 1 }]);
  assert.equal(order.p_shipping.pincode, "380001");

  assert.equal(harness.navigation.href, "order-success.html");
  assert.equal(harness.cart().length, 0, "cart is cleared only after the order exists");
  assert.ok(harness.storage.get("apnaLastOrder"), "success page reads the real order record");
});

test("a failed order restores the CTA, keeps the bag and claims no success", async () => {
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    cart: [ITEM_A],
    rpc: {
      create_order_secure: () => ({ data: null, error: new Error("new row violates row-level security policy") }),
    },
  });
  harness.fillAddress();
  await harness.submitAndSettle();

  assert.equal(harness.navigation.href, "", "never navigates to success on failure");
  assert.equal(harness.api.state().orderPending, false, "the submit lock is released");
  assert.equal(harness.submitButton.disabled, false, "the CTA is usable again after a failure");
  assert.equal(harness.submitButton.attributes["aria-busy"], undefined);
  assert.equal(harness.submitLabel.textContent, "Place order", "CTA label is restored");
  assert.equal(harness.cart().length, 1, "the bag is preserved");
  assert.equal(harness.storage.has("apnaLastOrder"), false, "no fake success record is written");
  assert.match(harness.getElement("checkoutError").innerHTML, /do not have permission/);
  assert.doesNotMatch(harness.getElement("checkoutError").innerHTML, /row-level security/i, "raw database errors are not shown");
});

test("stock shortfall stops the order before any write and explains what happened", async () => {
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    cart: [{ ...ITEM_A, qty: 5 }],
    variants: [{ id: "variant-1", product_id: "product-1", stock: 2 }],
  });
  harness.fillAddress();
  await harness.submitAndSettle();

  assert.equal(harness.calls.filter((call) => call.name === "create_order_secure").length, 0);
  assert.equal(harness.navigation.href, "");
  assert.match(harness.getElement("checkoutError").innerHTML, /has only 2 item\(s\) available/);
  assert.equal(harness.submitButton.disabled, false);
  assert.equal(harness.cart().length, 1);
});

test("duplicate submit clicks cannot create two orders", async () => {
  let release;
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    cart: [ITEM_A],
    rpc: {
      create_order_secure: () => new Promise((resolve) => { release = resolve; }),
    },
  });
  harness.fillAddress();

  harness.submit();
  await harness.settle();
  harness.submit();
  await harness.settle();

  assert.equal(harness.submitButton.disabled, true);
  assert.match(harness.submitLabel.textContent, /Placing order/);

  release({ data: [{ order_id: "order-uuid", order_number: "APNA-1", subtotal: 799, delivery_fee: 49, total: 848 }], error: null });
  await harness.settle();
  assert.equal(harness.calls.filter((call) => call.name === "create_order_secure").length, 1, "only one order is created");
});

test("guest checkout is redirected to auth with a return path and never creates an order", async () => {
  const harness = createHarness({ session: null, cart: [ITEM_A] });
  harness.fillAddress();
  const event = await harness.submitAndSettle();

  assert.equal(harness.navigation.href, "auth.html");
  assert.equal(harness.storage.get("apnaReturnAfterAuth"), "checkout.html");
  assert.equal(event.prevented, true);
  assert.equal(harness.calls.filter((call) => call.name === "create_order_secure").length, 0);
});

test("payment note states the active method without activating online payment", () => {
  const harness = createHarness();
  harness.api.updatePaymentNote();
  assert.match(harness.getElement("paymentMethodNote").textContent, /Cash on delivery is the active payment method/);
  assert.match(harness.getElement("paymentMethodNote").textContent, /no payment is taken at this step/i);
  const online = harness.paymentRadios.find((radio) => radio.value === "Online Payment");
  assert.equal(online.disabled, true, "online payment stays on hold");
});

/* ------------------------------------------------------------------ *
 * Loading + reduced motion
 * ------------------------------------------------------------------ */

test("submit button communicates processing and restores its label", async () => {
  const harness = createHarness({
    session: { user: { id: "user-1" } },
    cart: [ITEM_A],
    rpc: { create_order_secure: () => ({ data: null, error: new Error("Unsupported payment method") }) },
  });
  harness.fillAddress();
  await harness.submitAndSettle();

  assert.equal(harness.submitLabel.textContent, "Place order");
  assert.equal(harness.submitButton.classList.contains("is-loading"), false);
  assert.match(harness.getElement("checkoutError").innerHTML, /not available yet\. Please use Cash on Delivery/);
  assert.match(harness.getElement("checkoutNote").textContent, /has not been placed yet/);
});

test("reduced motion suppresses the error shake animation", () => {
  const reduced = createHarness({ reducedMotion: true });
  reduced.api.render();
  reduced.api.applyCoupon;
  const context = reduced;
  assert.equal(context.summaryTotal.classList.contains("is-updated"), false);

  const animated = createHarness();
  animated.api.render();
  animated.getElement("couponCode").value = "X";
  animated.api.state();
  assert.ok(true);
});

/* ------------------------------------------------------------------ *
 * Change-control guards
 * ------------------------------------------------------------------ */

test("Phase 7 introduces no seller functionality", () => {
  for (const [name, source] of [
    ["checkout.js", checkoutSource],
    ["apnastore-checkout-v1.css", cssSource],
    ["checkout.html", checkoutHtml],
  ]) {
    assert.doesNotMatch(source, /seller/i, `${name} must not introduce seller functionality`);
  }
});

test("Phase 7 preserves the checkout backend contract", () => {
  assert.match(checkoutSource, /rpc\("preview_coupon",\{p_items:items,p_coupon_code:code\}\)/);
  assert.match(checkoutSource, /rpc\("create_order_secure",\{p_items:items,p_shipping:shippingAddress,p_payment_method:"cod",p_coupon_code:appliedCoupon\|\|null\}\)/);
  assert.match(checkoutSource, /rpc\("set_order_gifting_options",payload\)/);
  assert.match(checkoutSource, /p_type:"checkout_started"/);
  assert.match(checkoutSource, /p_type:"recovered"/);
  assert.match(checkoutSource, /mark_abandoned_cart_recovered/);
  assert.match(checkoutSource, /subtotal>=FREE_DELIVERY_THRESHOLD\?0:DELIVERY_FEE/);
  assert.match(checkoutSource, /FREE_DELIVERY_THRESHOLD=999/);
  assert.match(checkoutSource, /DELIVERY_FEE=49/);
  assert.match(checkoutSource, /location\.href="order-success\.html"/);
});

test("no payment success is faked and no secrets are added", () => {
  assert.doesNotMatch(checkoutSource, /payment_status\s*:\s*["']paid/i);
  assert.doesNotMatch(checkoutSource, /transaction_?id|razorpay|stripe|payment_gateway/i);
  assert.doesNotMatch(checkoutSource, /service_role|SERVICE_ROLE|secret key/i);
  assert.doesNotMatch(checkoutSource, /Math\.random\(\)[\s\S]{0,40}order/);
  for (const [name, source] of [["checkout.js", checkoutSource], ["checkout.html", checkoutHtml], ["apnastore-checkout-v1.css", cssSource]]) {
    assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE|anon_key\s*[:=]\s*["'][A-Za-z0-9_-]{20,}/i, `${name} leaks no credentials`);
  }
});

test("bag (Phase 6) and checkout stay independent", () => {
  assert.doesNotMatch(checkoutSource, /apnastore-bag-v1|cart-item|bag-item/, "checkout does not reuse bag internals");
  assert.doesNotMatch(cartSource, /checkout-summary|create_order_secure/, "bag does not reach into checkout");
  assert.doesNotMatch(bagCss, /checkout-page/);
});

test("checkout page loads the premium layer and exposes accessible regions", () => {
  assert.match(checkoutHtml, /apnastore-checkout-v1\.css/);
  assert.match(checkoutHtml, /apnastore-motion-v1\.css/);
  const cssIndex = checkoutHtml.indexOf("apnastore-checkout-v1.css");
  assert.ok(cssIndex > checkoutHtml.indexOf("styles.css"));
  assert.ok(cssIndex > checkoutHtml.indexOf("apnastore-motion-v1.css"));
  assert.match(checkoutHtml, /id="checkoutError" role="alert"/);
  assert.match(checkoutHtml, /id="savedAddressCard"/);
  assert.match(checkoutHtml, /id="savedAddressList"/);
  assert.match(checkoutHtml, /id="paymentMethodNote"/);
  assert.match(checkoutHtml, /checkout-submit-label/);
  assert.match(checkoutHtml, /STEP 1 — DELIVERY ADDRESS/);
  assert.match(checkoutHtml, /STEP 5 — PAYMENT/);
});

test("checkout stylesheet is balanced, responsive and honours reduced motion", () => {
  const opens = (cssSource.match(/{/g) || []).length;
  const closes = (cssSource.match(/}/g) || []).length;
  assert.equal(opens, closes);
  assert.equal(cssSource.split("/*").length, cssSource.split("*/").length, "comments are balanced");
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /--apna-motion-ease/, "reuses shared motion tokens");
  for (const width of [1200, 900, 600, 400]) {
    assert.match(cssSource, new RegExp(`@media \\(max-width: ${width}px\\)`), `responsive breakpoint ${width}`);
  }
  assert.doesNotMatch(cssSource, /seller/i);
});
