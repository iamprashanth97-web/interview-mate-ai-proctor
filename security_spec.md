# InterviewMate Security Specification

## Data Invariants
1. A session must be owned by the candidate who started it.
2. Only candidates can create sessions.
3. Only admins can view all sessions. Candidates can only see their own.
4. Alerts are immutable once created.
5. All timestamps must come from `request.time`.

## The "Dirty Dozen" Payload Tests
1. **Identity Spoofing**: Candidate A tries to read Candidate B's session. (Denied)
2. **Role Escalation**: Candidate tries to update their own profile to 'ADMIN'. (Denied)
3. **Session Highjacking**: Candidate B tries to add alerts to Candidate A's session. (Denied)
4. **Terminal State Bypass**: Candidate tries to change status from 'COMPLETED' back to 'ONGOING'. (Denied)
5. **Ghost Field Injection**: Adding `isVerified: true` to a session document. (Denied)
6. **Self-Promotion**: New user tries to create a profile with `role: "ADMIN"`. (Denied)
7. **Cross-Session ID Poisoning**: Using a 1KB string as a session ID to cause cost attacks. (Denied)
8. **PII Leak**: Guest user tries to read `/users` collection. (Denied)
9. **History Manipulation**: Candidate tries to delete a session log. (Denied)
10. **Time Warp**: Candidate tries to set `startTime` to a future date. (Denied)
11. **Score Tampering**: Candidate tries to set `cheatingScore` to 0 on a completed session. (Denied)
12. **Admin Spoofing**: User tries to access `/sessions` listing without being in the `/admins` collection or having the role. (Denied)

## Test Runner (Draft)
A `firestore.rules.test.ts` would verify these scenarios using the Firebase Emulator.
