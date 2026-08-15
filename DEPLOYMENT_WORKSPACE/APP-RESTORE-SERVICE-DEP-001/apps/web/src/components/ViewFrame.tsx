import type {PropsWithChildren} from "react";
export function ViewFrame({viewId,title,children}:PropsWithChildren<{viewId:string;title:string}>){return <main data-view-id={viewId}><header><p>{viewId}</p><h1>{title}</h1></header>{children??<p>Current server projection required.</p>}</main>}
