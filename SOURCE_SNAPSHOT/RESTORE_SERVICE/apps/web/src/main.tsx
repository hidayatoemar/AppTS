import{StrictMode}from"react";import{createRoot}from"react-dom/client";import{App}from"./app.tsx";import"./styles/global.css";
const root=document.getElementById("root");if(!root)throw new Error("ROOT_ELEMENT_MISSING");createRoot(root).render(<StrictMode><App/></StrictMode>);if("serviceWorker"in navigator)navigator.serviceWorker.register("/src/offline/service-worker.ts");
