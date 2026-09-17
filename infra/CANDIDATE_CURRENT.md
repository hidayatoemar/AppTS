# AppTS infrastructure reference — candidate current

This file preserves non-secret deployment facts from AppTS Trial #2 that may still be reusable. It is **infrastructure context only**, not Product/design authority.

Project Director status on 2026-09-17: the server is not dormant; these facts are expected to remain current but require technical verification before deployment changes.

## Candidate-current facts

- Public IPv4: `103.150.226.110`
- Domain: `staging.ts.cifo.id`
- Prior host OS declaration: AlmaLinux 9 / RHEL-family Linux
- Prior application install path: `/opt/appts-restore-service`
- Prior public web ports: TCP 80 / 443
- Prior local application port: 8080
- Server posture described by Project Director: simple Linux host with Python, a web server, and small supporting utilities.

## Currentness / verification

- Treat these values as candidate-current, **not legacy**.
- Do not infer current DNS, TLS, process state, package versions, firewall state, or application runtime from Trial #2 files.
- Verification attempt from the current construction environment on 2026-09-17 could not resolve `staging.ts.cifo.id` and could not connect to `103.150.226.110` on TCP 80/443. This is inconclusive because the construction environment may not have equivalent network reachability.
- Re-verify from an authorized network/control host before deployment or DNS/firewall changes.

## Security

No passwords, private keys, vault values, tokens, or other credentials are retained here.
