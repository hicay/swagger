import { Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiResponseWrapper,
  DocumentBuilder,
  SwaggerModule
} from '../lib/index.js';

describe('SwaggerModule response wrapper', () => {
  class Envelope {
    @ApiProperty()
    success: boolean;

    @ApiProperty({ required: false })
    traceId?: string;
  }

  class LegacyEnvelope {
    @ApiProperty()
    status: string;
  }

  class CatDto {
    @ApiProperty()
    name: string;
  }

  class ErrorDto {
    @ApiProperty()
    message: string;
  }

  @Controller('cats')
  @ApiNotFoundResponse({ type: ErrorDto })
  class CatsController {
    @Get()
    @ApiOkResponse({ type: [CatDto] })
    findAll() {}

    @Get(':id')
    @ApiOkResponse({ type: CatDto })
    findOne() {}

    @Post()
    @ApiCreatedResponse({ description: 'created, no payload documented' })
    create() {}

    @Get('raw')
    @ApiResponseWrapper(false)
    @ApiOkResponse({ type: CatDto })
    raw() {}
  }

  @Controller('legacy')
  @ApiResponseWrapper(LegacyEnvelope, { property: 'result' })
  class LegacyController {
    @Get()
    @ApiOkResponse({ type: CatDto })
    findAll() {}
  }

  @Module({ controllers: [CatsController, LegacyController] })
  class AppModule {}

  const envelopeRef = (name: string) => ({
    $ref: `#/components/schemas/${name}`
  });

  it('wraps 2xx payloads into the configured envelope', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder().setTitle('t').setVersion('1').build();
    const document = SwaggerModule.createDocument(app, config, {
      responseWrapper: { type: Envelope }
    });
    const schemaOf = (path: string, method: 'get' | 'post', status: string) =>
      (document.paths[path][method]!.responses[status] as any).content[
        'application/json'
      ].schema;

    expect(schemaOf('/cats', 'get', '200')).toEqual({
      allOf: [
        envelopeRef('Envelope'),
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: envelopeRef('CatDto')
            }
          },
          required: ['data']
        }
      ]
    });
    expect(
      schemaOf('/cats/{id}', 'get', '200').allOf[1].properties.data
    ).toEqual(envelopeRef('CatDto'));

    // Error responses inherited from the controller are untouched, and the
    // shared controller-level response object is not wrapped repeatedly.
    expect(schemaOf('/cats', 'get', '404')).toEqual(envelopeRef('ErrorDto'));
    expect(schemaOf('/cats/{id}', 'get', '404')).toEqual(
      envelopeRef('ErrorDto')
    );

    // A response that documents no payload has nothing to wrap.
    expect(
      (document.paths['/cats'].post!.responses['201'] as any).content
    ).toBeUndefined();

    // Handler-level opt-out.
    expect(schemaOf('/cats/raw', 'get', '200')).toEqual(envelopeRef('CatDto'));

    // Controller-level override with a different envelope and property.
    expect(schemaOf('/legacy', 'get', '200')).toEqual({
      allOf: [
        envelopeRef('LegacyEnvelope'),
        {
          type: 'object',
          properties: { result: envelopeRef('CatDto') },
          required: ['result']
        }
      ]
    });

    // Both envelopes are registered as components.
    expect(document.components!.schemas!.Envelope).toEqual({
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        traceId: { type: 'string' }
      },
      required: ['success']
    });
    expect(document.components!.schemas!.LegacyEnvelope).toBeDefined();

    await app.close();
  });

  it('wraps nothing when no wrapper is configured', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder().setTitle('t').setVersion('1').build();
    const document = SwaggerModule.createDocument(app, config);

    expect(
      (document.paths['/cats'].get!.responses['200'] as any).content[
        'application/json'
      ].schema
    ).toEqual({ type: 'array', items: envelopeRef('CatDto') });
    expect(document.components!.schemas!.Envelope).toBeUndefined();
    // The decorator on LegacyController still applies on its own.
    expect(
      (document.paths['/legacy'].get!.responses['200'] as any).content[
        'application/json'
      ].schema.allOf[0]
    ).toEqual(envelopeRef('LegacyEnvelope'));

    await app.close();
  });
});
