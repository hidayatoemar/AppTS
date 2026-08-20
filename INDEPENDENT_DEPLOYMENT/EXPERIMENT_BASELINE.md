# Independent Deployment Experiment Baseline

## Identity

Experiment: AppTS Independent Deployment Experiment — RESTORE_SERVICE
Branch: `experiment/independent-restore-deploy`
Anchor repository commit: `40abd7dacfad803429d1663f76976ce15038b8a6`
Build Pack internal frozen constructed baseline: `e39f959fc6839c16c7c6cc75bd15079b4ed57a39`
Hasan/Adit main tip observed at experiment initialization: `b5146f3ed8ef68894ba73e814a76606036f7cf02`

## Why this anchor

`40abd7d...` is the initial Git commit in `hidayatoemar/AppTS` and contains the imported Build Pack plus `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001` before the later `CLOUD_DEPLOYMENT/` Ansible implementation was added. This gives the independent path the same repository starting material without inheriting Hasan/Adit deployment adaptations.

The internal Build Pack records `e39f959...` as the frozen independently verified constructed source baseline. That SHA belongs to the original source provenance carried inside the Build Pack; it is not itself a commit in this GitHub repository.

## Experiment boundary

This branch is deployment-comparison evidence only.

Do not:
- merge or rewrite Hasan/Adit `main` as part of this experiment;
- target Hasan/Adit staging/cloud resources;
- alter frozen Build Pack or DEP-001 semantic meaning;
- introduce Product, API, UI, schema, policy, business, trial-data, production, or UAT meaning;
- use production, UAT, or real operational data.

Allowed adaptation is mechanical deployment glue outside the frozen package content.

## Independent machinery

The independent harness lives only under:
- `.github/workflows/independent-nonprod.yml`
- `INDEPENDENT_DEPLOYMENT/`

It consumes the existing frozen deployment workspace at:
`DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001`

It does not reuse `CLOUD_DEPLOYMENT/` from the Hasan/Adit path.

## Current blocker state

`BLOCKED_TARGET_BINDING` until a separate non-production server and credentials are deliberately bound through GitHub secrets:
- `INDEP_HOST`
- `INDEP_USER`
- `INDEP_SSH_PRIVATE_KEY`
- `INDEP_POSTGRES_PASSWORD`

The target must be separate from Hasan/Adit infrastructure and must already provide:
- SSH access for the configured user;
- passwordless sudo for that user;
- Docker Engine;
- Docker Compose v2 plugin;
- outbound network needed by the existing DEP-001 image build.

Absence of any prerequisite is a deployment blocker and is not repaired by inventing infrastructure policy.
