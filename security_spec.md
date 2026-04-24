# Security Specification - AgriCopilot

## 1. Data Invariants
- A **Diagnosis** must belong to the user who created it (`userId` check).
- A **UserProfile** is immutable once created regarding its `uid`, `email`, and `createdAt`. Users can only increment their `usageCount` or change their `tier`.
- **QualityCertificates**, **WeatherAlerts**, and **MarketQueries** are strictly owned by the creator.
- **GovSchemes** are public for reading but only editable by admins.

## 2. The "Dirty Dozen" Payloads
These payloads should be rejected by the rules:

1. **Identity Spoofing**: Attempt to create a diagnosis with someone else's `userId`.
2. **Key Injection**: Attempt to create a diagnosis with a "Ghost Field" like `isVerified: true`.
3. **Privilege Escalation**: Attempt to create a user profile with `role: 'admin'`.
4. **ID Poisoning**: Attempt to GET a document with a 2KB malicious string as an ID.
5. **State Skipping**: Attempt to UPDATE a diagnosis `qualitativeSeverity` from 'Low' to 'High' while injecting a `helpful` rating in the same request without being allowed. (Actually, logic checks).
6. **Immutable Violation**: Attempt to update `userId` on a diagnosis.
7. **Timestamp Spoofing**: Attempt to set `createdAt` to a future date instead of `request.time`.
8. **Size Attack**: Attempt to save a 1MB string into the `crop` field.
9. **PII Leak**: Attempt to READ another user's profile.
10. **Admin Bypass**: Attempt to perform admin-only delete as a standard user.
11. **Type Poisoning**: Sending a list for a field that should be a string (e.g. `crop: []`).
12. **Orphaned Record**: Creating a diagnosis without a matching `userId` in the `users` collection (Relational Sync).

## 3. Test Runner
We will use the following `firestore.rules.test.ts` pattern to verify these. (Note: I will provide the rules first, then the test).
