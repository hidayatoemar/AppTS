export interface TrialSession{readonly authenticated:true;readonly alias:string;readonly trainer_only:boolean;readonly role_ref:string|null;readonly holder_ref:string|null;readonly established_at:string;}
export interface EndShiftCheck{readonly alias:string;readonly role_ref:string|null;readonly holder_ref:string|null;readonly open_ticket_count:number;readonly open_obligation_count:number;readonly open_tickets:readonly Readonly<Record<string,unknown>>[];readonly posture:string;readonly mutation_performed:false;}
async function request(path:string,init?:RequestInit):Promise<any>{const response=await fetch(`/api/v1/auth${path}`,{...init,credentials:"same-origin"});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof body?.error==="string"?body.error:`AUTH_HTTP_${response.status}`);return body;}
export const trialAuth=Object.freeze({
  login:(alias:string,credential:string)=>request("/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({alias,credential})}) as Promise<TrialSession>,
  session:()=>request("/session") as Promise<TrialSession>,
  logout:()=>request("/logout",{method:"POST"}) as Promise<{authenticated:false}>,
  endShift:()=>request("/end-shift-check") as Promise<EndShiftCheck>,
});
