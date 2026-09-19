const params = new URLSearchParams(location.search);
const productId = params.get("id");

const fallbackProducts = {
  "e58b74fe-d5c4-4f9c-8650-723e4ab75e53": { sizes:["S","M","L","XL"], colors:["Natural","Black","Olive"] },
  "0faccd51-ad4a-4812-a78c-051346b41141": { sizes:["S","M","L","XL"], colors:["Charcoal","Sand"] },
  "2a8c646d-2504-482d-a3e9-facd4df96ed7": { sizes:["S","M","L"], colors:["Mocha","Cream"] },
  "7d074207-c476-47ee-9a79-3210be85724a": { sizes:["S","M","L","XL"], colors:["White","Blue"] },
  "a9ecfb24-0c10-48a9-8733-a6a1bcbe2da4": { sizes:["30","32","34","36"], colors:["Black","Khaki"] },
  "a918ec4e-eafb-4133-884f-716401657876": { sizes:["S","M","L","XL"], colors:["Terracotta","Black"] },
  "cf4547e1-b242-4c9c-9dd3-f65ec851bfb6": { sizes:["4Y","6Y","8Y","10Y"], colors:["Coral","Navy"] },
  "3cb85e55-1880-4c2d-933d-d93b3558d9c3": { sizes:["6","7","8","9","10"], colors:["White","Black"] }
};

const el = document.getElementById("product");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function showError(message) {
  el.innerHTML = `<div class="product-details"><p class="eyebrow">PRODUCT</p><h1>Product unavailable</h1><p class="detail-desc">${esc(message)}</p><a class="primary-btn" href="shop.html">Back to shop →</a></div>`;
}

async function loadProduct() {
  if (!productId) {
    showError("Please choose a product from the shop.");
    return;
  }

  const { data: product, error } = await apnaSupabase
    .from("products")
    .select("id,name,slug,description,price,category_id,categories(name)")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !product) {
    console.error("Product load failed:", error);
    showError("We could not load this product right now.");
    return;
  }

  const { data: variants, error: variantError } = await apnaSupabase
    .from("product_variants")
    .select("id,size,color,sku,stock")
    .eq("product_id", product.id)
    .order("size");

  if (variantError) console.warn("Variant load failed:", variantError);

  const fallback = fallbackProducts[product.id] || { sizes:["S","M","L"], colors:["Default"] };
  const availableVariants = (variants || []).filter(v => Number(v.stock ?? 0) > 0);
  const sizes = [...new Set(availableVariants.map(v => v.size).filter(Boolean))];
  const colors = [...new Set(availableVariants.map(v => v.color).filter(Boolean))];

  const finalSizes = sizes.length ? sizes : fallback.sizes;
  const finalColors = colors.length ? colors : fallback.colors;

  let size = finalSizes[0];
  let color = finalColors[0];
  let qty = 1;

  el.innerHTML = `
    <div class="product-visual"><div class="product-image product-large"><span>APNA<br>EDIT</span></div></div>
    <div class="product-details">
      <p class="eyebrow">${esc(product.categories?.name || "PRODUCT").toUpperCase()}</p>
      <h1>${esc(product.name)}</h1>
      <p class="detail-price">₹${money(product.price)}</p>
      <p class="detail-desc">${esc(product.description || "A carefully selected everyday product from Apna Store.")}</p>
      <div class="option"><b>Size</b><div class="option-list">
        ${finalSizes.map((x,j)=>`<button class="${j===0?"selected":""}" data-size="${esc(x)}">${esc(x)}</button>`).join("")}
      </div></div>
      <div class="option"><b>Color: <span id="colorName">${esc(color)}</span></b><div class="option-list">
        ${finalColors.map((x,j)=>`<button class="swatch ${j===0?"selected":""}" data-color="${esc(x)}">${esc(x)}</button>`).join("")}
      </div></div>
      <div class="buy-row">
        <div class="qty"><button id="minus">−</button><span id="qty">1</span><button id="plus">+</button></div>
        <button class="primary-btn" id="add">Add to bag <span>→</span></button>
      </div>
      <p class="product-note">✓ Secure payment &nbsp; ✓ Easy returns &nbsp; ✓ Delivery across India</p>
    </div>`;

  document.querySelectorAll("[data-size]").forEach(button => {
    button.onclick = () => {
      document.querySelectorAll("[data-size]").forEach(x => x.classList.remove("selected"));
      button.classList.add("selected");
      size = button.dataset.size;
    };
  });

  document.querySelectorAll("[data-color]").forEach(button => {
    button.onclick = () => {
      document.querySelectorAll("[data-color]").forEach(x => x.classList.remove("selected"));
      button.classList.add("selected");
      color = button.dataset.color;
      document.getElementById("colorName").textContent = color;
    };
  });

  document.getElementById("plus").onclick = () => {
    qty++;
    document.getElementById("qty").textContent = qty;
  };

  document.getElementById("minus").onclick = () => {
    if (qty > 1) qty--;
    document.getElementById("qty").textContent = qty;
  };

  document.getElementById("add").onclick = () => {
    const cart = JSON.parse(localStorage.getItem("apnaCart") || "[]");
    const key = product.id + "-" + size + "-" + color;
    const existing = cart.find(item => item.key === key);

    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        key,
        productId: product.id,
        name: product.name,
        category: product.categories?.name || "Product",
        price: Number(product.price),
        size,
        color,
        qty
      });
    }

    localStorage.setItem("apnaCart", JSON.stringify(cart));
    location.href = "cart.html";
  };
}

loadProduct();