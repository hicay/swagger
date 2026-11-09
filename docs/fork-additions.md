# Fork additions

Features of this fork that are not (yet) in `@nestjs/swagger`. All of them are
opt-in: a project that does not use them gets the same document as upstream.

## Operation and document customizers

`SwaggerDocumentOptions` gained two hooks.

```ts
const document = SwaggerModule.createDocument(app, config, {
  operationCustomizers: [
    // read your own decorators through the handler / controller
    (operation, { handler, controller, path, method }) => {
      const audience =
        Reflect.getMetadata('audience', handler) ??
        Reflect.getMetadata('audience', controller) ??
        'public';
      if (audience !== 'public') {
        return false; // drop the operation; empty path items are removed too
      }
      operation['x-audience'] = audience; // or mutate in place
    }
  ],
  documentCustomizers: [
    (document) => {
      document.info.title += ` (${process.env.STAGE})`;
    }
  ]
});
```

An operation customizer runs once per assembled operation (webhooks included,
see `context.isWebhook`). It may mutate the operation, return a replacement,
or return `false` to leave it out. Document customizers run last on the
finished document. This is the generic answer to "register my custom
decorator" (nestjs/swagger#32): the decorator stores metadata, the customizer
turns it into OpenAPI.

## Response wrapper (envelope)

For APIs whose interceptor wraps every payload, e.g. `{ data: <payload> }`
(nestjs/swagger#2267).

```ts
class Envelope {
  @ApiProperty() success: boolean;
  @ApiProperty({ required: false }) traceId?: string;
}

SwaggerModule.createDocument(app, config, {
  responseWrapper: { type: Envelope } // property defaults to 'data'
});
```

Every 2xx response that documents a schema becomes

```yaml
allOf:
  - $ref: '#/components/schemas/Envelope'
  - type: object
    required: [data]
    properties:
      data: <original schema>
```

Options: `property` (default `data`) and `statusCodes` (default: all 2xx,
`'2XX'` included). Responses without a schema and `$ref` responses are left
alone. Override or opt out per controller or handler:

```ts
@Controller('legacy')
@ApiResponseWrapper(LegacyEnvelope, { property: 'result' })
class LegacyController {}

@Get('stream')
@ApiResponseWrapper(false)
stream() {}
```

