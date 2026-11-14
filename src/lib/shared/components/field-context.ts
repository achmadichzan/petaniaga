export interface FieldContext {
	/** id hint/error untuk aria-describedby */
	describedBy: () => string | undefined;
	/** true saat Field menerima pesan error */
	invalid: () => boolean;
}

export const FIELD_CONTEXT = Symbol('field-context');
