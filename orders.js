const list=document.getElementById("ordersList");
function money(n){return "₹"+Number(n||0).toLocaleString("en-IN")}
function esc(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function statusLabel(s){return String(s||"placed").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
function renderOrders(orders){
 list.innerHTML=orders.length?orders.map(o=>{
  const items=o.order_items||[], date=o.created_at;
  return '<article class="checkout-card"><p class="eyebrow">ORDER</p><h2>'+esc(o.order_number)+'</h2><div class="summary-line"><span>Order status</span><b>'+esc(statusLabel(o.status))+'</b></div><div class="summary-line"><span>Payment</span><b>'+esc(o.payment_method==="cod"?"Cash on Delivery":(o.payment_method||"Online"))+' · '+esc(statusLabel(o.payment_status))+'</b></div>'+items.map(x=>'<div class="summary-line"><span>'+esc(x.product_name)+' × '+Number(x.quantity||1)+'</span><b>'+money(Number(x.unit_price||0)*Number(x.quantity||1))+'</b></div>').join("")+'<div class="summary-line"><span>Subtotal</span><b>'+money(o.subtotal)+'</b></div>'+(Number(o.discount_amount)>0?'<div class="summary-line"><span>Coupon'+(o.coupon_code?" ("+esc(o.coupon_code)+")":"")+'</span><b>−'+money(o.discount_amount)+'</b></div>':"")+'<div class="summary-line"><span>Delivery</span><b>'+(Number(o.delivery_fee)?money(o.delivery_fee):"FREE")+'</b></div><div class="summary-total"><span>Total</span><b>'+money(o.total)+'</b></div><p class="checkout-note">Placed '+esc(new Date(date).toLocaleString("en-IN"))+'</p><a class="primary-btn" href="order-detail.html?id='+encodeURIComponent(o.id)+'">View order details →</a></article>';
 }).join(""):'<div class="empty-cart"><h2>No orders yet.</h2><p>Your account orders will appear here after you place an order.</p><a class="primary-btn" href="shop.html">Start shopping →</a></div>';
}
(async()=>{
 const {data:{session}}=await apnaSupabase.auth.getSession();
 if(!session){list.innerHTML='<div class="empty-cart"><h2>Sign in to view your orders.</h2><p>Your order history is securely connected to your Apna Store account.</p><a class="primary-btn" href="auth.html">Sign in / Create account →</a></div>';return}
 const {data,error}=await apnaSupabase.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,discount_amount,coupon_code,delivery_fee,total,created_at,order_items(product_name,unit_price,quantity)").eq("user_id",session.user.id).order("created_at",{ascending:false});
 if(error){console.error(error);list.innerHTML='<div class="empty-cart"><h2>Could not load orders.</h2><p>Please refresh and try again.</p></div>';return}
 renderOrders(data||[]);
})();