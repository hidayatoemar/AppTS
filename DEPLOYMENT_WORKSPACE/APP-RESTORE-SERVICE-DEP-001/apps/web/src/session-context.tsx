import {createContext,useContext,type PropsWithChildren} from "react";
export interface SessionContextValue{readonly actorRef:string;readonly roleAssignmentRef:string;readonly disclosureProfileRef:string;readonly online:boolean;}
const SessionContext=createContext<SessionContextValue|undefined>(undefined);
export function SessionProvider({value,children}:PropsWithChildren<{value:SessionContextValue}>){return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>}
export function useSession():SessionContextValue{const value=useContext(SessionContext);if(!value)throw new Error("SESSION_CONTEXT_REQUIRED");return value;}
