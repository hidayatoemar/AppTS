# CF06 release-candidate manifest

Release candidate: `CF06-B08`  
Authority: `MCR-CODEX-B07-D020` v1.0_CONTROLLED  
Repository: `APP-RESTORE-SERVICE-REPO-001` / `main`  
Entry baseline: `f928652ba5b3d770115a251d3bf998d9d217d4de`  
Entry parent: `4f65282befd25ad2bfefbd838667bf7984e3dc3f`

## Frozen controlled sources

| Source | File ID | Accepted revision | Bounded role |
| --- | --- | ---: | --- |
| CF06 construction package v0.1.1 | `1HolXD_c6I3C8q_npSu7b4nb7EAQyb1lnmTUx1NfKQ-M` | 2 | construction order, targets, and release-candidate surface |
| CF01 | `1uJmmh9lU4QpqhWwiE3gvR_8TOdF-om8dVNvRlCXzxOQ` | 4 | physical persistence |
| CF02 | `1dh5-7auRKHkDR-tY4mooBw1nxatmjVY-nSHzTSK9_9Q` | 2 | contracts |
| CF03 | `1vPAPlxfjfvzS5WlkvHNsb1N7-Ej6RqSGpQl3Axif_2c` | 3 | UI and interaction |
| DG04 | `17o-qd7BpoBTL8j3N0R2a3O5joVH_LMySAJA9MDAGjKM` | 2 | runtime diagnostics |
| CF04 | `1J8uEUQePJ8huxGy5Qn4UUOd6b_iyC8ugDfGjtevVxfc` | 2 | repository and toolchain binding |
| CF05 | `1DqI5_cv2881OzBqhuyGaQisLqtHl5_2x8d4LQsLsabU` | 2 | verification and evidence |

The frozen source set matches `docs/construction/source-manifest.md` and the accepted B07 source/revision validation. No lower-precedence predecessor/candidate context is authority for this candidate.

## Committed implementation and verification baseline

- B00 implementation baseline: `4f65282befd25ad2bfefbd838667bf7984e3dc3f` (`CF06-B00: close consolidated compile blockers`).
- B07 accepted verification baseline: `f928652ba5b3d770115a251d3bf998d9d217d4de` (`CF06-B07: verification harness and trace matrix`).
- B07 evidence artifact: `CODEX-to-MCR-044`, File ID `1aZ789bi9G2J3IsT1IdZxbFtEHtdfC3rp7m57m8ddfn8`.
- Evidence-manifest SHA-256: `46b7b955848ec4606bba2553a6b48fdae5a57882744bc245c24d7263f39e50fc`.
- Lockfile SHA-256: `d0abd3bbe8e845dad0abe4559747d7edb437e04878237b22959bad9c8f9c0d5f`.
- Toolchain: Node `24.19.0`, npm `11.17.0`, TypeScript `6.0.3`; PostgreSQL/Flyway verification was disposable loopback only.

## Candidate result

The candidate freezes the repository as constructed and verified through B07. Its implementation impact covers workspace/toolchain binding; CF01/DG04 migrations and verification; CF02 contracts; D01–D06 and diagnostics surfaces; API/web routes; and CF05 harness/evidence. The B07 evidence records PASS for toolchain, boundaries, typecheck, build, contracts, integration, DG04, adverse, unit, NFR, and disposable migration verification.

`CF05-VCLASS-NI` is complete: 71 trace cases, INT-RUN-TD-01 through INT-RUN-TD-06 at 6/6, UX-RS-12 PASS, and orphan obligations/tests/fixtures at 0/0/0.

See `cf06-batch-manifest.md` for batch dependency classification, `cf06-ambiguity-register.md` for the ambiguity result, and `cf06-hold-and-nonauthority.md` for the authority boundary.
