import {
  ReferenceObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject
} from '../interfaces/open-api-spec.interface.js';
import { ResponseWrapperOptions } from '../interfaces/swagger-document-options.interface.js';

export const DEFAULT_RESPONSE_WRAPPER_PROPERTY = 'data';

function matchesStatus(
  status: string,
  statusCodes: ResponseWrapperOptions['statusCodes']
): boolean {
  if (!statusCodes) {
    return /^2\d\d$/.test(status) || status.toUpperCase() === '2XX';
  }
  return statusCodes.some((code) => String(code) === status);
}

function isReference(
  response: ResponseObject | ReferenceObject
): response is ReferenceObject {
  return '$ref' in response;
}

/**
 * Returns a copy of `responses` where every matching payload schema is
 * replaced by `allOf: [<envelope>, { properties: { [property]: <schema> } }]`.
 * Responses that declare no schema are left alone: there is no payload to
 * put into the envelope. The input is not mutated, as controller-level
 * responses are shared between the handlers of a controller.
 */
export function wrapResponseSchemas(
  responses: ResponsesObject | undefined,
  envelopeRef: string,
  options: Omit<ResponseWrapperOptions, 'type'>
): ResponsesObject | undefined {
  if (!responses) {
    return responses;
  }
  const property = options.property ?? DEFAULT_RESPONSE_WRAPPER_PROPERTY;
  const wrapped: ResponsesObject = {};

  for (const [status, response] of Object.entries(responses)) {
    if (
      !response ||
      isReference(response) ||
      !response.content ||
      !matchesStatus(status, options.statusCodes)
    ) {
      wrapped[status] = response;
      continue;
    }
    const content: ResponseObject['content'] = {};
    for (const [mimeType, mediaType] of Object.entries(response.content)) {
      if (!mediaType?.schema) {
        content[mimeType] = mediaType;
        continue;
      }
      const payload: SchemaObject = {
        type: 'object',
        properties: { [property]: mediaType.schema },
        required: [property]
      };
      content[mimeType] = {
        ...mediaType,
        schema: { allOf: [{ $ref: envelopeRef }, payload] }
      };
    }
    wrapped[status] = { ...response, content };
  }
  return wrapped;
}
