# AppTS RESTORE_SERVICE — HFP vertical slice

This pilot is deliberately small. It tests whether a validated human-operational story can be turned directly into executable application behavior without using the existing canonical tables as the semantic oracle.

Semantic sources:
- `APPTS-HFP-NAR-001_Service_Recovery_Operational_Narrative_v1.0_VALIDATED` — Drive File ID `1BfKuQyKJopEqZ4zpORJPGYw_8kJGwRBm5-P-XsmHUaM`
- `APPTS-HFP-STG-EXTRACT-001_Service_Recovery_Real_World_State_Activity_Transition_Model_v1.0_VALIDATED` — Drive File ID `1vWTLstun7w7FygLfgEi0PxE3r14NY0baqs1Su8YKwg0`

The current pilot contains three synthetic executable scenarios:
1. HFP material dependency sequence from 08:27 through technical recovery, customer verification and closure.
2. Site-access waiting / no-transition / escalation / access-granted sequence.
3. Handover offered / not accepted / accepted with operational state and aging retention.

No exact SLA/aging threshold is invented. The site-access escalation event means only that a governed threshold has been reached; the threshold value remains configuration/open.

Run:

```bash
node pilot/restore-service/server.mjs
```

Open `http://127.0.0.1:8080`.

Run the semantic regression test:

```bash
node --test tests/hfp-restore-vertical-slice.test.mjs
```
