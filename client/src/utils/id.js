/** Short unique id for list rows, history entries and saved requests. */
export function uid(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
