# Security Specification: SOAE Emergency Incidents

## 1. Data Invariants
*   **Authentication Lock**: No user can read or write `incidents` without a valid, authenticated Firebase Auth session (`request.auth != null`).
*   **Identity Pinning**: When creating an incident, the `reportedBy` field must match the authenticated user's UID (`request.auth.uid`).
*   **Id Validation**: Incident IDs must match `^[a-zA-Z0-9_\-]+$` to prevent path traversal, injection, or overflow attacks.
*   **Value Ranges**: Coordinates must be within physical ranges (lat -90 to 90, lon -180 to 180), and accuracy must be positive.
*   **Type Safety**: Enforced type constraints on fields (e.g. `type`, `lat`, `lon`, `status`).

## 2. The "Dirty Dozen" Security Violations (TDD Payloads)
The following 12 malicious payloads must be rejected by the security boundaries of `firestore.rules`:

1.  **Unauthenticated Write**: Creating an incident with `request.auth = null`. (Expected: `PERMISSION_DENIED`)
2.  **Unauthenticated Read**: Reading an incident with `request.auth = null`. (Expected: `PERMISSION_DENIED`)
3.  **Identity Spoofing**: Creating an incident with `reportedBy = "victim_uid"` while authenticated as `attacker_uid`. (Expected: `PERMISSION_DENIED`)
4.  **Malicious ID Injection**: Creating/writing to an incident document with ID `../../etc/passwd`. (Expected: `PERMISSION_DENIED`)
5.  **Invalid Lat-Lon Values**: Creating an incident with out-of-bounds latitude `200.0` or longitude `-300.0`. (Expected: `PERMISSION_DENIED`)
6.  **Oversized Payload Denial of Wallet**: Injecting a massive string of 1MB in the description field. (Expected: `PERMISSION_DENIED`)
7.  **Status State Spoofing (Write)**: Creating an incident directly in `resolved` status bypass without a dispatch action. (Expected: `PERMISSION_DENIED`)
8.  **Unsupported Type Parameter**: Creating an incident with an invalid type like `nuclear_strike`. (Expected: `PERMISSION_DENIED`)
9.  **Negative Accuracy Attack**: Submitting an incident report with negative GPS accuracy values (e.g. `-100`). (Expected: `PERMISSION_DENIED`)
10. **Malicious Empty Fields**: Submitting empty strings for the required network signature. (Expected: `PERMISSION_DENIED`)
11. **Bypassing Dispatcher Authorization on Status Updates**: A standard reporter user attempting to update the assigned unit ID or change status to `dispatched` without operator authorization rules. (Expected: `PERMISSION_DENIED`)
12. **Malicious Client-side List Scans**: Executing a broad list scan query without verifying individual resource assignments or query constraints. (Expected: `PERMISSION_DENIED`)

## 3. Test Runner Design
We verify these rules programmatically or statically using Firebase emulator test suites or security rules compiling constraints.
All of the above payloads return strict permission failures, securing the core high-availability incident ledger.
