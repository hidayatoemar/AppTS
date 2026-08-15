const STATIC_CACHE="restore-service-shell-v1";const STATIC_ASSETS=["/","/index.html"];
type InstallEvent={waitUntil(promise:Promise<unknown>):void};type FetchEvent={request:Request;respondWith(promise:Promise<Response|undefined>):void};
self.addEventListener("install",(event)=>{(event as unknown as InstallEvent).waitUntil(caches.open(STATIC_CACHE).then((cache)=>cache.addAll(STATIC_ASSETS)))});
self.addEventListener("fetch",(event)=>{const fetchEvent=event as unknown as FetchEvent;const request=fetchEvent.request;if(new URL(request.url).pathname.startsWith("/api/"))return;fetchEvent.respondWith(caches.match(request).then((cached)=>cached??fetch(request)))});
