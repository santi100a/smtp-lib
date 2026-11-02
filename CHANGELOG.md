# Changelog

## Version 1.0.0

- First version!

## Version 1.0.1

- Added basic docs.

## Version 1.0.2

- Added support for async filters and handlers.

## Version 1.0.3

- Fixed default `handleInternalError` behavior by replacing the non-standard `420` response code with the compliant `451` base code and `4.3.0` enhanced status code.
- Fixed a critical routing bug where the recipient validation phase mistakenly invoked the sender filter hook (`handleMailFrom`) instead of the proper `handleRcptTo` hook.
- Rewrote the string tokenizer to fully preserve email addresses containing `+` signs (aliases). The parser now correctly isolates and appends advanced ESMTP parameters (e.g., `SIZE`, `BODY`) instead of mixing them into the email address string.

- Expanded the `ServerConfig` interface for `handleInternalError` to officially support optional `command` and `response` parameters, enabling deep inspection of the specific network line that triggered the runtime failure.
- Updated `package.json` with strict conditional `exports` mapping to offer out-of-the-box interoperability for both CommonJS and native ES Modules (ESM). Added a `"files": ["dist"]` whitelist to drastically reduce package payload on npm.
- Updated `tsconfig.json` to target `ES2022` and enabled source maps (`sourceMap: true`) to provide precise stack traces referencing original TypeScript source files during external runtime errors.

## Version 1.0.4

- Fixed bug with default handler `MAIL FROM` where the mail transaction object was not initialized if the address was not empty and was accepted by `filterMailFrom`. This caused the `RCPT TO` command to fail with a `503 5.5.1` error because the mail transaction object was not set up correctly. The fix ensures that the mail transaction object is initialized properly when the sender address is accepted.
