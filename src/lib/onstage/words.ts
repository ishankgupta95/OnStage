/** "1 file", "3 files" — a count with its noun, singular when it is one. */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
