function cleanEnvValue(value: string | undefined) {
  return value?.replace(/^\uFEFF+/, "").trim();
}

export function getSupabaseConfig() {
  // Keep these as direct property accesses so Next.js can inline NEXT_PUBLIC vars in the browser bundle.
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return url && key ? { url, key } : null;
}
