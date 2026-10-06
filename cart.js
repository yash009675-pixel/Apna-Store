/* Apna Store — Bag (cart) page
 *
 * Phase 6: premium bag experience.
 *
 * Commerce behaviour is intentionally unchanged:
 *  - cart storage stays in localStorage under "apnaCart"
 *  - catalog/price/stock truth still comes from Supabase
 *  - quantity is still capped by live variant stock
 *  - delivery stays ₹49 below ₹999 and free at/above ₹999
 *  - abandoned-cart tracking and the checkout flow are untouched
 *
 * The only new reads are product images from the Supabase
 * "product-images" bucket, and the only new writes are presentation state.
 */
(function () {
  "use strict";

  var CART_KEY = "apnaCart";
  var DELIVERY_FEE = 49;
  var FREE_DELIVERY_THRESHOLD = 999;
  var IMAGE_BUCKET = "product-images";
  var IMAGE_PUBLIC_MARKER = "/storage/v1/object/public/" + IMAGE_BUCKET + "/";
  var IMAGE_CACHE_KEY = "apnaBagImagesV1";
  var IMAGE_CACHE_TTL = 10 * 60 * 1000;
  var REMOVE_ANIMATION_MS = 220;
  var CHECKOUT_FEEDBACK_MS = 180;
  var CHECKOUT_SAFETY_MS = 1500;
  var ENTER_STAGGER_MS = 45;
  var MAX_ENTER_STAGGER = 6;
  var QTY_PULSE_MS = 420;

  /* ------------------------------------------------------------------ *
   * Environment helpers — resolved lazily so the file stays testable.
   * ------------------------------------------------------------------ */

  function hasWindow() { return typeof window !== "undefined"; }
  function localStore() {
    try { return typeof localStorage !== "undefined" ? localStorage : null; }
    catch (error) { return null; }
  }
  function sessionStore() {
    try { return typeof sessionStorage !== "undefined" ? sessionStorage : null; }
    catch (error) { return null; }
  }
  function supabaseClient() { return typeof apnaSupabase !== "undefined" ? apnaSupabase : undefined; }
  function bagBox() {
    try { return typeof document !== "undefined" && document.getElementById ? document.getElementById("cart") : null; }
    catch (error) { return null; }
  }
  function prefersReducedMotion() {
    try {
      return Boolean(hasWindow() && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (error) { return false; }
  }
  function navigate(url) { if (typeof location !== "undefined") location.href = url; }
  function notify(message) { if (typeof alert === "function") alert(message); }
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  /* ------------------------------------------------------------------ *
   * Formatting
   * ------------------------------------------------------------------ */

  function money(value) { return "₹" + Number(value || 0).toLocaleString("en-IN"); }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function initials(name) {
    var words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "AP";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /* ------------------------------------------------------------------ *
   * Cart storage
   * ------------------------------------------------------------------ */

  function readCart() {
    var store = localStore();
    if (!store) return [];
    try {
      var data = JSON.parse(store.getItem(CART_KEY) || "[]");
      if (!Array.isArray(data)) return [];
      return normalizeCart(data.filter(function (item) { return item && item.name; }).map(function (item) {
        return Object.assign({}, item, {
          price: Number(item.price) || 0,
          qty: Math.max(1, Number(item.qty) || 1)
        });
      }));
    } catch (error) {
      console.error("Cart data could not be read:", error);
      return [];
    }
  }

  function saveCart(cart) {
    var store = localStore();
    if (!store) return;
    store.setItem(CART_KEY, JSON.stringify(normalizeCart(cart)));
  }

  function cartKey(item) {
    return item.key || [item.productId, item.variantId, item.size || "", item.color || ""].join("|");
  }

  function normalizeCart(cart) {
    var merged = new Map();
    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      var key = cartKey(item);
      var qty = Math.max(1, Number(item.qty) || 1);
      if (merged.has(key)) merged.get(key).qty += qty;
      else merged.set(key, Object.assign({}, item, { key: key, qty: qty }));
    }
    return Array.from(merged.values());
  }

  /* ------------------------------------------------------------------ *
   * Catalog sync — unchanged rules
   * ------------------------------------------------------------------ */

  async function syncCartWithCatalog() {
    var client = supabaseClient();
    var cart = readCart();
    if (!cart.length || !client) return;
    var ids = Array.from(new Set(cart.map(function (item) { return item.productId; }).filter(Boolean)));
    if (!ids.length) return;

    var results = await Promise.all([
      client.from("products").select("id,name,price,category_id,status").in("id", ids),
      client.from("product_variants").select("id,product_id,size,color,stock").in("product_id", ids)
    ]);
    var products = results[0], variants = results[1];
    if (products.error || variants.error) {
      console.error("Cart catalog sync failed:", products.error || variants.error);
      return;
    }

    var productMap = new Map((products.data || []).map(function (product) { return [product.id, product]; }));
    var variantMap = new Map((variants.data || []).map(function (variant) { return [variant.id, variant]; }));
    var next = [];

    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      var product = productMap.get(item.productId);
      var variant = variantMap.get(item.variantId);
      if (!product || product.status !== "active") continue;
      if (!variant || variant.product_id !== item.productId || Number(variant.stock) <= 0) continue;
      var maxStock = Number(variant.stock);
      var qty = Math.min(Math.max(1, Number(item.qty) || 1), maxStock);
      next.push(Object.assign({}, item, {
        name: product.name,
        category: item.category || "Apna Store",
        price: Number(product.price),
        size: variant.size || "",
        color: variant.color || "",
        qty: qty
      }));
    }

    saveCart(normalizeCart(next));
  }

  async function trackAbandonedCart() {
    try {
      var client = supabaseClient();
      if (!client) return;
      var sessionResult = await client.auth.getSession();
      var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
      if (!session) return;
      var cart = readCart();
      var subtotal = cart.reduce(function (sum, item) {
        return sum + Number(item.price || 0) * Number(item.qty || 1);
      }, 0);
      if (!cart.length) return;
      var payload = cart.map(function (item) {
        return {
          product_id: item.productId || null,
          variant_id: item.variantId || null,
          quantity: Number(item.qty || 1),
          price: Number(item.price || 0),
          name: item.name || "Product"
        };
      });
      await client.rpc("track_abandoned_cart", { p_cart: payload, p_subtotal: subtotal, p_checkout_started: false });
      await client.rpc("record_abandoned_cart_event", { p_type: "cart_tracked", p_channel: "in_app" });
    } catch (error) {
      console.warn("Abandoned cart tracking unavailable:", error);
    }
  }

  /* ------------------------------------------------------------------ *
   * Product images — Supabase "product-images" bucket only
   * ------------------------------------------------------------------ */

  function configuredStorageUrl() {
    try {
      return (hasWindow() && window.APNA_SUPABASE_CONFIG && window.APNA_SUPABASE_CONFIG.url) || "";
    } catch (error) { return ""; }
  }

  /* A URL is only eligible for display/flight when it is a public URL of the
   * configured Supabase project's product-images bucket. */
  function isProductImageUrl(url) {
    var value = String(url || "");
    if (!/^https:\/\/[^\s"'<>]+$/i.test(value)) return false;
    if (value.indexOf(IMAGE_PUBLIC_MARKER) === -1) return false;
    var configured = configuredStorageUrl();
    if (configured && value.indexOf(configured) !== 0) return false;
    return true;
  }

  function publicImageUrl(storagePath) {
    if (!storagePath) return "";
    var client = supabaseClient();
    if (!client || !client.storage) return "";
    try {
      var result = client.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);
      var url = result && result.data ? String(result.data.publicUrl || "") : "";
      return isProductImageUrl(url) ? url : "";
    } catch (error) { return ""; }
  }

  var imageCache = null;

  function readImageCache() {
    if (imageCache) return imageCache;
    imageCache = new Map();
    var store = sessionStore();
    if (!store) return imageCache;
    try {
      var raw = store.getItem(IMAGE_CACHE_KEY);
      if (!raw) return imageCache;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || Date.now() - Number(parsed.ts) > IMAGE_CACHE_TTL) return imageCache;
      imageCache = new Map(Object.entries(parsed.map || {}));
    } catch (error) { /* cache is optional */ }
    return imageCache;
  }

  function writeImageCache() {
    var store = sessionStore();
    if (!store || !imageCache) return;
    try {
      store.setItem(IMAGE_CACHE_KEY, JSON.stringify({ ts: Date.now(), map: Object.fromEntries(imageCache) }));
    } catch (error) { /* cache is optional */ }
  }

  /* Returns a Map with "p:<productId>" and "v:<variantId>" keys. */
  async function fetchItemImages(cart) {
    var images = new Map();
    if (!cart.length) return images;

    var cache = readImageCache();
    var productIds = Array.from(new Set(cart.map(function (item) { return item.productId; }).filter(Boolean).map(String)));
    var missing = [];

    productIds.forEach(function (productId) {
      var cached = cache.get("P:" + productId);
      if (cached && typeof cached === "object") {
        if (isProductImageUrl(cached.primary)) images.set("p:" + productId, cached.primary);
        Object.keys(cached.variants || {}).forEach(function (variantId) {
          if (isProductImageUrl(cached.variants[variantId])) images.set("v:" + variantId, cached.variants[variantId]);
        });
      } else {
        missing.push(productId);
      }
    });

    if (!missing.length) return images;

    var client = supabaseClient();
    if (client) {
      var rows = [];
      try {
        var result = await client.from("product_images")
          .select("product_id,variant_id,storage_path,is_primary,sort_order")
          .in("product_id", missing)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });
        if (result && result.error) console.warn("Bag product image lookup failed:", result.error);
        rows = (result && result.data) || [];
      } catch (error) {
        console.warn("Bag product image lookup unavailable:", error);
      }

      var grouped = new Map();
      rows.forEach(function (row) {
        var productId = String(row.product_id);
        if (!grouped.has(productId)) grouped.set(productId, { primary: "", variants: {} });
        var entry = grouped.get(productId);
        var url = publicImageUrl(row.storage_path);
        if (!url) return;
        if (!entry.primary) entry.primary = url;
        if (row.variant_id && !entry.variants[String(row.variant_id)]) entry.variants[String(row.variant_id)] = url;
      });

      missing.forEach(function (productId) {
        var entry = grouped.get(productId) || { primary: "", variants: {} };
        cache.set("P:" + productId, entry);
        if (isProductImageUrl(entry.primary)) images.set("p:" + productId, entry.primary);
        Object.keys(entry.variants).forEach(function (variantId) {
          if (isProductImageUrl(entry.variants[variantId])) images.set("v:" + variantId, entry.variants[variantId]);
        });
      });
      writeImageCache();
    }

    return images;
  }

  function itemImage(item, images) {
    if (item.variantId && images.get("v:" + item.variantId)) return images.get("v:" + item.variantId);
    if (item.productId && images.get("p:" + item.productId)) return images.get("p:" + item.productId);
    return "";
  }

  /* ------------------------------------------------------------------ *
   * Totals
   * ------------------------------------------------------------------ */

  function calculateTotals(cart) {
    var subtotal = cart.reduce(function (sum, item) {
      return sum + Number(item.price || 0) * Number(item.qty || 1);
    }, 0);
    var delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    return {
      subtotal: subtotal,
      delivery: delivery,
      total: subtotal + delivery,
      freeDeliveryGap: Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal)
    };
  }

  function itemCount(cart) {
    return cart.reduce(function (sum, item) { return sum + Number(item.qty || 1); }, 0);
  }

  /* ------------------------------------------------------------------ *
   * Markup
   * ------------------------------------------------------------------ */

  function productUrl(item) {
    return "product.html?id=" + encodeURIComponent(item.productId || "");
  }

  function itemMarkup(item, index, images, reduced) {
    var image = itemImage(item, images);
    var name = escapeHtml(item.name);
    var key = escapeHtml(item.key || cartKey(item));
    var variant = [item.size, item.color].filter(Boolean).map(escapeHtml).join(" · ");
    var enterClass = reduced ? "" : " bag-item-enter";
    var enterStyle = reduced ? "" : ' style="animation-delay:' + (Math.min(index, MAX_ENTER_STAGGER) * ENTER_STAGGER_MS) + 'ms"';
    var media = image
      ? '<img class="cart-item-image" src="' + escapeHtml(image) + '" alt="' + name + '" width="112" height="132" loading="lazy" decoding="async">'
      : '<span class="cart-item-monogram" aria-hidden="true">' + escapeHtml(initials(item.name)) + '</span>';

    return '' +
      '<article class="cart-item bag-item' + enterClass + '" data-index="' + index + '" data-key="' + key + '"' + enterStyle + '>' +
        '<a class="cart-item-media apna-motion-image" href="' + productUrl(item) + '" aria-label="View ' + name + '">' + media + '</a>' +
        '<div class="cart-item-details">' +
          '<h3>' + name + '</h3>' +
          (variant ? '<p class="cart-item-variant">' + variant + '</p>' : '') +
          '<p class="cart-item-category">' + escapeHtml(item.category || "Apna Store") + '</p>' +
          '<p class="price cart-item-price">' + money(item.price) + '</p>' +
        '</div>' +
        '<div class="cart-item-actions">' +
          '<div class="bag-qty" role="group" aria-label="Quantity for ' + name + '">' +
            '<button type="button" class="bag-qty-btn" data-action="decrease" aria-label="Decrease quantity of ' + name + '">−</button>' +
            '<span class="bag-qty-value">' + Number(item.qty) + '</span>' +
            '<button type="button" class="bag-qty-btn" data-action="increase" aria-label="Increase quantity of ' + name + '">+</button>' +
          '</div>' +
          '<button type="button" class="bag-remove" data-action="remove" aria-label="Remove ' + name + ' from your bag">Remove</button>' +
          '<b class="cart-item-line-total">' + money(Number(item.price) * Number(item.qty)) + '</b>' +
        '</div>' +
      '</article>';
  }

  function summaryMarkup(cart, totals) {
    var count = itemCount(cart);
    var deliveryLabel = totals.delivery ? money(totals.delivery) : "FREE";
    var progress = Math.max(4, Math.min(100, Math.round((totals.subtotal / FREE_DELIVERY_THRESHOLD) * 100)));
    var progressNote = totals.delivery
      ? "Add " + money(totals.freeDeliveryGap) + " more for free delivery."
      : "Free delivery unlocked on this order.";

    return '' +
      '<aside class="cart-summary" aria-label="Order summary">' +
        '<h2>Order summary</h2>' +
        '<div class="bag-row"><span>Subtotal (' + count + ' item' + (count === 1 ? "" : "s") + ')</span><b>' + money(totals.subtotal) + '</b></div>' +
        '<div class="bag-row"><span>Delivery</span><b>' + deliveryLabel + '</b></div>' +
        '<p class="bag-progress" aria-hidden="true"><span class="bag-progress-bar" style="width:' + progress + '%"></span></p>' +
        '<small class="bag-progress-note">' + progressNote + '</small>' +
        '<div class="total bag-total"><span>Total</span><b>' + money(totals.total) + '</b></div>' +
        '<a class="primary-btn bag-checkout" href="checkout.html" data-action="checkout">Proceed to checkout <span aria-hidden="true">→</span></a>' +
        '<a class="bag-continue" href="shop.html">Add more pieces</a>' +
        '<p class="bag-reassurance">Secure checkout · Easy returns · Free delivery over ' + money(FREE_DELIVERY_THRESHOLD) + '</p>' +
      '</aside>';
  }

  function layoutMarkup(cart, images, reduced) {
    var count = itemCount(cart);
    return '' +
      '<div class="cart-layout">' +
        '<section class="cart-items" aria-label="Bag items">' +
          '<header class="bag-items-head">' +
            '<span class="bag-items-count">' + count + ' item' + (count === 1 ? "" : "s") + ' in your bag</span>' +
            '<a class="bag-continue" href="shop.html">Continue shopping</a>' +
          '</header>' +
          cart.map(function (item, index) { return itemMarkup(item, index, images, reduced); }).join("") +
        '</section>' +
        summaryMarkup(cart, calculateTotals(cart)) +
      '</div>' +
      '<p class="bag-status" id="bagStatus" role="status" aria-live="polite"></p>';
  }

  function emptyMarkup() {
    return '' +
      '<div class="empty-cart bag-empty">' +
        '<span class="bag-empty-mark" aria-hidden="true">◍</span>' +
        '<h2>Your bag is empty</h2>' +
        '<p>Nothing saved yet. Pieces you add will wait for you here.</p>' +
        '<a class="primary-btn" href="shop.html">Start shopping <span aria-hidden="true">→</span></a>' +
        '<p class="bag-empty-note">Free delivery on orders over ' + money(FREE_DELIVERY_THRESHOLD) + ' · Easy returns</p>' +
      '</div>' +
      '<p class="bag-status" id="bagStatus" role="status" aria-live="polite"></p>';
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  var renderToken = 0;

  async function draw() {
    var box = bagBox();
    if (!box) return;
    var token = ++renderToken;
    var cart = readCart();
    if (!cart.length) {
      box.innerHTML = emptyMarkup();
      return;
    }
    var images = await fetchItemImages(cart);
    if (token !== renderToken) return;
    box.innerHTML = layoutMarkup(cart, images, prefersReducedMotion());
  }

  function announce(message) {
    try {
      var el = typeof document !== "undefined" && document.getElementById ? document.getElementById("bagStatus") : null;
      if (el) el.textContent = message;
    } catch (error) { /* status region is optional */ }
  }

  function itemNode(index) {
    var box = bagBox();
    if (!box || !box.querySelectorAll) return null;
    var nodes = box.querySelectorAll(".bag-item");
    return index >= 0 && index < nodes.length ? nodes[index] : null;
  }

  function pulseQuantity(index) {
    var node = itemNode(index);
    if (!node || !node.querySelector) return;
    var value = node.querySelector(".bag-qty-value");
    if (!value || !value.classList) return;
    value.classList.remove("is-bumped");
    void value.offsetWidth;
    value.classList.add("is-bumped");
    setTimeout(function () { value.classList.remove("is-bumped"); }, QTY_PULSE_MS);
  }

  function setItemBusy(index, busy) {
    var node = itemNode(index);
    if (node && node.classList) node.classList.toggle("is-busy", Boolean(busy));
  }

  /* ------------------------------------------------------------------ *
   * Quantity + removal
   * ------------------------------------------------------------------ */

  async function changeCartQty(index, direction) {
    var cart = readCart();
    var item = cart[index];
    if (!item) return;

    if (direction > 0 && item.productId) {
      if (!item.variantId) {
        notify("Please remove this item and add it again with a valid size and color.");
        return;
      }
      var client = supabaseClient();
      if (!client) {
        notify("Stock verification is temporarily unavailable. Please refresh and try again.");
        return;
      }
      setItemBusy(index, true);
      var result;
      try {
        result = await client.from("product_variants")
          .select("stock")
          .eq("id", item.variantId)
          .eq("product_id", item.productId)
          .maybeSingle();
      } catch (error) {
        setItemBusy(index, false);
        notify("We couldn't verify this item's stock. Please try again.");
        return;
      }
      setItemBusy(index, false);
      if (result.error || !result.data) {
        notify("We couldn't verify this item's stock. Please try again.");
        return;
      }
      if (item.qty + 1 > Number(result.data.stock)) {
        notify("Only " + Number(result.data.stock) + " item(s) are available for this variant.");
        return;
      }
    }

    if (direction < 0 && item.qty <= 1) {
      await removeCartItem(index);
      return;
    }

    var next = readCart();
    if (!next[index]) return;
    next[index].qty = Math.max(1, Number(next[index].qty || 1) + direction);
    saveCart(normalizeCart(next));
    await syncCartWithCatalog();
    await draw();
    pulseQuantity(index);
    announce(next[index].name + " quantity updated to " + next[index].qty + ".");
  }

  async function removeCartItem(index) {
    var cart = readCart();
    var target = cart[index];
    if (!target) return;
    var key = target.key || cartKey(target);
    var node = itemNode(index);

    if (node && !prefersReducedMotion()) {
      node.classList.add("is-removing");
      await wait(REMOVE_ANIMATION_MS);
    }

    var remaining = readCart().filter(function (item) {
      return (item.key || cartKey(item)) !== key;
    });
    saveCart(remaining);
    await draw();
    announce(target.name + " removed from your bag.");
  }

  /* ------------------------------------------------------------------ *
   * Checkout transition
   * ------------------------------------------------------------------ */

  var checkoutStarted = false;

  function startCheckout(event, trigger) {
    if (!trigger) return;
    if (event && event.preventDefault) event.preventDefault();
    if (checkoutStarted) return;
    checkoutStarted = true;

    if (prefersReducedMotion()) {
      navigate("checkout.html");
      return;
    }

    trigger.classList.add("is-checkout");
    var card = trigger.closest ? trigger.closest(".cart-summary") : null;
    if (card) card.classList.add("is-checkout");
    setTimeout(function () { navigate("checkout.html"); }, CHECKOUT_FEEDBACK_MS);

    /* Safety net: if navigation never happens, hand the button back. */
    setTimeout(function () {
      checkoutStarted = false;
      trigger.classList.remove("is-checkout");
      if (card) card.classList.remove("is-checkout");
    }, CHECKOUT_SAFETY_MS);
  }

  function handleClick(event) {
    var target = event && event.target;
    if (!target || !target.closest) return;
    var trigger = target.closest("[data-action]");
    if (!trigger) return;

    var action = trigger.dataset ? trigger.dataset.action : null;
    if (action === "checkout") { startCheckout(event, trigger); return; }

    var item = trigger.closest(".bag-item");
    if (!item || !item.dataset) return;
    var index = Number(item.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;
    if (item.classList && item.classList.contains("is-busy")) return;

    if (action === "increase") changeCartQty(index, 1);
    else if (action === "decrease") changeCartQty(index, -1);
    else if (action === "remove") removeCartItem(index);
  }

  /* ------------------------------------------------------------------ *
   * Bootstrap
   * ------------------------------------------------------------------ */

  async function boot() {
    var box = bagBox();
    if (!box) return;
    if (box.addEventListener) box.addEventListener("click", handleClick);
    if (hasWindow() && window.addEventListener) {
      window.addEventListener("storage", function (event) {
        if (!event || event.key === CART_KEY) draw();
      });
    }
    await syncCartWithCatalog();
    await draw();
    await trackAbandonedCart();
  }

  var api = {
    CART_KEY: CART_KEY,
    DELIVERY_FEE: DELIVERY_FEE,
    FREE_DELIVERY_THRESHOLD: FREE_DELIVERY_THRESHOLD,
    IMAGE_BUCKET: IMAGE_BUCKET,
    readCart: readCart,
    saveCart: saveCart,
    cartKey: cartKey,
    normalizeCart: normalizeCart,
    calculateTotals: calculateTotals,
    itemCount: itemCount,
    isProductImageUrl: isProductImageUrl,
    publicImageUrl: publicImageUrl,
    fetchItemImages: fetchItemImages,
    syncCartWithCatalog: syncCartWithCatalog,
    trackAbandonedCart: trackAbandonedCart,
    emptyMarkup: emptyMarkup,
    layoutMarkup: layoutMarkup,
    draw: draw,
    changeCartQty: changeCartQty,
    removeCartItem: removeCartItem,
    startCheckout: startCheckout,
    money: money,
    escapeHtml: escapeHtml
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (hasWindow()) {
    window.apnaBag = Object.assign({}, window.apnaBag, api);
    window.changeCartQty = changeCartQty;
    window.removeCartItem = removeCartItem;
  }

  if (typeof document !== "undefined" && document.getElementById && document.getElementById("cart")) { boot(); }
})();
