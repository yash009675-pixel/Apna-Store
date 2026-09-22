const $=id=>document.getElementById(id),money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
async function boot(){
  const {data,error}=await apnaSupabase.auth.getSession();
  if(error||!data.session){location.href="auth.html";return}
  const {data:p}=await apnaSupabase.from("profiles").select("role").eq("id",data.session.user.id).single();
  if(!p||p.role!=="seller"){location.href="account.html";return}
  const {data:m,error:me}=await apnaSupabase.rpc("seller_payment_metrics");
  if(me){$("msg").textContent=me.message;$("msg").className="note error";return}
  for(const [id,key] of Object.entries({gross:"gross_sales",commission:"commission",shipping:"shipping_charges",refund:"refund_deductions",net:"net_earnings",pending:"pending_earnings",available:"available_balance",paid:"payout_amount"}))$(id).textContent=money(m[key]);
  const {data:s}=await apnaSupabase.from("seller_settlements").select("period_start,period_end,gross_sales,commission,marketplace_fee,shipping_charges,refund_deductions,net_earnings,status").eq("seller_id",data.session.user.id).order("created_at",{ascending:false});
  $("settlements").innerHTML=s?.length?'<table class="table"><tr><th>Period</th><th>Sales</th><th>Commission</th><th>Shipping</th><th>Refunds</th><th>Net</th><th>Status</th></tr>'+s.map(x=>'<tr><td>'+x.period_start+' → '+x.period_end+'</td><td>'+money(x.gross_sales)+'</td><td>'+money(x.commission)+'</td><td>'+money(x.shipping_charges)+'</td><td>'+money(x.refund_deductions)+'</td><td>'+money(x.net_earnings)+'</td><td>'+x.status+'</td></tr>').join("")+'</table>':'<p class="note">No settlements yet.</p>';
  const {data:po}=await apnaSupabase.from("seller_payouts").select("amount,status,provider,provider_reference,requested_at,paid_at").eq("seller_id",data.session.user.id).order("created_at",{ascending:false});
  $("payouts").innerHTML=po?.length?'<table class="table"><tr><th>Amount</th><th>Status</th><th>Provider</th><th>Reference</th><th>Requested</th><th>Paid</th></tr>'+po.map(x=>'<tr><td>'+money(x.amount)+'</td><td>'+x.status+'</td><td>'+String(x.provider??"—")+'</td><td>'+String(x.provider_reference??"—")+'</td><td>'+new Date(x.requested_at).toLocaleString("en-IN")+'</td><td>'+(x.paid_at?new Date(x.paid_at).toLocaleString("en-IN"):"—")+'</td></tr>').join("")+'</table>':'<p class="note">No payout requests yet.</p>';
  const {data:inv}=await apnaSupabase.from("seller_invoices").select("invoice_number,amount,status,issued_at").eq("seller_id",data.session.user.id).order("issued_at",{ascending:false});
  $("invoices").innerHTML=inv?.length?'<table class="table"><tr><th>Invoice</th><th>Amount</th><th>Status</th><th>Issued</th></tr>'+inv.map(x=>'<tr><td>'+x.invoice_number+'</td><td>'+money(x.amount)+'</td><td>'+x.status+'</td><td>'+new Date(x.issued_at).toLocaleString("en-IN")+'</td></tr>').join("")+'</table>':'<p class="note">No invoices yet.</p>';
}
$("payoutForm").onsubmit=async e=>{e.preventDefault();$("msg").textContent="Submitting…";const {error}=await apnaSupabase.rpc("seller_request_payout",{p_amount:Number($("amount").value)});if(error){$("msg").textContent=error.message;$("msg").className="note error";return}$("msg").textContent="Payout request submitted for admin review.";e.target.reset();boot()};
boot();