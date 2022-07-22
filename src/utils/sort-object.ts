export function sortObject<T extends Record<string, unknown>>(
	object: T,
	comparator: (a: string, b: string) => number,
): T {
	const entries = Object.entries(object);
	entries.sort(([a], [b]) => comparator(a, b));
	return Object.fromEntries(entries) as T;
}
