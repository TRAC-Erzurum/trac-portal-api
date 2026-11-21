## Summary
<!-- What changes and why, in one or two sentences. -->

## Linked issue
<!-- Root repo issue: Closes TRAC-Erzurum/trac-portal#<number> -->

## What changed
<!-- Main files, modules, endpoints or migrations touched. -->

## Verify
<!-- Output of `yarn verify` (pass/fail and anything notable). -->
- [ ] `yarn verify` passes locally

## Test justification
<!-- Only if a test was added: one sentence on which reason in the testing policy applies (auth/authz, data integrity or irreversible operation, non-trivial pure logic, or a production bug likely to recur). Delete the section if no test was added. -->

## Risk notes
<!-- Migrations (is `down()` a true reverse? any irreversible data step?), auth or role changes, API contract changes for trac-portal-ui, new env vars, rollout impact. "None" is acceptable. -->
- [ ] No secrets, `.env` values or tokens in the diff or logs
- [ ] Deployment is done manually by product owners; this PR does not trigger one

🤖 Generated with [Claude Code](https://claude.com/claude-code)
