import { ApiProperty } from '@nestjs/swagger';

// The body of every error response. Nest adds statusCode and error to most
// of them. Errors with a code carry only code and message.
export class ErrorResponseDto {
  /** The HTTP status code. */
  statusCode?: number;

  /** What went wrong. A validation error lists one message per problem. */
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  /** The HTTP status text, such as "Not Found". */
  error?: string;

  /**
   * Set when the client needs to tell this error apart from others with the
   * same status: EMAIL_NOT_VERIFIED, EMAIL_ALREADY_REGISTERED or
   * EMAIL_VERIFICATION_PENDING.
   */
  code?: string;
}
