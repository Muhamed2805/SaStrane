import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { REFRESH_COOKIE_NAME } from '../auth/refresh-cookie';

const DESCRIPTION = `The API of SaStrane, a marketplace for small local jobs.

Endpoints marked with a lock need an access token in the Authorization
header. Login, email verification and refresh return one. The refresh token
travels only in the httpOnly cookie ${REFRESH_COOKIE_NAME}, which the
browser sends to /api/auth.`;

// Builds the OpenAPI document from the controllers and DTOs. The types come
// from the @nestjs/swagger compiler plugin (see nest-cli.json), so the
// document is complete only in code built by the Nest CLI.
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('SaStrane API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE_NAME)
    .build();

  return SwaggerModule.createDocument(app, config, {
    // For example listings_getAll for ListingsController.getAll.
    operationIdFactory: (controllerKey, methodKey) => {
      const resource = controllerKey.replace(/Controller$/, '');
      return `${resource.charAt(0).toLowerCase()}${resource.slice(1)}_${methodKey}`;
    },
  });
}
