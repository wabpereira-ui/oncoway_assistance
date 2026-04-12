/** Primeiro nome para saudação (token antes do primeiro espaço). */
export function firstName(fullName) {
  if (!fullName || typeof fullName !== "string") return "";
  const t = fullName.trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}
