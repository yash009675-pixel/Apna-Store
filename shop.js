let products=[];let selected="All";
const root=document.getElementById("shopProducts"),count=document.getElementById("cartCount");
function readCart(){try{const c=JSON.parse(localStorage.getItem("apnaCart")||"[]");return Array.isArray(c)?c:[]}catch{return[]}}
function cart(){if(count)count.textContent=readCart().reduce((n,x)=>n+(Number(x.qty)||0),0)}
function readWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
async function loadProducts(){
 root.innerHTML='<p class="checkout-note">Loading Apna products…</p>';
 const {data,error}=await apnaSupabase.from("products").select("id,name,slug,description,price,category_id,categories(name)").eq("status","active").order("created_at",{ascending:true});
 if(error){console.error(error);root.innerHTML='<p>Could not load products right now. Please refresh.</p>';return}
 products=(data||[]).map(p=>({...p,category:p.categories?.name||"Apna Store"}));
 render();
}
function render(){
 let list=products.filter(p=>selected==="All"||p.category===selected);
 const s=document.getElementById("sort").value;
 if(s==="low")list.sort((a,b)=>Number(a.price)-Number(b.price));
 if(s==="high")list.sort((a,b)=>Number(b.price)-Number(a.price));
 const w=readWishlist();
 root.innerHTML=list.length?list.map(p=>{
  const saved=w.some(item=>item.productId===p.id||item.name===p.name);
  return '<article class="product-card"><div class="product-image"><button aria-label="'+(saved?"Remove from wishlist":"Add to wishlist")+'" onclick="wishlist(\''+p.id+'\')">'+(saved?"♥":"♡")+'</button></div><div class="product-info"><a href="product.html?id='+encodeURIComponent(p.id)+'" style="text-decoration:none;color:inherit"><h3>'+p.name+'</h3><p>'+p.category+'</p><p class="price">₹'+Number(p.price).toLocaleString("en-IN")+'</p></a><button class="primary-btn add" onclick="add(\''+p.id+'\')" style="margin-top:12px;padding:10px 13px;font-size:11px;gap:15px">Add to bag →</button></div></article>';
 }).join(""):'<p>No products found.</p>';
}
function add(id){const p=products.find(x=>x.id===id);if(!p)return;const c=readCart(),e=c.find(x=>x.productId===p.id);e?e.qty++:c.push({productId:p.id,name:p.name,category:p.category,price:Number(p.price),qty:1});localStorage.setItem("apnaCart",JSON.stringify(c));cart()}
function wishlist(id){const p=products.find(x=>x.id===id);if(!p)return;const w=readWishlist(),at=w.findIndex(x=>x.productId===p.id||x.name===p.name);if(at>=0)w.splice(at,1);else w.push({name:p.name,category:p.category,price:Number(p.price),productId:p.id});localStorage.setItem("apnaWishlist",JSON.stringify(w));render()}
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");selected=b.dataset.cat;render()});
document.getElementById("sort").onchange=render;
document.getElementById("searchBtn")?.addEventListener("click",()=>location.href="search.html");
loadProducts();cart();