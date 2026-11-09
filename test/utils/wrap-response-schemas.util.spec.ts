import { ResponsesObject } from '../../lib/interfaces/open-api-spec.interface';
import { wrapResponseSchemas } from '../../lib/utils/wrap-response-schemas.util';

describe('wrapResponseSchemas', () => {
  const ref = '#/components/schemas/Envelope';
  const responses: ResponsesObject = {
    '200': {
      description: 'ok',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/Cat' } }
      }
    },
    '201': { description: 'created' },
    '404': {
      description: 'missing',
      content: { 'application/json': { schema: { type: 'string' } } }
    },
    default: { $ref: '#/components/responses/Error' }
  };

  it('wraps 2xx payloads into allOf with the envelope and leaves others alone', () => {
    const wrapped = wrapResponseSchemas(responses, ref, {});

    expect(wrapped['200']).toEqual({
      description: 'ok',
      content: {
        'application/json': {
          schema: {
            allOf: [
              { $ref: ref },
              {
                type: 'object',
                properties: { data: { $ref: '#/components/schemas/Cat' } },
                required: ['data']
              }
            ]
          }
        }
      }
    });
    expect(wrapped['201']).toBe(responses['201']);
    expect(wrapped['404']).toBe(responses['404']);
    expect(wrapped.default).toBe(responses.default);
  });

  it('does not mutate the input', () => {
    const snapshot = JSON.parse(JSON.stringify(responses));
    wrapResponseSchemas(responses, ref, {});
    expect(responses).toEqual(snapshot);
  });

  it('honours a custom property and explicit status codes', () => {
    const wrapped = wrapResponseSchemas(responses, ref, {
      property: 'result',
      statusCodes: [404]
    });
    expect(wrapped['200']).toBe(responses['200']);
    expect(
      (wrapped['404'] as any).content['application/json'].schema.allOf[1]
    ).toEqual({
      type: 'object',
      properties: { result: { type: 'string' } },
      required: ['result']
    });
  });

  it('matches the 2XX range key by default', () => {
    const wrapped = wrapResponseSchemas(
      {
        '2XX': {
          description: 'any success',
          content: { 'application/json': { schema: { type: 'number' } } }
        }
      },
      ref,
      {}
    );
    expect(
      (wrapped['2XX'] as any).content['application/json'].schema.allOf
    ).toHaveLength(2);
  });

  it('returns undefined input untouched', () => {
    expect(wrapResponseSchemas(undefined, ref, {})).toBeUndefined();
  });
});
