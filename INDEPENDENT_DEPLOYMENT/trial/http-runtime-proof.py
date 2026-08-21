#!/usr/bin/env python3
import concurrent.futures
import json
import uuid
import urllib.request

BASE = "http://127.0.0.1:8080"
CONTRACT = "APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0"


def get_json(path: str):
    with urllib.request.urlopen(BASE + path, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def post_intent(key: str, conflict: bool = False):
    payload = {
        "intent_contract_ref": CONTRACT,
        "payload": {
            "messageId": str(uuid.uuid4()),
            "idempotencyKey": key,
            "correlationId": str(uuid.uuid4()),
        },
    }
    if conflict:
        payload["payload"]["conflictProbe"] = True
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        BASE + "/api/v1/ui/intents",
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


before = {
    "work": get_json("/api/v1/ui/work-queue"),
    "intake": get_json("/api/v1/ui/intake"),
}

seq_key = str(uuid.uuid4())
seq_created = post_intent(seq_key)
seq_replay = post_intent(seq_key)
seq_conflict = post_intent(seq_key, True)

identical_key = str(uuid.uuid4())
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    identical_results = list(executor.map(lambda _: post_intent(identical_key), range(8)))

mixed_key = str(uuid.uuid4())
mixed_seed = post_intent(mixed_key)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    mixed_futures = [executor.submit(post_intent, mixed_key, False) for _ in range(4)]
    mixed_futures += [executor.submit(post_intent, mixed_key, True) for _ in range(4)]
    mixed_results = [future.result() for future in mixed_futures]

after = {
    "work": get_json("/api/v1/ui/work-queue"),
    "intake": get_json("/api/v1/ui/intake"),
}

identical_created = [item for item in identical_results if item.get("disposition") == "CREATED"]
identical_replays = [item for item in identical_results if item.get("disposition") == "IDEMPOTENT_REPLAY"]
identical_conflicts = [item for item in identical_results if item.get("disposition") == "CONFLICT_HOLD"]
identical_case_ids = sorted({item.get("caseId") for item in identical_results if item.get("caseId")})

mixed_replays = [item for item in mixed_results if item.get("disposition") == "IDEMPOTENT_REPLAY"]
mixed_conflicts = [item for item in mixed_results if item.get("disposition") == "CONFLICT_HOLD"]
mixed_created = [item for item in mixed_results if item.get("disposition") == "CREATED"]

result = {
    "keys": {
        "sequential": seq_key,
        "identical": identical_key,
        "mixed": mixed_key,
    },
    "before": before,
    "sequential": {
        "created": seq_created,
        "replay": seq_replay,
        "conflict": seq_conflict,
    },
    "identical_concurrency": {
        "results": identical_results,
        "created_count": len(identical_created),
        "replay_count": len(identical_replays),
        "conflict_count": len(identical_conflicts),
        "case_ids": identical_case_ids,
    },
    "mixed_concurrency": {
        "seed": mixed_seed,
        "results": mixed_results,
        "created_count": len(mixed_created),
        "replay_count": len(mixed_replays),
        "conflict_count": len(mixed_conflicts),
    },
    "after": after,
}
print(json.dumps(result, separators=(",", ":")))
