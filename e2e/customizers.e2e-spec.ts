import { Controller, Get, Module, Post, SetMetadata } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ApiOkResponse,
  ApiProperty,
  DocumentBuilder,
  OperationContext,
  SwaggerModule
} from '../lib/index.js';

describe('SwaggerModule customizers', () => {
  const AUDIENCE = 'audience';
  const Audience = (audience: 'public' | 'internal') =>
    SetMetadata(AUDIENCE, audience);

  class CatDto {
    @ApiProperty()
    name: string;
  }

  @Controller('cats')
  class CatsController {
    @Get()
    @Audience('public')
    @ApiOkResponse({ type: CatDto })
    findAll() {}

    @Post('reindex')
    @Audience('internal')
    reindex() {}
  }

  @Controller('admin')
  @Audience('internal')
  class AdminController {
    @Get()
    stats() {}
  }

  @Module({ controllers: [CatsController, AdminController] })
  class AppModule {}

  const audienceOf = ({ handler, controller }: OperationContext) =>
    Reflect.getMetadata(AUDIENCE, handler!) ??
    Reflect.getMetadata(AUDIENCE, controller!) ??
    'public';

  it('hands the controller and handler to operation customizers', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const seen: Array<[string, string, string, string]> = [];
    const config = new DocumentBuilder().setTitle('t').setVersion('1').build();
    SwaggerModule.createDocument(app, config, {
      operationCustomizers: [
        (operation, context) => {
          seen.push([
            context.method,
            context.path,
            context.controller!.name,
            context.methodName!
          ]);
          expect(typeof context.handler).toBe('function');
          expect(operation.responses).toBeDefined();
        }
      ]
    });

    expect(seen.sort()).toEqual([
      ['get', '/admin', 'AdminController', 'stats'],
      ['get', '/cats', 'CatsController', 'findAll'],
      ['post', '/cats/reindex', 'CatsController', 'reindex']
    ]);

    await app.close();
  });

  it('filters operations and drops path items left empty', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder().setTitle('t').setVersion('1').build();
    const document = SwaggerModule.createDocument(app, config, {
      operationCustomizers: [
        (_operation, context) => audienceOf(context) === 'public'
      ]
    });

    expect(Object.keys(document.paths).sort()).toEqual(['/cats']);
    expect(Object.keys(document.paths['/cats'])).toEqual(['get']);

    await app.close();
  });

  it('applies customizers in order and accepts replacements', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder().setTitle('t').setVersion('1').build();
    const document = SwaggerModule.createDocument(app, config, {
      operationCustomizers: [
        (operation, context) => {
          (operation as any)['x-audience'] = audienceOf(context);
        },
        (operation) => ({
          ...operation,
          summary: `[${(operation as any)['x-audience']}] ${operation.operationId}`
        })
      ],
      documentCustomizers: [
        (doc) => {
          doc.info.title = `${doc.info.title} (customized)`;
        },
        (doc) => ({ ...doc, 'x-generated-by': 'test' }) as any
      ]
    });

    expect(document.paths['/cats'].get!.summary).toBe(
      '[public] CatsController_findAll'
    );
    expect((document.paths['/admin'].get as any)['x-audience']).toBe(
      'internal'
    );
    expect(document.info.title).toBe('t (customized)');
    expect((document as any)['x-generated-by']).toBe('test');

    await app.close();
  });
});
