const params=new URLSearchParams(location.search);
const productId=params.get("id");
const fallbackProducts={
 "e58b74fe-d5c4-4f9c-8650-723e4ab75e53":{name:"Relaxed Everyday Tee",category:"Women",price:599,description:"Everyday comfort.",sizes:["S","M","L","XL"],colors:["Natural","Black","Olive"]},
 "0faccd51-ad4a-4812-a78c-051346b41141":{name:"Essential Overshirt",category:"Men",price:1299,description:"Easy everyday layer.",sizes:["S","M","L","XL"],colors:["Charcoal","Sand"]},
 "2a8c646d-2504-482d-a3e9-facd4df96ed7":{name:"Soft Knit Co-ord",category:"Women",price:999,description:"Soft knit set.",sizes:["S","M","L"],colors:["Mocha","Cream"]},
 "7d074207-c476-47ee-9a79-3210be85724a":{name:"Classic Daily Shirt",category:"Men",price:799,description:"Clean everyday shirt.",sizes:["S","M","L","XL"],colors:["White","Blue"]},
 "a9ecfb24-0c10-48a9-8733-a6a1bcbe2da4":{name:"Everyday Cargo",category:"Men",price:1199,description:"Relaxed utility cargo.",sizes:["30","32","34","36"],colors:["Black","Khaki"]},
 "a918ec4e-eafb-4133-884f-716401657876":{name:"Easy Cotton Dress",category:"Women",price:899,description:"Light cotton dress.",sizes:["S","M","L","XL"],colors:["Terracotta","Black"]},
 "cf4547e1-b242-4c9c-9dd3-f65ec851bfb6":{name:"Mini Weekend Set",category:"Kids",price:699,description:"Comfortable kids set.",sizes:["4Y","6Y","8Y","10Y"],colors:["Coral","Navy"]},
 "3cb85e55-1880-4c2d-933d-d93b3558d9c3":{name:"Daily Court Sneaker",category:"Footwear",price:1499,description:"Everyday court sneaker.",sizes:["6","7","8","9","10"],colors:["White","Black"]}
};
const el=document.getElementById("product");
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(v){return Number(v||0).toLocaleString("en-IN")}
function showError(m){el.innerHTML='<div class="product-details"><p class="eyebrow">PRODUCT</p><h1>Product unavailable</h1><p class="detail-desc">'+esc(m)+'</p><a class="primary-btn" href="shop.html">Back to shop →</a></div>'}
function renderProduct(product,variants=[]){
 const fallback=fallbackProducts[product.id]||{sizes:["S","M","L"],colors:["Default"]};
 const available=(variants||[]).filter(v=>Number(v.stock||0)>0);
 const dbSizes=[...new Set(available.map(v=>v.size).filter(Boolean))];
 const dbColors=[...new Set(available.map(v=>v.color).filter(Boolean))];
 const finalSizes=dbSizes.length?dbSizes:fallback.sizes;
 const finalColors=dbColors.length?dbColors:fallback.colors;
 let size=finalSizes[0],color=finalColors[0],qty=1,variantId=null;
 function findVariant(){const v=available.find(x=>(x.size||"")===size&&(x.color||"")===color);variantId=v?.id||null}
 findVariant();
 el.innerHTML='<div class="product-visual"><div class="product-image product-large"><span>APNA<br>EDIT</span></div></div><div class="product-details"><p class="eyebrow">'+esc(product.category||"PRODUCT").toUpperCase()+'</p><h1>'+esc(product.name)+'</h1><p class="detail-price">₹'+money(product.price)+'</p><p class="detail-desc">'+esc(product.description||"A carefully selected everyday product from Apna Store.")+'</p><div class="option"><b>Size</b><div class="option-list">'+finalSizes.map((x,j)=>'<button class="'+(j===0?"selected":"")+'" data-size="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div></div><div class="option"><b>Color: <span id="colorName">'+esc(color)+'</span></b><div class="option-list">'+finalColors.map((x,j)=>'<button class="swatch '+(j===0?"selected":"")+'" data-color="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div></div><div class="buy-row"><div class="qty"><button id="minus">−</button><span id="qty">1</span><button id="plus">+</button></div><button class="primary-btn" id="add">Add to bag <span>→</span></button></div><p class="product-note">✓ Secure payment &nbsp; ✓ Easy returns &nbsp; ✓ Delivery across India</p></div>';
 function refreshOptions(){findVariant();const add=document.getElementById("add");add.disabled=!variantId;add.textContent=variantId?"Add to bag →":"Select available size & color";if(variantId){const stock=available.find(x=>x.id===variantId)?.stock;if(stock&&qty>Number(stock))qty=Number(stock);document.getElementById("qty").textContent=qty}}
 document.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-size]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");size=b.dataset.size;refreshOptions()});
 document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-color]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");color=b.dataset.color;document.getElementById("colorName").textContent=color;refreshOptions()});
 document.getElementById("plus").onclick=()=>{const stock=available.find(x=>x.id===variantId)?.stock;if(stock&&qty>=Number(stock)){alert("Only "+Number(stock)+" item(s) are available for this variant.");return}qty++;document.getElementById("qty").textContent=qty};
 document.getElementById("minus").onclick=()=>{if(qty>1)qty--;document.getElementById("qty").textContent=qty};
 refreshOptions();
 document.getElementById("add").onclick=()=>{if(!variantId){alert("Please select an available size and color.");return}const cart=JSON.parse(localStorage.getItem("apnaCart")||"[]"),key=product.id+"-"+size+"-"+color,existing=cart.find(x=>x.key===key);if(existing)existing.qty+=qty;else cart.push({key,productId:product.id,variantId,name:product.name,category:product.category||"Product",price:Number(product.price),size,color,qty});localStorage.setItem("apnaCart",JSON.stringify(cart));location.href="cart.html"};
}
async function loadProduct(){
 if(!productId)return showError("Please choose a product from the shop.");
 const fallback=fallbackProducts[productId];
 if(!fallback)return showError("This product does not exist.");
 let product={id:productId,...fallback},variants=[];
 try{
  const {data,error}=await apnaSupabase.from("products").select("id,name,slug,description,price,category_id").eq("id",productId).eq("status","active").maybeSingle();
  if(!error&&data)product={...product,...data};
  const vr=await apnaSupabase.from("product_variants").select("id,size,color,sku,stock").eq("product_id",productId).order("size");
  if(!vr.error)variants=vr.data||[];
 }catch(e){console.error("Product detail load failed:",e)}
 renderProduct(product,variants);
}
loadProduct();