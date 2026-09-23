const form=document.getElementById("authForm");const email=document.getElementById("email");const password=document.getElementById("password");const fullName=document.getElementById("fullName");const title=document.getElementById("authTitle");const message=document.getElementById("authMessage");const submit=document.getElementById("authSubmit");const toggle=document.getElementById("toggleAuth");let signUpMode=false;
function setMode(){signUpMode=!signUpMode;title.textContent=signUpMode?"Create account.":"Sign in.";message.textContent=signUpMode?"Create your Apna Store customer account.":"Use your email and password to access your Apna Store account.";submit.textContent=signUpMode?"Create account →":"Sign in →";fullName.hidden=!signUpMode;fullName.required=signUpMode;toggle.textContent=signUpMode?"Already have an account? Sign in":"Create a new account";}
toggle.addEventListener("click",setMode);
function captureReferralCode(){const code=new URLSearchParams(location.search).get("ref");if(code)localStorage.setItem("apnaReferralCode",code.trim().toUpperCase());}
captureReferralCode();
async function claimReferral(userId){const code=localStorage.getItem("apnaReferralCode");if(!code)return;const r=await apnaSupabase.rpc("claim_referral_code",{p_code:code});if(!r.error||/already|first order/i.test(r.error.message||""))localStorage.removeItem("apnaReferralCode");}
function readGuestWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
async function migrateGuestWishlist(userId){
  const saved=readGuestWishlist();
  const ids=[...new Set(saved.map(x=>x.productId).filter(id=>/^[0-9a-f-]{36}$/i.test(String(id))))];
  if(!ids.length)return true;
  const {data,error}=await apnaSupabase.from("products").select("id").in("id",ids).eq("status","active");
  if(error)throw error;
  const valid=new Set((data||[]).map(p=>p.id));
  const rows=ids.filter(id=>valid.has(id)).map(product_id=>({user_id:userId,product_id}));
  if(rows.length){
    const {error:insertError}=await apnaSupabase.from("wishlists").upsert(rows,{onConflict:"user_id,product_id",ignoreDuplicates:true});
    if(insertError)throw insertError;
  }
  const unsynced=saved.filter(item=>{const id=String(item.productId||"");return !valid.has(id);});
  if(unsynced.length)localStorage.setItem("apnaWishlist",JSON.stringify(unsynced));else localStorage.removeItem("apnaWishlist");
  return true;
}
function getPostAuthDestination(){const next=sessionStorage.getItem("apnaReturnAfterAuth");if(next==="checkout.html"||next==="account.html"){sessionStorage.removeItem("apnaReturnAfterAuth");return next}return "account.html"}
(async()=>{const {data}=await apnaSupabase.auth.getSession();if(data.session)location.href=getPostAuthDestination();})();
form.addEventListener("submit",async(e)=>{e.preventDefault();submit.disabled=true;message.textContent="Please wait…";try{let result;if(signUpMode){result=await apnaSupabase.auth.signUp({email:email.value.trim(),password:password.value,options:{data:{full_name:fullName.value.trim()}}});}else{result=await apnaSupabase.auth.signInWithPassword({email:email.value.trim(),password:password.value});}if(result.error)throw result.error;if(signUpMode&&!result.data.session){message.textContent="Account created. Check your email to confirm, then sign in.";setMode();}else{try{await claimReferral(result.data.user.id);await migrateGuestWishlist(result.data.user.id);}catch(migrateError){console.error("Guest wishlist migration failed:",migrateError);message.textContent="Signed in, but your saved wishlist could not be synced yet. Your guest wishlist is still on this device.";}location.href=getPostAuthDestination();}}catch(err){message.textContent=err.message||"Something went wrong. Please try again.";}finally{submit.disabled=false;}});
