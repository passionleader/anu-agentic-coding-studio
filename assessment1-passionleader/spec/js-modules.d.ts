// The app under `js/` is deliberately plain, untyped JavaScript (see
// CLAUDE.md's "No TypeScript in the app code") — `allowJs` stays off so
// `tsc --noEmit` never tries to strictly type-check it. This just tells the
// spec suite's TypeScript that importing one of those modules is fine; the
// exports themselves are untyped (`any`), same as they are at runtime.
declare module "*.js";
