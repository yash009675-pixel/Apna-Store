let products=[];const root=document.getElementById("products");
function getCart(){try{const c=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(c)?c:[]}catch{return[]}}
function updateHeader(){const c=getCart();const n=c.reduce((s,x)=>s+(Number(x.qty)||0),0);const el=document.getElementById("cartCount");if(el)el.textContent=n}
function getWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadProducts(){
 if(!root)return;
 root.innerHTML='<p class="checkout-note">Loading products…</p>';
 const [productResult,categoryResult]=await Promise.all([
  apnaSupabase.from("products").select("id,name,price,category_id").eq("status","active").order("created_at",{ascending:true}).limit(4),
  apnaSupabase.from("categories").select("id,name")
 ]);
 if(productResult.error){console.error("Homepage product query failed:",productResult.error);root.innerHTML='<p class="checkout-note">Products could not be loaded right now. Please refresh and try again.</p>';return}
 if(categoryResult.error)console.warn("Homepage category query failed:",categoryResult.error);
 const categories=new Map((categoryResult.data||[]).map(c=>[c.id,c.name]));
 products=(productResult.data||[]).map(p=>({...p,type:categories.get(p.category_id)||"Apna Store"}));
 render();
}
function render(){if(!root)return;const w=getWishlist();root.innerHTML=products.length?products.map((p,i)=>{const saved=w.some(x=>x.productId===p.id||x.name===p.name);return '<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><div class="product-image"><button aria-label="'+(saved?"Remove from wishlist":"Add to wishlist")+'" onclick="event.preventDefault();event.stopPropagation();toggleWish(products['+i+'])">'+(saved?"♥":"♡")+'</button></div><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.type)+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p></div></a><button class="primary-btn add" data-i="'+i+'" style="margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">View options →</button></article>'}).join(""):'<p>No products available yet.</p>';document.querySelectorAll(".add").forEach(b=>b.onclick=()=>location.href="product.html?id="+encodeURIComponent(products[Number(b.dataset.i)].id))}
function toggleWish(p){let w=getWishlist();const i=w.findIndex(x=>x.productId===p.id||x.name===p.name);if(i>=0)w.splice(i,1);else w.push({productId:p.id,name:p.name,category:p.type,price:Number(p.price)});localStorage.setItem("apnaWishlist",JSON.stringify(w));render()}
loadProducts();updateHeader();const search=document.getElementById("searchBtn");if(search)search.onclick=()=>location.href="search.html";const cartBtn=document.getElementById("cartBtn");if(cartBtn)cartBtn.onclick=()=>location.href="cart.html";