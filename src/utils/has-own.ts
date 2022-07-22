const { hasOwnProperty } = Object.prototype;

export const hasOwn = (
	object: unknown,
	property: string,
) => hasOwnProperty.call(object, property);
