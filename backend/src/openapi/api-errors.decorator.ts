import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './error-response.dto';

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 503;

// Documents the errors of an endpoint, or of every endpoint in a controller,
// with what each one means there. An endpoint's own entry replaces the
// controller's entry for the same status.
export function ApiErrors(errors: Partial<Record<ErrorStatus, string>>) {
  return applyDecorators(
    ...Object.entries(errors).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        type: ErrorResponseDto,
      }),
    ),
  );
}

// The errors every rate-limited endpoint can return.
export const COMMON_ERRORS = {
  429: 'Too many requests from this IP address. Try again in a minute.',
  503: 'The database or the email service is unavailable.',
} satisfies Partial<Record<ErrorStatus, string>>;

export const SIGNED_IN_ERRORS = {
  401: 'The access token is missing or expired, or its session has ended.',
} satisfies Partial<Record<ErrorStatus, string>>;
