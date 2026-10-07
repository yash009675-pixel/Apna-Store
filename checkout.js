/* Apna Store — Checkout
 *
 * Phase 7: premium checkout UX.
 *
 * The commerce flow is unchanged and still driven by the same Supabase
 * calls: preview_coupon → create_order_secure ('cod') → set_order_gifting_options,
 * with the same abandoned-cart events, the same product/stock pre-checks and
 * the same ₹49 / ₹999 delivery rule. This phase only improves presentation,
 * validation messaging, loading feedback and accessibility.
 */
let cart=[];
let appliedCoupon="";
let couponDiscount=0;
let couponPending=false;
let orderPending=false;
let savedAddresses=[];
try{const parsed=JSON.parse(localStorage.getItem("apnaCart")||"[]");cart=Array.isArray(parsed)?parsed:[]}catch(error){console.error("Cart data could not be read at checkout:",error);cart=[]}

const summary=document.getElementById("checkoutSummary"),form=document.getElementById("checkoutForm"),nameInput=document.getElementById("name"),phoneInput=document.getElementById("phone"),addressInput=document.getElementById("address"),cityInput=document.getElementById("city"),stateInput=document.getElementById("state"),pincodeInput=document.getElementById("pincode"),note=document.getElementById("checkoutNote");

const giftWrapInput=document.getElementById("giftWrap"),hidePriceInput=document.getElementById("hidePrice"),giftRecipientNameInput=document.getElementById("giftRecipientName"),giftRecipientPhoneInput=document.getElementById("giftRecipientPhone"),giftRecipientEmailInput=document.getElementById("giftRecipientEmail"),giftMessageInput=document.getElementById("giftMessage"),specialOccasionInput=document.getElementById("specialOccasion"),scheduledDeliveryDateInput=document.getElementById("scheduledDeliveryDate"),giftCardCodeInput=document.getElementById("giftCardCode");
const deliveryPrefInputs={time:document.getElementById("checkoutPreferredDeliveryTime"),instructions:document.getElementById("checkoutDeliveryInstructions"),safe:document.getElementById("checkoutSafePlace"),altName:document.getElementById("checkoutAlternateContactName"),altPhone:document.getElementById("checkoutAlternateContactPhone"),leave:document.getElementById("checkoutLeaveAtDoor")};
let savedDeliveryPreferences={};

const FREE_DELIVERY_THRESHOLD=999;
const DELIVERY_FEE=49;

/* ------------------------------------------------------------------ *
 * Formatting and feedback helpers
 * ------------------------------------------------------------------ */

function money(n){return "₹"+Number(n||0).toLocaleString("en-IN")}

function escapeHtml(value){
 return String(value===null||value===undefined?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function hasWindow(){return typeof window!=="undefined"}

function prefersReducedMotion(){
 try{return Boolean(hasWindow()&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)}catch(error){return false}
}

/* Backend/RPC messages are technical. Customers get a readable sentence,
 * and the raw message is only kept in the console for support. */
const ERROR_TRANSLATIONS=[
 [/failed to fetch|network|timed? ?out|timeout/i,"We could not reach the server. Please check your connection and try again."],
 [/authentication required|jwt expired|invalid jwt/i,"Please sign in again to continue your order."],
 [/cart is empty/i,"Your bag is empty. Add a product before checking out."],
 [/complete shipping address is required|shipping address is required/i,"Please complete every delivery address field."],
 [/invalid phone number/i,"The phone number must be exactly 10 digits."],
 [/invalid pincode/i,"The pincode must be exactly 6 digits."],
 [/unsupported payment method/i,"That payment method is not available yet. Please use Cash on Delivery."],
 [/insufficient stock/i,"One of the items in your bag just went out of stock. Please review your bag and try again."],
 [/stock changed/i,"Stock changed while we were placing your order. Please review your bag and try again."],
 [/product is unavailable/i,"One of the products in your bag is no longer available."],
 [/invalid product variant|invalid cart item|invalid product or variant id/i,"One of the items in your bag is no longer valid. Please open its product page and add it again."],
 [/row-level security|permission denied|not authorized|unauthorized/i,"You do not have permission to complete this action. Please sign in and try again."],
 [/coupon is invalid or unavailable/i,"That coupon code is not valid or is no longer available."],
 [/already used this coupon/i,"You have already used this coupon the maximum number of times."],
 [/only valid on a first order/i,"This coupon is only valid on your first order."],
 [/does not apply to the items/i,"This coupon does not apply to the items in your bag."]
];

function friendlyError(error,fallback){
 const raw=String(error&&error.message?error.message:error||"");
 for(const [pattern,message] of ERROR_TRANSLATIONS){if(pattern.test(raw))return message}
 if(/minimum order value/i.test(raw)){
  const amount=raw.match(/₹?\s*([\d,]+(?:\.\d+)?)/);
  return amount?"This coupon needs a minimum order value of ₹"+amount[1]+".":"This coupon needs a minimum order value.";
 }
 return fallback;
}

function setFormError(messages){
 const box=document.getElementById("checkoutError");
 if(!box)return;
 if(!messages||!messages.length){box.hidden=true;box.innerHTML="";return}
 box.hidden=false;
 box.innerHTML='<p class="checkout-error-title">Please fix the following before placing your order</p><ul>'+messages.map(message=>"<li>"+escapeHtml(message)+"</li>").join("")+"</ul>";
 if(!prefersReducedMotion()){box.classList.remove("is-shaking");void box.offsetWidth;box.classList.add("is-shaking")}
}

function clearFormError(){setFormError([])}

function setFieldInvalid(field,invalid){
 if(!field||!field.setAttribute)return;
 if(invalid)field.setAttribute("aria-invalid","true");
 else field.removeAttribute("aria-invalid");
}

function setStatus(message){if(note)note.textContent=message||""}

function showValidationErrors(errors){
 setFormError(errors.map(error=>error.message));
 errors.forEach(error=>setFieldInvalid(error.field,true));
 const first=errors.find(error=>error.field);
 if(first&&first.field&&first.field.focus)first.field.focus();
}

function setButtonLoading(button,isLoading,loadingLabel){
 if(!button)return;
 const label=button.querySelector?button.querySelector(".checkout-submit-label,.checkout-button-label"):null;
 const target=label||button;
 if(isLoading){
  if(target.dataset.originalLabel===undefined)target.dataset.originalLabel=target.textContent;
  target.textContent=loadingLabel||"Working…";
  button.disabled=true;
  button.setAttribute("aria-busy","true");
  button.classList.add("is-loading");
 }else{
  if(target.dataset.originalLabel!==undefined)target.textContent=target.dataset.originalLabel;
  button.disabled=false;
  button.removeAttribute("aria-busy");
  button.classList.remove("is-loading");
 }
}

function pulseSummary(){
 const total=summary&&summary.querySelector?summary.querySelector(".summary-total"):null;
 if(!total||prefersReducedMotion())return;
 total.classList.remove("is-updated");
 void total.offsetWidth;
 total.classList.add("is-updated");
}

function setCouponMessage(message,tone){
 const el=document.getElementById("couponMessage");
 if(!el)return;
 el.textContent=message||"";
 el.className="coupon-message"+(tone?" coupon-message-"+tone:"");
 if(tone==="error"&&!prefersReducedMotion()){el.classList.remove("is-shaking");void el.offsetWidth;el.classList.add("is-shaking")}
}

/* ------------------------------------------------------------------ *
 * Saved addresses — the customer's own rows only, never sample data
 * ------------------------------------------------------------------ */

function addressValue(field){return field?String(field.value||"").trim():""}

function fillAddressFromSaved(address){
 if(!address)return;
 if(nameInput)nameInput.value=address.full_name||"";
 if(phoneInput)phoneInput.value=address.phone||"";
 if(addressInput)addressInput.value=address.address_line||"";
 if(cityInput)cityInput.value=address.city||"";
 if(stateInput)stateInput.value=address.state||"";
 if(pincodeInput)pincodeInput.value=address.pincode||"";
 [nameInput,phoneInput,addressInput,cityInput,stateInput,pincodeInput].forEach(field=>setFieldInvalid(field,false));
 clearFormError();
}

function currentAddressId(){
 return (savedAddresses.find(address=>
  addressValue(addressInput)===String(address.address_line||"")&&
  addressValue(pincodeInput)===String(address.pincode||"")&&
  addressValue(phoneInput)===String(address.phone||"")
 )||{}).id||null;
}

function markSelectedAddress(id){
 const list=document.getElementById("savedAddressList");
 if(!list)return;
 list.querySelectorAll(".saved-address").forEach(card=>{
  const selected=card.dataset.address===id;
  card.classList.toggle("is-selected",selected);
  const input=card.querySelector('input[name="savedAddress"]');
  if(input)input.checked=selected;
 });
}

function renderSavedAddresses(){
 const list=document.getElementById("savedAddressList");
 if(!list)return;
 list.innerHTML=savedAddresses.map(address=>''+
  '<label class="saved-address" data-address="'+escapeHtml(address.id)+'">'+
   '<input type="radio" name="savedAddress" value="'+escapeHtml(address.id)+'">'+
   '<span class="saved-address-body">'+
    '<strong>'+escapeHtml(address.full_name)+(address.is_default?'<span class="default-badge">Default</span>':"")+'</strong>'+
    '<span>'+escapeHtml(address.address_line)+'</span>'+
    '<span>'+escapeHtml(address.city)+", "+escapeHtml(address.state)+" — "+escapeHtml(address.pincode)+'</span>'+
    '<span>Phone: '+escapeHtml(address.phone)+'</span>'+
   '</span>'+
  '</label>').join("");
 list.querySelectorAll('input[name="savedAddress"]').forEach(input=>{
  input.addEventListener("change",()=>{
   const address=savedAddresses.find(item=>item.id===input.value);
   if(address){fillAddressFromSaved(address);markSelectedAddress(address.id)}
  });
 });
 markSelectedAddress(currentAddressId());
}

async function loadSavedAddresses(){
 const card=document.getElementById("savedAddressCard");
 const list=document.getElementById("savedAddressList");
 const message=document.getElementById("savedAddressMessage");
 if(!card||!list)return;
 try{
  if(message)message.textContent="Loading your saved addresses…";
  const {data:{session}}=await apnaSupabase.auth.getSession();
  if(!session){card.hidden=true;savedAddresses=[];if(message)message.textContent="";return}
  const {data,error}=await apnaSupabase.from("addresses")
   .select("id,full_name,phone,address_line,city,state,pincode,is_default,created_at")
   .eq("user_id",session.user.id)
   .order("is_default",{ascending:false})
   .order("created_at",{ascending:true});
  if(error)throw error;
  savedAddresses=data||[];
  if(!savedAddresses.length){card.hidden=true;if(message)message.textContent="";return}
  card.hidden=false;
  renderSavedAddresses();
  const hasValues=[nameInput,phoneInput,addressInput,cityInput,stateInput,pincodeInput].some(field=>addressValue(field));
  if(!hasValues)fillAddressFromSaved(savedAddresses.find(address=>address.is_default)||savedAddresses[0]);
  markSelectedAddress(currentAddressId());
  if(message)message.textContent="Choosing an address fills the delivery form below. You can still edit it before placing the order.";
 }catch(error){
  console.warn("Saved addresses could not be loaded:",error&&error.message?error.message:error);
  card.hidden=true;
  savedAddresses=[];
 }
}

/* ------------------------------------------------------------------ *
 * Existing backend behaviour (unchanged)
 * ------------------------------------------------------------------ */

async function loadDeliveryPreferences(){try{const {data,error}=await apnaSupabase.rpc("get_customer_delivery_preferences");if(error)throw error;savedDeliveryPreferences=data||{};if(deliveryPrefInputs.time)deliveryPrefInputs.time.value=data?.preferred_delivery_time||"";if(deliveryPrefInputs.instructions)deliveryPrefInputs.instructions.value=data?.delivery_instructions||"";if(deliveryPrefInputs.safe)deliveryPrefInputs.safe.value=data?.safe_place||"";if(deliveryPrefInputs.altName)deliveryPrefInputs.altName.value=data?.alternate_contact_name||"";if(deliveryPrefInputs.altPhone)deliveryPrefInputs.altPhone.value=data?.alternate_contact_phone||"";if(deliveryPrefInputs.leave)deliveryPrefInputs.leave.checked=!!data?.leave_at_door}catch(e){console.warn("Delivery preferences could not be loaded:",e?.message||e)}}

function hasValidVariants(){return cart.every(x=>x&&x.productId&&x.variantId&&Number(x.qty||0)>0)}

function totals(){
 const subtotal=cart.reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||1),0);
 const shipping=subtotal>=FREE_DELIVERY_THRESHOLD?0:DELIVERY_FEE;
 return {subtotal,shipping,total:Math.max(0,subtotal-couponDiscount+shipping),freeDeliveryGap:Math.max(0,FREE_DELIVERY_THRESHOLD-subtotal)};
}

function summaryLineMarkup(item){
 const variant=[item.size,item.color].filter(Boolean).join(" · ");
 return ''+
  '<li class="checkout-line-item">'+
   '<span class="checkout-line-item-name">'+escapeHtml(item.name||"Product")+'</span>'+
   (variant?'<span class="checkout-line-item-variant">'+escapeHtml(variant)+'</span>':"")+
   '<span class="checkout-line-item-qty">Qty '+Number(item.qty||1)+'</span>'+
   '<b class="checkout-line-item-total">'+money(Number(item.price||0)*Number(item.qty||1))+'</b>'+
  '</li>';
}

function couponBoxMarkup(){
 return ''+
  '<div class="coupon-box">'+
   '<label for="couponCode">Coupon code</label>'+
   '<div class="coupon-row">'+
    '<input id="couponCode" value="'+escapeHtml(appliedCoupon)+'" placeholder="Enter coupon" maxlength="40" autocomplete="off" aria-describedby="couponMessage">'+
    '<button type="button" id="applyCoupon" class="light-btn"><span class="checkout-button-label">Apply</span></button>'+
    (couponDiscount?'<button type="button" id="removeCoupon" class="light-btn coupon-remove">Remove</button>':"")+
   '</div>'+
   '<small id="couponMessage" class="coupon-message" role="status" aria-live="polite">'+(couponDiscount?"Coupon applied successfully.":"Enter a coupon code to check eligibility.")+'</small>'+
  '</div>';
}

function render(){
 const counts=cart.reduce((sum,item)=>sum+Number(item.qty||1),0);
 if(!cart.length){
  summary.innerHTML='<div class="checkout-card summary-card checkout-empty"><p class="eyebrow">YOUR BAG</p><h2>Your bag is empty</h2><p>Add a product before checking out — everything you add will be waiting here.</p><a class="primary-btn" href="shop.html">Shop now <span aria-hidden="true">→</span></a></div>';
  form.style.display="none";
  return;
 }
 const {subtotal,shipping,total,freeDeliveryGap}=totals();
 summary.innerHTML=''+
  '<div class="checkout-card summary-card">'+
   '<p class="eyebrow">ORDER SUMMARY</p>'+
   '<h2>'+counts+' item'+(counts===1?"":"s")+'</h2>'+
   '<ul class="checkout-line-items">'+cart.map(summaryLineMarkup).join("")+'</ul>'+
   '<div class="summary-line"><span>Subtotal</span><b>'+money(subtotal)+'</b></div>'+
   (couponDiscount?'<div class="summary-line summary-discount"><span>Coupon '+escapeHtml(appliedCoupon)+'</span><b>−'+money(couponDiscount)+'</b></div>':"")+
   '<div class="summary-line"><span>Delivery</span><b>'+(shipping?money(shipping):"FREE")+'</b></div>'+
   '<p class="checkout-summary-hint">'+(shipping?"Add "+money(freeDeliveryGap)+" more for free delivery.":"Free delivery unlocked on this order.")+'</p>'+
   '<div class="summary-total"><span>Total</span><b>'+money(total)+'</b></div>'+
   couponBoxMarkup()+
  '</div>';
 const couponInput=document.getElementById("couponCode");
 if(couponInput)couponInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();applyCoupon()}});
 document.getElementById("applyCoupon")?.addEventListener("click",applyCoupon);
 document.getElementById("removeCoupon")?.addEventListener("click",removeCoupon);
}

async function applyCoupon(){
 const input=document.getElementById("couponCode"),button=document.getElementById("applyCoupon");
 const code=(input?.value||"").trim().toUpperCase();
 if(couponPending)return;
 if(!code){appliedCoupon="";couponDiscount=0;render();setCouponMessage("Enter a coupon code to check eligibility.","");return}
 if(!hasValidVariants()){setCouponMessage("Please use valid product variants before applying a coupon.","error");return}
 couponPending=true;
 setButtonLoading(button,true,"Checking…");
 setCouponMessage("Checking this coupon…","pending");
 try{
  const items=cart.map(x=>({product_id:x.productId,variant_id:x.variantId,quantity:Number(x.qty||1)}));
  const {data,error}=await apnaSupabase.rpc("preview_coupon",{p_items:items,p_coupon_code:code});
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!result)throw new Error("Coupon preview failed");
  appliedCoupon=code;
  couponDiscount=Number(result.discount_amount||0);
  render();
  pulseSummary();
  setCouponMessage("Coupon "+appliedCoupon+" applied. You saved "+money(couponDiscount)+".","success");
 }catch(error){
  console.error("Coupon validation failed:",error);
  appliedCoupon="";
  couponDiscount=0;
  render();
  setCouponMessage(friendlyError(error,"This coupon is invalid or unavailable."),"error");
 }finally{
  couponPending=false;
  setButtonLoading(button,false);
 }
}

async function removeCoupon(){
 if(couponPending)return;
 appliedCoupon="";
 couponDiscount=0;
 render();
 pulseSummary();
 setCouponMessage("Coupon removed. Enter another code to check eligibility.","");
}

async function createCloudOrder(){const shippingAddress={full_name:nameInput.value.trim(),phone:phoneInput.value.trim(),address_line:addressInput.value.trim(),city:cityInput.value.trim(),state:stateInput.value.trim(),pincode:pincodeInput.value.trim(),preferred_delivery_time:deliveryPrefInputs.time?.value||null,delivery_instructions:deliveryPrefInputs.instructions?.value.trim()||null,safe_place:deliveryPrefInputs.safe?.value.trim()||null,alternate_contact_name:deliveryPrefInputs.altName?.value.trim()||null,alternate_contact_phone:deliveryPrefInputs.altPhone?.value.trim()||null,leave_at_door:!!deliveryPrefInputs.leave?.checked},items=cart.map(x=>({product_id:x.productId,variant_id:x.variantId,quantity:Number(x.qty||1)}));const {data,error}=await apnaSupabase.rpc("create_order_secure",{p_items:items,p_shipping:shippingAddress,p_payment_method:"cod",p_coupon_code:appliedCoupon||null});if(error)throw error;const result=Array.isArray(data)?data[0]:data;if(!result?.order_id)throw new Error("Order was not created");return {id:result.order_number,dbId:result.order_id,items:cart,customer:{name:shippingAddress.full_name,phone:shippingAddress.phone,address:shippingAddress.address_line,city:shippingAddress.city,state:shippingAddress.state,pincode:shippingAddress.pincode},total:Number(result.total),subtotal:Number(result.subtotal),deliveryFee:Number(result.delivery_fee),couponCode:appliedCoupon||null,discountAmount:couponDiscount,createdAt:new Date().toISOString(),cloud:true}}

async function saveGifting(orderId){const payload={p_order_id:orderId,p_gift_wrap:!!giftWrapInput?.checked,p_gift_message:giftMessageInput?.value.trim()||null,p_hide_price:!!hidePriceInput?.checked,p_recipient_name:giftRecipientNameInput?.value.trim()||null,p_recipient_phone:giftRecipientPhoneInput?.value.trim()||null,p_recipient_email:giftRecipientEmailInput?.value.trim()||null,p_scheduled_delivery_date:scheduledDeliveryDateInput?.value||null,p_gift_card_code:giftCardCodeInput?.value.trim()||null,p_special_occasion:specialOccasionInput?.value||null};const {error}=await apnaSupabase.rpc("set_order_gifting_options",payload);if(error)throw error}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

function collectValidationErrors(){
 const errors=[];
 const required=[
  [nameInput,"Please enter the full name for this delivery."],
  [phoneInput,"Please enter a phone number for delivery updates."],
  [addressInput,"Please enter your street address."],
  [cityInput,"Please enter your city."],
  [stateInput,"Please enter your state."],
  [pincodeInput,"Please enter your pincode."]
 ];
 for(const [field,message] of required){if(field&&!String(field.value||"").trim())errors.push({field,message})}
 if(phoneInput&&addressValue(phoneInput)&&!/^\d{10}$/.test(addressValue(phoneInput)))errors.push({field:phoneInput,message:"Phone number must be exactly 10 digits."});
 if(pincodeInput&&addressValue(pincodeInput)&&!/^\d{6}$/.test(addressValue(pincodeInput)))errors.push({field:pincodeInput,message:"Pincode must be exactly 6 digits."});
 if(deliveryPrefInputs.altPhone&&addressValue(deliveryPrefInputs.altPhone)&&!/^\d{10}$/.test(addressValue(deliveryPrefInputs.altPhone)))errors.push({field:deliveryPrefInputs.altPhone,message:"Alternate contact phone must be exactly 10 digits."});
 if(giftRecipientPhoneInput&&addressValue(giftRecipientPhoneInput)&&!/^\d{10}$/.test(addressValue(giftRecipientPhoneInput)))errors.push({field:giftRecipientPhoneInput,message:"Gift recipient phone must be exactly 10 digits."});
 if(giftRecipientEmailInput&&addressValue(giftRecipientEmailInput)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addressValue(giftRecipientEmailInput)))errors.push({field:giftRecipientEmailInput,message:"Enter a valid email for the gift recipient."});
 if(scheduledDeliveryDateInput&&addressValue(scheduledDeliveryDateInput)){
  const chosen=new Date(addressValue(scheduledDeliveryDateInput)+"T00:00:00");
  const today=new Date();today.setHours(0,0,0,0);
  if(Number.isNaN(chosen.getTime())||chosen<today)errors.push({field:scheduledDeliveryDateInput,message:"Choose a scheduled delivery date that is today or later."});
 }
 return errors;
}

/* Same queries and same order as before, now reported inline instead of
 * through a browser dialog. */
async function verifyStock(){
 for(const item of cart){
  const {data:p,error:pe}=await apnaSupabase.from("products").select("id,name").eq("id",item.productId).eq("status","active").maybeSingle();
  if(pe||!p)return "One of the products in your bag is no longer available.";
  const {data:v,error:ve}=await apnaSupabase.from("product_variants").select("id,stock").eq("id",item.variantId).eq("product_id",item.productId).maybeSingle();
  if(ve||!v)return "The selected size/color for "+String(item.name||"an item")+" is no longer available.";
  if(Number(v.stock)<Number(item.qty))return String(item.name||"An item")+" has only "+Number(v.stock)+" item(s) available. Please update your bag.";
 }
 return "";
}

async function placeOrder(e){
 e.preventDefault();
 clearFormError();
 const submitButton=form.querySelector(".checkout-submit");
 if(orderPending)return;
 if(!cart.length){setFormError(["Your bag is empty. Add a product before checking out."]);return}
 if(!form.reportValidity())return;
 if(submitButton&&submitButton.disabled)return;

 const validationErrors=collectValidationErrors();
 if(validationErrors.length){showValidationErrors(validationErrors);return}
 if(!hasValidVariants()){
  setFormError(["One of the items in your bag is missing a valid size/color selection. Please remove it and add the product again from its product page."]);
  return;
 }

 const {data:{session}}=await apnaSupabase.auth.getSession();
 if(!session){sessionStorage.setItem("apnaReturnAfterAuth","checkout.html");location.href="auth.html";return}

 orderPending=true;
 setButtonLoading(submitButton,true,"Placing order…");
 setStatus("Placing your order. Please do not close this window.");
 try{
  const stockMessage=await verifyStock();
  if(stockMessage){
   setFormError([stockMessage]);
   setButtonLoading(submitButton,false);
   setStatus("Your order has not been placed yet. Please review the message above.");
   orderPending=false;
   return;
  }
  await apnaSupabase.rpc("record_abandoned_cart_event",{p_type:"checkout_started",p_channel:"in_app"});
  const order=await createCloudOrder();
  await saveGifting(order.dbId);
  await apnaSupabase.rpc("mark_abandoned_cart_recovered",{p_order_id:order.dbId});
  await apnaSupabase.rpc("record_abandoned_cart_event",{p_type:"recovered",p_channel:"in_app"});
  localStorage.setItem("apnaLastOrder",JSON.stringify(order));
  localStorage.removeItem("apnaCart");
  location.href="order-success.html";
 }catch(error){
  console.error("Cloud order creation failed:",error);
  setFormError([friendlyError(error,"We could not save your order to your account. Please try again. Your bag is still safe.")]);
  setButtonLoading(submitButton,false);
  setStatus("Your order has not been placed yet. Your bag is unchanged.");
  orderPending=false;
 }
}

async function requireSignedInCheckout(){const {data:{session}}=await apnaSupabase.auth.getSession();if(session)return true;sessionStorage.setItem("apnaReturnAfterAuth","checkout.html");location.href="auth.html";return false}

function updatePaymentNote(){
 const selected=document.querySelector('input[name="payment"]:checked');
 const el=document.getElementById("paymentMethodNote");
 if(!el)return;
 if(selected&&selected.value==="Cash on Delivery")el.textContent="Cash on delivery is the active payment method. You pay when the order arrives — no payment is taken at this step.";
 else if(selected)el.textContent="Online payment is not available yet. Please choose Cash on Delivery to continue.";
}

async function boot(){
 form.addEventListener("submit",async e=>{if(!(await requireSignedInCheckout())){e.preventDefault();return}placeOrder(e)});
 form.addEventListener("input",e=>setFieldInvalid(e.target,false));
 document.querySelectorAll('input[name="payment"]').forEach(radio=>radio.addEventListener("change",updatePaymentNote));
 if(scheduledDeliveryDateInput)scheduledDeliveryDateInput.min=new Date().toISOString().slice(0,10);
 updatePaymentNote();
 render();
 try{
  const {data:{session}}=await apnaSupabase.auth.getSession();
  if(session){
   setStatus("You are signed in. This order will be saved to your Apna Store account.");
   await loadDeliveryPreferences();
   await loadSavedAddresses();
  }
 }catch(error){console.warn("Checkout bootstrap failed:",error&&error.message?error.message:error)}
}

const api={
 money:money,
 escapeHtml:escapeHtml,
 friendlyError:friendlyError,
 totals:totals,
 hasValidVariants:hasValidVariants,
 collectValidationErrors:collectValidationErrors,
 render:render,
 applyCoupon:applyCoupon,
 removeCoupon:removeCoupon,
 placeOrder:placeOrder,
 loadSavedAddresses:loadSavedAddresses,
 verifyStock:verifyStock,
 updatePaymentNote:updatePaymentNote,
 boot:boot,
 state:()=>({appliedCoupon,couponDiscount,couponPending,orderPending,savedAddresses})
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(hasWindow())window.apnaCheckout=api;

/* Bootstrap — kept explicit so tests can load this module without starting it. */
if (typeof document !== "undefined" && document.getElementById && document.getElementById("checkoutForm")) { boot(); }
