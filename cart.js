const box=document.getElementById("cart");

function readCart(){
  try{
    const data=JSON.parse(localStorage.getItem("apnaCart")||"[]");
    if(!Array.isArray(data)) return [];
    return normalizeCart(data.filter(item=>item&&item.name).map(item=>({
      ...item,
      price:Number(item.price)||0,
      qty:Math.max(1,Number(item.qty)||1)
    })));
  }catch(error){
    console.error("Cart data could not be read:",error);
    return [];
  }
}
function saveCart(cart){localStorage.setItem("apnaCart",JSON.stringify(cart));}
function cartKey(item){return item.key||[item.productId,item.variantId,item.size||"",item.color||""].join("|");}
function normalizeCart(cart){const merged=new Map();for(const item of cart){const key=cartKey(item),qty=Math.max(1,Number(item.qty)||1);if(merged.has(key)){merged.get(key).qty+=qty;}else merged.set(key,{...item,key,qty});}return [...merged.values()];}
async function syncCartWithCatalog(){
  const cart=readCart(); if(!cart.length||typeof apnaSupabase==="undefined") return;
  const ids=[...new Set(cart.map(x=>x.productId).filter(Boolean))];
  if(!ids.length)return;
  const [{data:products,error:pe},{data:variants,error:ve}]=await Promise.all([
    apnaSupabase.from("products").select("id,name,price,category_id,status").in("id",ids),
    apnaSupabase.from("product_variants").select("id,product_id,size,color,stock").in("product_id",ids)
  ]);
  if(pe||ve){console.error("Cart catalog sync failed:",pe||ve);return;}
  const productMap=new Map((products||[]).map(p=>[p.id,p]));
  const variantMap=new Map((variants||[]).map(v=>[v.id,v]));
  const next=[];
  for(const item of cart){
    const product=productMap.get(item.productId),variant=variantMap.get(item.variantId);
    if(!product||product.status!=="active"||!variant||variant.product_id!==item.productId||Number(variant.stock)<=0) continue;
    const maxStock=Number(variant.stock);
    const qty=Math.min(Math.max(1,Number(item.qty)||1),maxStock);
    next.push({...item,name:product.name,category:item.category||"Apna Store",price:Number(product.price),size:variant.size||"",color:variant.color||"",qty});
  }
  saveCart(normalizeCart(next));
}

async function trackAbandonedCart(){try{if(typeof apnaSupabase==="undefined")return;const {data:{session}}=await apnaSupabase.auth.getSession();if(!session)return;const cart=readCart();const subtotal=cart.reduce((sum,item)=>sum+Number(item.price||0)*Number(item.qty||1),0);if(cart.length){const payload=cart.map(item=>({product_id:item.productId||null,variant_id:item.variantId||null,quantity:Number(item.qty||1),price:Number(item.price||0),name:item.name||"Product"}));await apnaSupabase.rpc("track_abandoned_cart",{p_cart:payload,p_subtotal:subtotal,p_checkout_started:false});await apnaSupabase.rpc("record_abandoned_cart_event",{p_type:"cart_tracked",p_channel:"in_app"});}}catch(error){console.warn("Abandoned cart tracking unavailable:",error)}}
function money(value){return "₹"+Number(value||0).toLocaleString("en-IN");}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function draw(){
  if(!box) return;
  const cart=readCart();
  if(!cart.length){
    box.innerHTML='<div class="empty-cart">Your bag is empty. <a href="shop.html">Start shopping →</a></div>';
    return;
  }
  const subtotal=cart.reduce((sum,item)=>sum+item.price*item.qty,0);
  const shipping=subtotal>=999?0:49;
  box.innerHTML='<div class="cart-layout"><div class="cart-items">'+cart.map((item,index)=>'<article class="cart-item"><div class="cart-thumb"><span>'+escapeHtml(item.name)+'</span></div><div class="cart-product"><h3>'+escapeHtml(item.name)+'</h3><p>'+escapeHtml(item.category||"Apna Store")+'</p><p>'+escapeHtml([item.size,item.color].filter(Boolean).join(" · "))+'</p><b>'+money(item.price)+'</b><div class="cart-controls"><button type="button" onclick="changeCartQty('+index+',-1)">−</button><span>'+item.qty+'</span><button type="button" onclick="changeCartQty('+index+',1)">+</button><button type="button" class="remove-btn" onclick="removeCartItem('+index+')">Remove</button></div></div></article>').join("")+'</div><aside class="cart-summary"><p class="eyebrow">SUMMARY</p><div><span>Subtotal</span><b>'+money(subtotal)+'</b></div><div><span>Delivery</span><b>'+(shipping?money(shipping):"FREE")+'</b></div><small>Free delivery on orders over ₹999.</small><div class="summary-total"><span>Total</span><b>'+money(subtotal+shipping)+'</b></div><a class="primary-btn" href="checkout.html">Proceed to checkout →</a></aside></div>';
}

async function changeCartQty(index,direction){
  const cart=readCart();
  const item=cart[index];
  if(!item) return;
  if(direction>0 && item.productId){
    if(!item.variantId){
      alert("Please remove this item and add it again with a valid size and color.");
      return;
    }
    if(typeof apnaSupabase==="undefined"){
      alert("Stock verification is temporarily unavailable. Please refresh and try again.");
      return;
    }
    const {data:variant,error}=await apnaSupabase.from("product_variants").select("stock").eq("id",item.variantId).eq("product_id",item.productId).maybeSingle();
    if(error||!variant){
      alert("We couldn't verify this item's stock. Please try again.");
      return;
    }
    if(item.qty+1>Number(variant.stock)){
      alert("Only "+Number(variant.stock)+" item(s) are available for this variant.");
      return;
    }
  }
  item.qty+=direction;
  if(item.qty<=0){cart.splice(index,1);saveCart(normalizeCart(cart));draw();return;}
  saveCart(normalizeCart(cart));
  await syncCartWithCatalog();
  draw();
}

function removeCartItem(index){
  const cart=readCart();
  if(!cart[index]) return;
  cart.splice(index,1);
  saveCart(cart);
  draw();
}

window.changeCartQty=changeCartQty;
window.removeCartItem=removeCartItem;
window.addEventListener("storage",event=>{if(event.key==="apnaCart")draw()});
(async()=>{await syncCartWithCatalog();draw();await trackAbandonedCart()})();