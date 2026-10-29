import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request, { type Response } from 'supertest';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

// Checks every response of the e2e tests against openapi.json, the contract
// the frontend generates its types from. A response fails when its status is
// not documented for the endpoint, or its body does not match the schema.

type MediaType = { schema: object };
type ResponseObject = { content?: Record<string, MediaType> };
type Operation = { responses: Record<string, ResponseObject> };
type OpenApiDocument = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, object> };
};

const document = JSON.parse(
  readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8'),
) as OpenApiDocument;

// The contract lists every field a response may carry. Rejecting the rest
// catches a column that leaks into a response, such as passwordHash.
function rejectUnlistedProperties(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(rejectUnlistedProperties);
  if (!schema || typeof schema !== 'object') return schema;

  const result = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      rejectUnlistedProperties(value),
    ]),
  );
  if ('properties' in result && !('additionalProperties' in result)) {
    result.additionalProperties = false;
  }
  return result;
}

const components = rejectUnlistedProperties(document.components);
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Literal paths first, so /api/applications/my never matches a template.
const routes = Object.entries(document.paths)
  .map(([template, operations]) => ({
    template,
    operations,
    pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
  }))
  .sort(
    (a, b) =>
      (a.template.match(/\{/g)?.length ?? 0) -
      (b.template.match(/\{/g)?.length ?? 0),
  );

const validators = new Map<object, ValidateFunction>();

function validatorFor(schema: object) {
  let validate = validators.get(schema);
  if (!validate) {
    // With the components alongside, refs such as
    // #/components/schemas/ListingDto resolve as in the document.
    validate = ajv.compile({
      ...(rejectUnlistedProperties(schema) as object),
      components,
    });
    validators.set(schema, validate);
  }
  return validate;
}

// Returns why the response breaks the contract, or undefined. Paths the
// contract does not list, such as a 404 for an unknown route, are skipped.
export function contractViolation(
  method: string,
  url: string,
  response: Pick<Response, 'status' | 'body'>,
): string | undefined {
  const path = url.split('?')[0];
  const route = routes.find(({ pattern }) => pattern.test(path));
  const operation = route?.operations[method];
  if (!route || !operation) return undefined;

  const name = `${method.toUpperCase()} ${route.template}`;
  const documented = operation.responses[String(response.status)];
  if (!documented) {
    return `${name} returned ${response.status}, which openapi.json does not document`;
  }

  const schema = documented.content?.['application/json']?.schema;
  if (!schema) return undefined;

  const validate = validatorFor(schema);
  if (validate(response.body)) return undefined;
  return `${name} returned a ${response.status} body that does not match openapi.json: ${ajv.errorsText(validate.errors)}\n${JSON.stringify(response.body)}`;
}

type Method = 'get' | 'post' | 'patch' | 'delete';

// A supertest client that records every contract violation. Assert that
// the list is empty after each test.
export function contractCheckedRequest(
  server: Parameters<typeof request>[0],
  violations: string[],
) {
  const client = request(server);
  const send = (method: Method) => (url: string) => {
    const test = client[method](url);
    test.on('response', (response: Response) => {
      const violation = contractViolation(method, url, response);
      if (violation) violations.push(violation);
    });
    return test;
  };

  return {
    get: send('get'),
    post: send('post'),
    patch: send('patch'),
    delete: send('delete'),
  };
}
