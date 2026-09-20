const el=document.getElementById("orderText"),link=document.getElementById("detailsLink");
(async()=>{
 try{
  const saved=JSON.parse(localStorage.getItem("apnaLastOrder")||"null");
  const {data:{session}}=await apnaSupabase.auth.getSession();
  if(!session){el.textContent="Your order was placed, but you need to sign in to view its details.";return}
  const id=saved?.dbId;
  if(!id){el.textContent="Your order was placed successfully. Open Orders to view your account history.";return}
  const {data:o,error}=await apnaSupabase.from("orders").select("id,order_number,total,payment_method,payment_status").eq("id",id).eq("user_id",session.user.id).maybeSingle();
  if(error||!o){el.textContent="Your order was placed successfully. Open Orders to view the saved order.";return}
  link.href="order-detail.html?id="+encodeURIComponent(o.id);
  el.textContent="Order "+o.order_number+" has been saved to your account. Total: ₹"+Number(o.total||0).toLocaleString("en-IN")+" · "+(o.payment_method==="cod"?"Cash on Delivery":"Online payment")+" · "+String(o.payment_status||"pending").replace(/_/g," ")+"."; 
 }catch(error){console.error(error);el.textContent="Your order was placed successfully. Open Orders to view the saved order."}
})();