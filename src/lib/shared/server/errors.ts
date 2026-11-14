export class AppError extends Error {
	readonly statusCode: number;
	readonly code: string;

	constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
		super(message);
		this.name = new.target.name;
		this.statusCode = statusCode;
		this.code = code;
	}
}

export class ValidationError extends AppError {
	constructor(message: string, code = 'VALIDATION_ERROR') {
		super(message, 400, code);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = 'Silakan masuk terlebih dahulu.', code = 'UNAUTHORIZED') {
		super(message, 401, code);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = 'Anda tidak memiliki akses ke data ini.', code = 'FORBIDDEN') {
		super(message, 403, code);
	}
}

export class NotFoundError extends AppError {
	constructor(message = 'Data tidak ditemukan.', code = 'NOT_FOUND') {
		super(message, 404, code);
	}
}

export class ConfigError extends AppError {
	constructor(message: string, code = 'CONFIG_ERROR') {
		super(message, 500, code);
	}
}

export function toUserMessage(error: unknown, fallback = 'Terjadi kesalahan pada server.'): string {
	if (error instanceof AppError) {
		return error.message;
	}
	return fallback;
}

