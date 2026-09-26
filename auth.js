const form=document.getElementById("authForm");const email=document.getElementById("email");const password=document.getElementById("password");const fullName=document.getElementById("fullName");const otp=document.getElementById("otp");const title=document.getElementById("authTitle");const message=document.getElementById("authMessage");const submit=document.getElementById("authSubmit");const toggle=document.getElementById("toggleAuth");const google=document.getElementById("googleAuth");const otpRow=document.getElementById("otpRow");const verify=document.getElementById("verifyOtp");let signUpMode=false;let routing=false;

function setMode(){signUpMode=!signUpMode;title.textContent=signUpMode?"Create account.":"Sign in.";message.textContent=signUpMode?"Create your Apna Store customer account.":"Sign in as a customer or administrator to access Apna Store.";submit.textContent=signUpMode?"Create account →":"Sign in →";fullName.hidden=!signUpMode;fullName.required=signUpMode;toggle.textContent=signUpMode?"Already have an account? Sign in":"Create a new account";password.autocomplete=signUpMode?"new-password":"current-password";}
toggle.addEventListener("click",setMode);

function captureReferralCode(){const code=new URLSearchParams(location.search).get("ref");if(code)localStorage.setItem("apnaReferralCode",code.trim().toUpperCase());}
captureReferralCode();

async function claimReferral(userId){const code=localStorage.getItem("apnaReferralCode");if(!code)return;const r=await apnaSupabase.rpc("claim_referral_code",{p_code:code});if(!r.error||/already|first order/i.test(r.error.message||""))localStorage.removeItem("apnaReferralCode");}

function readGuestWishlist(){try{const w=JSON.parse(localStorage.getItem("apnaWishlist")||"[]");return Array.isArray(w)?w:[]}catch{return[]}}
async function migrateGuestWishlist(userId){const saved=readGuestWishlist();const ids=[...new Set(saved.map(x=>x.productId).filter(id=>/^[0-9a-f-]{36}$/i.test(String(id))))];if(!ids.length)return true;const {data,error}=await apnaSupabase.from("products").select("id").in("id",ids).eq("status","active");if(error)throw error;const valid=new Set((data||[]).map(p=>p.id));const rows=ids.filter(id=>valid.has(id)).map(product_id=>({user_id:userId,product_id}));if(rows.length){const {error:insertError}=await apnaSupabase.from("wishlists").upsert(rows,{onConflict:"user_id,product_id",ignoreDuplicates:true});if(insertError)throw insertError;}const unsynced=saved.filter(item=>!valid.has(String(item.productId||"")));if(unsynced.length)localStorage.setItem("apnaWishlist",JSON.stringify(unsynced));else localStorage.removeItem("apnaWishlist");return true;}

function getPostAuthDestination(){const next=sessionStorage.getItem("apnaReturnAfterAuth");if(next==="checkout.html"||next==="account.html"){sessionStorage.removeItem("apnaReturnAfterAuth");return next}return"account.html"}

async function routeUser(user){
 if(!user||routing)return;
 routing=true;
 let role="customer";
 try{const {data}=await apnaSupabase.from("profiles").select("role").eq("id",user.id).maybeSingle();role=data?.role||"customer";}catch(e){console.error("Role lookup failed:",e)}
 location.href=role==="admin"?"admin.html":getPostAuthDestination();
}

async function finishAuthenticatedUser(user){
 if(!user)return;
 try{await claimReferral(user.id);try{await migrateGuestWishlist(user.id)}catch(e){console.error("Guest wishlist migration failed:",e)}}catch(e){console.error("Post-auth setup failed:",e)}
 await routeUser(user);
}

async function startGoogle(){
 if(!google)return;
 google.disabled=true;
 message.textContent="Opening Google…";
 try{
   const redirectTo=location.origin+location.pathname;
   const {error}=await apnaSupabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
   if(error)throw error;
 }catch(err){
   console.error("Google sign-in failed:",err);
   google.disabled=false;
   message.textContent=err.message||"Google sign-in could not start. Please try again.";
 }
}
google?.addEventListener("click",startGoogle);

apnaSupabase.auth.onAuthStateChange((event,session)=>{
 if(event==="SIGNED_IN"&&session?.user)finishAuthenticatedUser(session.user).catch(err=>{routing=false;console.error("Google sign-in completion failed:",err);message.textContent=err.message||"Could not complete Google sign-in."});
});

(async()=>{
 const params=new URLSearchParams(location.search);
 const oauthError=params.get("error_description")||params.get("error");
 if(oauthError){message.textContent=decodeURIComponent(oauthError.replace(/\+/g," "));return}
 const {data,error}=await apnaSupabase.auth.getSession();
 if(error){message.textContent=error.message||"Could not load your session.";return}
 if(data.session)await routeUser(data.session.user);
})();

form.addEventListener("submit",async e=>{e.preventDefault();submit.disabled=true;message.textContent="Please wait…";try{if(signUpMode){const result=await apnaSupabase.auth.signUp({email:email.value.trim(),password:password.value,options:{data:{full_name:fullName.value.trim()}}});if(result.error)throw result.error;otpRow.hidden=false;otp.required=true;verify.hidden=false;submit.hidden=true;message.textContent="We sent a 6-digit verification code from Apna Store. Enter it below.";return;}const result=await apnaSupabase.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(result.error)throw result.error;await finishAuthenticatedUser(result.data.user);}catch(err){message.textContent=err.message||"Something went wrong. Please try again.";}finally{submit.disabled=false;}});

verify?.addEventListener("click",async()=>{verify.disabled=true;message.textContent="Verifying code…";try{const {data,error}=await apnaSupabase.auth.verifyOtp({email:email.value.trim(),token:otp.value.trim(),type:"signup"});if(error)throw error;if(!data.user)throw new Error("Verification failed. Please request a new code.");await finishAuthenticatedUser(data.user);}catch(err){message.textContent=err.message||"Invalid or expired verification code.";}finally{verify.disabled=false;}});
