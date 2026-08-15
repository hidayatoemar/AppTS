import { ViewFrame } from "../components/ViewFrame.tsx";

export function TicketConsoleView({ mode = "console" }: { mode?: "console" | "closed" | "history" }) {
  return (
    <ViewFrame
      viewId={mode === "closed" ? "UX-RS-12" : mode === "history" ? "UX-RS-HISTORY" : "UX-RS-03"}
      title={
        mode === "closed"
          ? "Closed Ticket / Correction / Successor"
          : mode === "history"
            ? "Ticket Audit / History"
            : "Ticket Operational Console"
      }
    />
  );
}
