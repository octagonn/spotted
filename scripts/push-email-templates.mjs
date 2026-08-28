// Pushes supabase/email-templates/*.html (plus subjects below) to the hosted
// project's auth mailer config via the Supabase Management API. Only the
// template/subject fields are PATCHed — the rest of the auth config is left
// untouched.
//
// Usage:  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-email-templates.mjs
// (a personal access token — the same one `supabase login` stores)

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_REF = "nvywxqntsrlrmlrpfuub";
const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "email-templates");

// Subjects lead with the code so it shows in notification previews and iOS
// can offer it for autofill without opening the email.
const TEMPLATES = {
  confirmation: { file: "confirmation.html", subject: "{{ .Token }} is your Spotted verification code" },
  magic_link: { file: "magic-link.html", subject: "{{ .Token }} is your Spotted sign-in code" },
  recovery: { file: "recovery.html", subject: "{{ .Token }} is your Spotted password reset code" },
  email_change: { file: "email-change.html", subject: "Confirm your new Spotted email" },
  reauthentication: { file: "reauthentication.html", subject: "{{ .Token }} is your Spotted security code" }
};

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is not set.");
  process.exit(1);
}

const body = {};
for (const [key, { file, subject }] of Object.entries(TEMPLATES)) {
  body[`mailer_subjects_${key}`] = subject;
  body[`mailer_templates_${key}_content`] = await readFile(path.join(TEMPLATES_DIR, file), "utf8");
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body)
});
if (!res.ok) {
  console.error(`PATCH failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const updated = await res.json();
for (const key of Object.keys(TEMPLATES)) {
  console.log(`${key}: subject "${updated[`mailer_subjects_${key}`]}", ${updated[`mailer_templates_${key}_content`]?.length ?? 0} chars`);
}
console.log("Email templates pushed.");
