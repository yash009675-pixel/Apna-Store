const $=id=>document.getElementById(id);
async function boot(){const {data:s,error}=await apnaSupabase.auth.getSession();if(error||!s.session){location.href="auth.html";return;}const user=s.session.user;
const p=await apnaSupabase.from("profiles").select("full_name,phone,role").eq("id",user.id).single();if(p.error){$("status").textContent=p.error.message;return;}
if(["seller","admin"].includes(p.data.role)){location.href="seller-dashboard.html";return;}
$("fullName").value=p.data.full_name||user.user_metadata?.full_name||"";$("phone").value=p.data.phone||"";
const a=await apnaSupabase.from("seller_applications").select("id,status,store_name,business_type,city,state,submitted_at,rejection_reason").eq("user_id",user.id).order("submitted_at",{ascending:false}).limit(1).maybeSingle();
if(a.error){$("status").textContent=a.error.message;return;}
if(a.data){renderStatus(a.data);if(a.data.status==="rejected")$("sellerForm").hidden=false;}else{$("status").textContent="No seller application yet. Submit your store details below.";$("sellerForm").hidden=false;}
}
function renderStatus(a){const when=new Date(a.submitted_at).toLocaleDateString("en-IN");let text=a.status==="pending"?"Your seller application is pending review.":"Your seller application was "+a.status+" on "+when+".";if(a.status==="rejected"&&a.rejection_reason)text+=" Reason: "+a.rejection_reason;$("status").textContent=text;$("status").className="seller-status "+(a.status==="approved"?"seller-success":a.status==="rejected"?"seller-error":"");}
$("sellerForm").addEventListener("submit",async e=>{e.preventDefault();$("submit").disabled=true;$("status").className="seller-status";$("status").textContent="Submitting…";
const r=await apnaSupabase.rpc("submit_seller_application",{p_full_name:$("fullName").value.trim(),p_phone:$("phone").value.trim(),p_store_name:$("storeName").value.trim(),p_business_type:$("businessType").value,p_description:$("description").value.trim(),p_city:$("city").value.trim(),p_state:$("state").value.trim()});
if(r.error){$("status").className="seller-status seller-error";$("status").textContent=r.error.message;$("submit").disabled=false;return;}
$("sellerForm").hidden=true;$("status").className="seller-status seller-success";$("status").textContent="Application submitted successfully. It is now pending review.";
});
boot();