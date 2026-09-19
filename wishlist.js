const grid=document.getElementById("wishlistGrid");

function money(n){return "₹"+Number(n||0).toLocaleString("en-IN");}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function readLocal(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
function writeLocal(w){localStorage.setItem("apnaWishlist",JSON.stringify(w));}

async function getSession(){
  const {data}=await apnaSupabase.auth.getSession();
  return data?.session||null;
}

function renderEmpty(message="Your wishlist is empty."){
  grid.innerHTML='<div class="empty-cart"><h2>'+escapeHtml(message)+'</h2><p>Save pieces you love and find them here later.</p><a class="primary-btn" href="shop.html">Explore products →</a></div>';
}

function renderProducts(products){
  if(!products.length){renderEmpty();return;}
  grid.innerHTML=products.map(p=>{
    const category=Array.isArray(p.categories)?p.categories[0]?.name:p.categories?.name;
    return '<article class="product-card"><a href="product.html?id='+encodeURIComponent(p.id)+'"><div class="product-image wishlist-image"><span>'+escapeHtml(p.name)+'</span></div></a><div class="product-info"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(category||"Product")+'</p><p class="price">'+money(p.price)+'</p><button class="text-btn" data-remove="'+escapeHtml(p.id)+'">Remove from wishlist</button></div></article>';
  }).join("");

  grid.querySelectorAll("[data-remove]").forEach(button=>{
    button.onclick=()=>removeWishlist(button.dataset.remove);
  });
}

async function renderCloud(session){
  const {data,error}=await apnaSupabase
    .from("wishlists")
    .select("product_id,products(id,name,price,categories(name))")
    .eq("user_id",session.user.id);

  if(error){
    console.error("Wishlist load failed:",error);
    renderLocal();
    return;
  }

  renderProducts((data||[]).map(row=>row.products).filter(Boolean));
}

function renderLocal(){
  const saved=readLocal();
  const ids=saved.map(item=>item.productId).filter(Boolean);
  if(!ids.length){
    const names=saved.map(item=>item.name).filter(Boolean);
    if(!names.length){renderEmpty();return;}
    renderProducts(saved.map((item,index)=>({
      id:"legacy-"+index,name:item.name,price:item.price,categories:{name:item.category}
    })));
    return;
  }

  apnaSupabase.from("products")
    .select("id,name,price,categories(name)")
    .in("id",ids)
    .eq("status","active")
    .then(({data,error})=>{
      if(error){console.error(error);renderProducts(saved.map(item=>({id:item.productId,name:item.name,price:item.price,categories:{name:item.category}})));return;}
      renderProducts(data||[]);
    });
}

async function removeWishlist(productId){
  const session=await getSession();
  if(session && !productId.startsWith("legacy-")){
    const {error}=await apnaSupabase.from("wishlists").delete().eq("user_id",session.user.id).eq("product_id",productId);
    if(error){console.error("Wishlist remove failed:",error);return;}
    await load();
    return;
  }
  writeLocal(readLocal().filter(item=>String(item.productId)!==String(productId)));
  await load();
}

async function load(){
  const session=await getSession();
  if(session){await renderCloud(session);return;}
  renderLocal();
}

load();