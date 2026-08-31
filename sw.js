const CACHE='booking-diary-v3.3.2-reminder-sync-5m-20260831-1';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).then(r=>{
    const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch{data={body:event.data?.text()||'You have a Booking Diary reminder.'};}
  const title=data.title||'Booking Diary';
  const options={
    body:data.body||'You have an upcoming booking.',
    icon:data.icon||'icon-192.png',
    badge:data.badge||'icon-192.png',
    tag:data.tag||'booking-diary-push',
    renotify:true,
    vibrate:[180,80,180],
    data:{url:data.url||'./',bookingId:data.bookingId||null},
    actions:[{action:'open',title:'Open Booking'}]
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if('focus' in client){
        if('navigate' in client)client.navigate(target).catch(()=>{});
        return client.focus();
      }
    }
    return clients.openWindow?clients.openWindow(target):null;
  }));
});
