const list=document.getElementById("ordersList");
function money(n){return "₹"+Number(n||0).toLocaleString("en-IN")}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderOrders(orders){
  list.innerHTML=orders.length?orders.map(o=>{
    const items=o.order_items||[];
    const subtotal=Number(o.subtotal??items.reduce((s,x)=>s+Number(x.unit_price||0)*Number(x.quantity||1),0));
    const delivery=Number(o.delivery_fee||0);
    const total=Number(o.total??subtotal+delivery);
    const date=o.created_at;
    return '<article class="checkout-card"><p class="eyebrow">ORDER</p><h2>'+esc(o.order_number||"Order")+'</h2><div class="summary-line"><span>Status</span><b>'+esc(o.status||"placed")+'</b></div><div class="summary-line"><span>Payment status</span><b>'+esc(o.payment_status||"pending")+'</b></div>'+items.map(x=>'<div class="summary-line"><span>'+esc(x.product_name||"Product")+' × '+Number(x.quantity||1)+'<small>Price: '+money(x.unit_price)+'</small></span><b>'+money(Number(x.unit_price||0)*Number(x.quantity||1))+'</b></div>').join("")+'<div class="summary-line"><span>Subtotal</span><b>'+money(subtotal)+'</b></div><div class="summary-line"><span>Delivery</span><b>'+money(delivery)+'</b></div><div class="summary-total"><span>Total</span><b>'+money(total)+'</b></div><p class="checkout-note">Order date: '+esc(new Date(date).toLocaleString("en-IN"))+'</p></article>';
  }).join(""):'<div class="empty-cart"><h2>No orders yet.</h2><p>Your account orders will appear here after you place an order.</p><a class="primary-btn" href="shop.html">Start shopping →</a></div>';
}
(async()=>{
  const {data:{session}}=await apnaSupabase.auth.getSession();
  if(!session){
    list.innerHTML='<div class="empty-cart"><h2>Sign in to view your orders.</h2><p>Your order history is securely connected to your Apna Store account.</p><a class="primary-btn" href="auth.html">Sign in / Create account →</a></div>';
    return;
  }
  const {data,error}=await apnaSupabase.from("orders").select("id,order_number,status,payment_status,subtotal,delivery_fee,total,created_at,order_items(product_name,unit_price,quantity)").eq("user_id",session.user.id).order("created_at",{ascending:false});
  if(error){
    console.error(error);
    list.innerHTML='<div class="empty-cart"><h2>Could not load orders.</h2><p>Please refresh and try again.</p></div>';
    return;
  }
  renderOrders(data||[]);
})();