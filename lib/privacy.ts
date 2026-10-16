const EMAIL_TEST = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const EMAIL_FIND = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function stripEmails(value: string): string {
  return value
    .replace(EMAIL_FIND, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

export function containsEmail(value: string): boolean {
  EMAIL_TEST.lastIndex = 0;
  return EMAIL_TEST.test(value);
}

export function assertNoEmails(value: unknown, path = "$"): void {
  if (typeof value === "string") {
    if (containsEmail(value)) {
      throw new Error(`Blocked personal contact data at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoEmails(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/email|e-mail|phone|mobile|fax/i.test(key)) {
        throw new Error(`Blocked field ${path}.${key}`);
      }
      assertNoEmails(child, `${path}.${key}`);
    }
  }
}
