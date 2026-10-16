export function anchorId(id: string): string {
  return `item-${id.replace(/[^A-Za-z0-9._-]+/g, "-")}`;
}

export function sessionPath(sessionNumber: string, anchor?: string): string {
  const path = `/session/${encodeURIComponent(sessionNumber)}`;
  return anchor ? `${path}#${anchor}` : path;
}
