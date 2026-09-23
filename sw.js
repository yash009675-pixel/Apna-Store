const CACHE_NAME="apna-store-pwa-v3";
const APP_SHELL=["./","./index.html","./styles.css","./manifest.json","./favicon.svg","./pwa-icon-192.svg","./pwa-icon-512.svg","./offline.html","./pwa.js","./recommendation.js","./script.js","./shop.js","./product.js","./search.js","./cart.js","./wishlist.js","./account.js","./auth.js","./checkout.js","./orders.js","./order-detail.js","./order-success.js","./notifications.js","./return-request.js","./reviews.js","./seller-dashboard.js","./seller-earnings.js","./seller-onboarding.js","./seller-orders.js","./seller-product.js","./seller-products.js","./admin.js","./apna-ai.js","./backend/supabase-client.js"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET")return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(req.mode==="navigate"){
   event.respondWith(fetch(req).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));return response}).catch(()=>caches.match(req).then(cached=>cached||caches.match("./index.html").then(home=>home||caches.match("./offline.html")))));
   return;
 }
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));return response}).catch(()=>caches.match("./offline.html"))));
});
self.addEventListener("push",event=>{let data={title:"Apna Store",body:"You have a new update.",url:"./notifications.html"};try{data={...data,...(event.data?event.data.json():{})}}catch{}event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:"./pwa-icon-192.svg",badge:"./pwa-icon-192.svg",data:{url:data.url}}))});
self.addEventListener("notificationclick",event=>{event.notification.close();const url=event.notification.data?.url||"./notifications.html";event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const c of list){if("focus" in c){c.navigate(url);return c.focus()}}return clients.openWindow(url)}))});