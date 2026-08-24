export const UI_CONCERNS=new Set(["evidence","responsibility","conditions","communication","incident","reconciliation","closure","closed","history"]);
export interface UiReadContext { readonly alias:string; readonly trainerOnly:boolean; readonly actor_ref?:string; readonly role_assignment_ref?:string; readonly role_ref?:string; readonly holder_ref?:string; }
export interface UiProjectionPort { read(viewId:string,subjectRef?:string,concern?:string,context?:UiReadContext):Promise<unknown>; }
export async function readUiProjection(port:UiProjectionPort,viewId:string,subjectRef?:string,concern?:string,context?:UiReadContext):Promise<unknown>{if(concern&&!UI_CONCERNS.has(concern))throw new Error("UI_CONCERN_NOT_FOUND");return port.read(viewId,subjectRef,concern,context);}
