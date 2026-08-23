export const ROUTES = [
  ["/work", "UX-RS-01"], ["/intake", "UX-RS-02"], ["/intake/:caseId", "UX-RS-02"],
  ["/tickets/:ticketId", "UX-RS-03"], ["/tickets/:ticketId/action/:actionClass", "UX-RS-04"],
  ["/tickets/:ticketId/evidence", "UX-RS-05"], ["/tickets/:ticketId/responsibility", "UX-RS-06"],
  ["/tickets/:ticketId/conditions", "UX-RS-07"], ["/tickets/:ticketId/communication", "UX-RS-08"],
  ["/tickets/:ticketId/incident/:incidentId", "UX-RS-09"], ["/incidents/:incidentId", "UX-RS-09"],
  ["/tickets/:ticketId/reconciliation", "UX-RS-10"], ["/tickets/:ticketId/closure", "UX-RS-11"],
  ["/tickets/:ticketId/closed", "UX-RS-12"], ["/tickets/:ticketId/history", "UX-RS-HISTORY"],
  ["/control", "UX-RS-13"], ["/executive", "UX-RS-14"], ["/diagnostics/:referenceId", "UX-RS-15"],
  ["/trainer/tls-day2", "TLS-D2-TRAINER"],
] as const;
export interface RouteMatch { readonly pattern: string; readonly viewId: string; readonly params: Readonly<Record<string,string>>; }
export function resolveRoute(pathname: string): RouteMatch | { readonly redirect: "/work" } | { readonly notFound: true } {
  if (pathname === "/") return { redirect: "/work" };
  for (const [pattern, viewId] of ROUTES) { const names: string[]=[]; const rx=new RegExp(`^${pattern.replace(/:[^/]+/g,(m)=>{names.push(m.slice(1));return "([^/]+)"})}/?$`); const match=rx.exec(pathname); if(match) return { pattern, viewId, params:Object.freeze(Object.fromEntries(names.map((n,i)=>[n,decodeURIComponent(match[i+1]!)])))}; }
  return { notFound: true };
}
export function navigate(path: string): void { history.pushState(null,"",path); window.dispatchEvent(new PopStateEvent("popstate")); }
