# CF06 batch manifest

The construction order is fixed: `B00 -> B01 -> B02 -> B03 -> B04 -> B05 -> B06 -> B07 -> B08`.

| Batch | Identity and dependency | Candidate classification |
| --- | --- | --- |
| B00 | repository and toolchain scaffold; entry batch | COMPLETE / ACCEPTED / CLOSED at `4f65282befd25ad2bfefbd838667bf7984e3dc3f` |
| B01 | physical persistence and migration package; depends on B00 | historical construction surface represented in the accepted B07 baseline; no separate current live disposition is asserted here |
| B02 | exact contracts and common exchange results; depends on B01 | historical construction surface represented in the accepted B07 baseline; INT-RUN-TD trace validated by B07 |
| B03 | Core D01/D02/D03 ownership implementation; depends on B02 | historical construction surface represented in the accepted B07 baseline |
| B04 | Runtime D04 lifecycle-effect authority; depends on B03 | historical construction surface represented in the accepted B07 baseline |
| B05 | D05 adapters, D06 interaction, and DG04 diagnostics; depends on B04 | historical construction surface represented in the accepted B07 baseline |
| B06 | API composition and operational web UI; depends on B05 | historical construction surface represented in the accepted B07 baseline; UX-RS-12 trace validated by B07 |
| B07 | verification harness and trace matrix; depends on B06 | COMPLETE / ACCEPTED / CLOSED at `f928652ba5b3d770115a251d3bf998d9d217d4de` |
| B08 | release-candidate assembly for IV CF07; depends on accepted B07 | ACTIVE under D020; this documentation commit is the final assembly action |

## Evidence mapping

B07 supplies the accepted evidence for the constructed B01–B06 surfaces: CF05 source/revision validation, 71-case trace matrix, contract/integration/DG04/adverse test execution, and disposable PostgreSQL/Flyway migration validation. This is a factual baseline classification, not a retroactive authority claim for historical batch execution.

The B08 exit result requires the four release-candidate documents to agree with this baseline, preserve zero orphan references, freeze the controlled sources, and state the non-authority boundary explicitly.
