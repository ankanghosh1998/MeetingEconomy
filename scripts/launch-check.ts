import { existsSync, readFileSync } from "node:fs";

type Check = {
  name: string;
  ok: boolean;
  detail?: string;
};

function readDotEnv() {
  if (!existsSync(".env")) return {};
  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
      })
  );
}

const env = {
  ...readDotEnv(),
  ...process.env
};

function value(name: string) {
  return String(env[name] ?? "").trim();
}

function configured(name: string) {
  const current = value(name);
  return Boolean(current && current !== "<UNSPECIFIED>");
}

function isHttps(name: string) {
  return value(name).startsWith("https://");
}

function encryptionKeyOk() {
  const current = value("ENCRYPTION_KEY");
  if (!current || current === "<UNSPECIFIED>") return false;
  const decoded = Buffer.from(current, "base64");
  return current.length >= 32 || decoded.length === 32;
}

const checks: Check[] = [
  {
    name: "DATABASE_URL configured",
    ok: configured("DATABASE_URL")
  },
  {
    name: "REDIS_URL configured",
    ok: configured("REDIS_URL")
  },
  {
    name: "JWT_SECRET is production length",
    ok: configured("JWT_SECRET") && value("JWT_SECRET").length >= 32,
    detail: "Use at least 32 random characters."
  },
  {
    name: "ENCRYPTION_KEY is set",
    ok: encryptionKeyOk(),
    detail: "Use 32 random bytes, ideally base64 encoded."
  },
  {
    name: "API_URL is HTTPS",
    ok: isHttps("API_URL")
  },
  {
    name: "WEB_URL is HTTPS",
    ok: isHttps("WEB_URL")
  },
  {
    name: "CORS_ORIGIN includes WEB_URL",
    ok: configured("CORS_ORIGIN") && value("CORS_ORIGIN").split(",").map((item) => item.trim()).includes(value("WEB_URL"))
  },
  {
    name: "Google OAuth configured",
    ok:
      configured("GOOGLE_CLIENT_ID") &&
      configured("GOOGLE_CLIENT_SECRET") &&
      isHttps("GOOGLE_REDIRECT_URI") &&
      isHttps("GOOGLE_CALENDAR_REDIRECT_URI")
  },
  {
    name: "Microsoft OAuth configured",
    ok:
      configured("MICROSOFT_CLIENT_ID") &&
      configured("MICROSOFT_CLIENT_SECRET") &&
      isHttps("MICROSOFT_REDIRECT_URI")
  },
  {
    name: "OpenAI configured",
    ok: configured("OPENAI_API_KEY")
  },
  {
    name: "Email provider configured",
    ok: configured("SENDGRID_API_KEY") || (configured("SMTP_HOST") && configured("SMTP_USER") && configured("SMTP_PASS"))
  },
  {
    name: "Production Redis readiness enabled",
    ok: value("READINESS_CHECK_REDIS") === "true"
  }
];

let failed = 0;
for (const check of checks) {
  const marker = check.ok ? "PASS" : "FAIL";
  console.log(`${marker} ${check.name}${check.detail && !check.ok ? ` - ${check.detail}` : ""}`);
  if (!check.ok) failed += 1;
}

if (failed) {
  console.error(`\n${failed} launch check(s) failed.`);
  process.exit(1);
}

console.log("\nLaunch configuration checks passed.");
