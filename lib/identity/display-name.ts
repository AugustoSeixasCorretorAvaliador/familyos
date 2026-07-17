type PersonName = {
  firstName?: string | null;
  lastName?: string | null;
} | null;

export type DisplayNameInput = {
  person?: PersonName;
  profileDisplayName?: string | null;
  userMetadata?: Record<string, unknown> | null;
  email?: string | null;
};

export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function personDisplayName(person: PersonName | undefined) {
  if (!person) return null;
  return normalizeDisplayName(
    [person.firstName, person.lastName]
      .map(normalizeDisplayName)
      .filter((part): part is string => Boolean(part))
      .join(" ")
  );
}

export function resolveDisplayName(input: DisplayNameInput) {
  const linkedPersonName = personDisplayName(input.person);
  if (linkedPersonName) return linkedPersonName;

  const profileName = normalizeDisplayName(input.profileDisplayName);
  if (profileName) return profileName;

  const metadataFullName = normalizeDisplayName(input.userMetadata?.full_name);
  if (metadataFullName) return metadataFullName;

  const metadataName = normalizeDisplayName(input.userMetadata?.name);
  if (metadataName) return metadataName;

  const emailPrefix = normalizeDisplayName(input.email?.split("@")[0]);
  return emailPrefix ?? "usuário";
}
