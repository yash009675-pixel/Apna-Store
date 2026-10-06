/* Apna Store — Bag feedback layer
 *
 * Shared "added to bag" feedback:
 *   1. an image flight from the product visual to the bag link
 *   2. a microinteraction on the bag badge / bag link
 *
 * Rules:
 *   - Only a real public URL belonging to the configured Supabase
 *     product-images bucket may be flown. Anything else is skipped
 *     gracefully (the badge feedback still runs).
 *   - Nothing here writes commerce data. Callers run it *after* the
 *     cart has been saved successfully.
 *   - prefers-reduced-motion short-circuits every animation.
 *
 * Returns the number of milliseconds the caller should wait before
 * navigating away (0 when nothing is animating), so navigation is never
 * delayed for a feedback effect that did not run.
 */
(function () {
  "use strict";

  var IMAGE_BUCKET = "product-images";
  var IMAGE_PUBLIC_MARKER = "/storage/v1/object/public/" + IMAGE_BUCKET + "/";
  var CART_KEY = "apnaCart";
  var FLIGHT_MS = 520;
  var FLIGHT_CLEANUP_MS = 900;
  var PULSE_MS = 520;
  var BUMP_MS = 400;

  function hasWindow() { return typeof window !== "undefined"; }
  function hasDocument() { return typeof document !== "undefined"; }

  function configuredStorageUrl() {
    try {
      return (hasWindow() && window.APNA_SUPABASE_CONFIG && window.APNA_SUPABASE_CONFIG.url) || "";
    } catch (error) { return ""; }
  }

  function isProductImageUrl(url) {
    var value = String(url || "");
    if (!/^https:\/\/[^\s"'<>]+$/i.test(value)) return false;
    if (value.indexOf(IMAGE_PUBLIC_MARKER) === -1) return false;
    var configured = configuredStorageUrl();
    if (configured && value.indexOf(configured) !== 0) return false;
    return true;
  }

  function prefersReducedMotion() {
    try {
      return Boolean(hasWindow() && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (error) { return false; }
  }

  function cartCount() {
    try {
      var raw = typeof localStorage !== "undefined" ? localStorage.getItem(CART_KEY) : null;
      var cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart)) return 0;
      return cart.reduce(function (sum, item) {
        return sum + Math.max(0, Number(item && item.qty) || 0);
      }, 0);
    } catch (error) { return 0; }
  }

  function syncBadges() {
    if (!hasDocument() || !document.querySelectorAll) return;
    var count = cartCount();
    var badges = document.querySelectorAll(".cart-count,.nav-count");
    for (var i = 0; i < badges.length; i++) {
      var badge = badges[i];
      badge.textContent = count > 99 ? "99+" : String(count);
      if (badge.classList && badge.classList.contains("nav-count")) badge.hidden = count === 0;
    }
  }

  function pulseBadges() {
    if (!hasDocument() || !document.querySelectorAll) return;
    var badges = document.querySelectorAll(".cart-count,.nav-count");
    for (var i = 0; i < badges.length; i++) {
      (function (badge) {
        badge.classList.remove("apna-cart-bump");
        void badge.offsetWidth;
        badge.classList.add("apna-cart-bump");
        setTimeout(function () { badge.classList.remove("apna-cart-bump"); }, BUMP_MS);
      })(badges[i]);
    }
  }

  function pulseBagLink() {
    if (!hasDocument() || !document.querySelectorAll) return;
    var links = document.querySelectorAll('a[href="cart.html"]');
    for (var i = 0; i < links.length; i++) {
      (function (link) {
        link.classList.add("apna-bag-pulse");
        setTimeout(function () { link.classList.remove("apna-bag-pulse"); }, PULSE_MS);
      })(links[i]);
    }
  }

  function bagTarget() {
    if (!hasDocument() || !document.querySelector) return null;
    return document.querySelector(".header-actions a[href='cart.html']")
      || document.querySelector('.header-actions a[href="cart.html"]')
      || document.querySelector('a[href="cart.html"]');
  }

  function resolveSource(source) {
    if (!source || !hasDocument() || !document.querySelector) return null;
    if (source.tagName === "IMG") return source;
    var card = source.closest ? source.closest(".product-card,.cart-item,.product-visual,.product-main-layout") : null;
    if (card && card.querySelector) {
      var image = card.querySelector("img.product-main-img,img.cart-item-image,img");
      if (image) return image;
    }
    return source.querySelector && source.querySelector("img") ? source.querySelector("img") : null;
  }

  function flyToBag(imageUrl, source, target) {
    if (!hasDocument() || !document.body || !document.createElement) return false;
    var from = source.getBoundingClientRect();
    var to = target.getBoundingClientRect();
    if (!from || !to || (!from.width && !from.height) || (!to.width && !to.height)) return false;

    var node = document.createElement("img");
    node.className = "apna-bag-flight";
    node.alt = "";
    node.decoding = "async";
    node.src = imageUrl;
    node.style.left = from.left + "px";
    node.style.top = from.top + "px";
    node.style.width = Math.max(64, Math.min(from.width, 180)) + "px";
    node.style.height = Math.max(72, Math.min(from.height, 210)) + "px";

    var done = false;
    var remove = function () {
      if (done) return;
      done = true;
      if (node.parentNode) node.parentNode.removeChild(node);
    };
    node.onerror = remove;

    document.body.appendChild(node);
    setTimeout(remove, FLIGHT_CLEANUP_MS);

    var frame = hasWindow() && window.requestAnimationFrame ? window.requestAnimationFrame : function (fn) { setTimeout(fn, 16); };
    frame(function () {
      if (done) return;
      var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      node.style.transform = "translate(" + Math.round(dx) + "px," + Math.round(dy) + "px) scale(.16)";
      node.style.opacity = ".2";
      setTimeout(remove, FLIGHT_MS);
    });

    return true;
  }

  /* options: { imageUrl, source } — returns ms the caller should wait. */
  function bagFeedback(options) {
    var settings = options || {};
    var reduced = prefersReducedMotion();

    syncBadges();

    if (!hasDocument()) return 0;
    if (reduced) return 0;

    pulseBadges();
    pulseBagLink();

    if (!isProductImageUrl(settings.imageUrl)) return 0;
    var source = resolveSource(settings.source);
    var target = bagTarget();
    if (!source || !target || !source.getBoundingClientRect) return 0;
    if (!flyToBag(settings.imageUrl, source, target)) return 0;
    return FLIGHT_MS;
  }

  var api = {
    isProductImageUrl: isProductImageUrl,
    cartCount: cartCount,
    syncBadges: syncBadges,
    feedback: bagFeedback
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (hasWindow()) {
    window.apnaBagFeedback = bagFeedback;
    window.apnaBagFeedbackApi = api;
  }
})();
