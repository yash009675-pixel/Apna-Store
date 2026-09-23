const adminCenter=$=>document.getElementById($);
const adminMoney=v=>"₹"+Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2});

async function bootAdminCenter(){
  const {data:{session},error:sessionError}=await apnaSupabase.auth.getSession();
  if(sessionError||!session){location.href="auth.html";return}
  const {data:profile,error:profileError}=await apnaSupabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
  if(profileError||profile?.role!=="admin"){location.href="account.html";return}
  await loadAdminCenter();
}

async function loadAdminCenter(){
  const message=adminCenter("adminCenterMessage");
  const content=adminCenter("adminCenterContent");
  message.textContent="Loading dashboard…";
  content.hidden=true;
  const {data,error}=await apnaSupabase.rpc("admin_get_center_dashboard");
  if(error){message.textContent="Could not load admin dashboard: "+error.message;message.className="admin-message admin-error";return}
  if(!data){message.textContent="Admin dashboard data is unavailable for this account.";message.className="admin-message admin-error";return}
  const cards=[
    ["GMV",adminMoney(data.gmv),"Gross value of non-cancelled orders"],
    ["Sales",adminMoney(data.sales),"Order subtotal on non-cancelled orders"],
    ["Orders",Number(data.orders||0),"All orders recorded"],
    ["Customers",Number(data.customers||0),"Customer profiles"],
    ["Sellers",Number(data.sellers||0),"Seller profiles"],
    ["Products",Number(data.products||0),"All product records"],
    ["Shipments",Number(data.shipments||0),"All shipment records"],
    ["Returns",Number(data.returns||0),"Return requests"],
    ["Refunds",Number(data.refunds||0),"Return requests with refund status"],
    ["Support Tickets",Number(data.support_tickets||0),"Support tickets"],
    ["Revenue",adminMoney(data.revenue),"Successful/captured payment transactions"]
  ];
  content.innerHTML='<div class="admin-center-cards">'+cards.map(x=>'<article class="admin-center-card"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>').join("")+'</div>';
  message.textContent="Live database metrics";
  message.className="admin-message";
  content.hidden=false;
}

document.addEventListener("DOMContentLoaded",()=>bootAdminCenter());