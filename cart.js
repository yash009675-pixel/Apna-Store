const box=document.getElementById("cart");

function readCart(){
  try{
    const data=JSON.parse(localStorage.getItem("apnaCart")||"[]");
    if(!Array.isArray(data)) return [];
    return data.filter(item=>item&&item.name).map(item=>({
      ...item,
      price:Number(item.price)||0,
      qty:Math.max(1,Number(item.qty)||1)
    }));
  }catch(error){
    console.error("Cart data could not be read:",error);
    return [];
  }
}
function saveCart(cart){localStorage.setItem("apnaCart",JSON.stringify(cart));}
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
  if(item.qty<=0)cart.splice(index,1);
  saveCart(cart);
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
draw();