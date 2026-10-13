const supabaseUrl = process.env.E2E_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("E2E_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY werden für lokale Testnutzer benötigt.");
}

const parsedUrl = new URL(supabaseUrl);
if (
  parsedUrl.protocol !== "http:"
  || !["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname)
) {
  throw new Error("Testnutzer dürfen nur in einer lokalen Supabase-Instanz angelegt werden.");
}

const users = [
  {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
    app_metadata: { role: "admin" },
  },
  {
    email: process.env.E2E_MEMBER_EMAIL,
    password: process.env.E2E_MEMBER_PASSWORD,
    app_metadata: {},
  },
];

for (const user of users) {
  if (!user.email || !user.password) throw new Error("Lokale E2E-Konten benötigen E-Mail-Adresse und Passwort.");
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...user, email_confirm: true }),
  });
  if (!response.ok) {
    throw new Error(`Lokaler E2E-Nutzer ${user.email} konnte nicht angelegt werden: ${await response.text()}`);
  }
}
