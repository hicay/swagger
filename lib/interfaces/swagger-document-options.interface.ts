import type { Type } from '@nestjs/common';
import type {
  StandardJSONSchemaV1,
  StandardSchemaV1
} from '@standard-schema/spec';
import type {
  OpenAPIObject,
  OperationObject
} from './open-api-spec.interface.js';

export type OperationIdFactory = (
  controllerKey: string,
  methodKey: string,
  version?: string
) => string;

export type StandardJsonSchemaConverter = StandardJSONSchemaV1.Converter;

export type StandardSchemaObject = StandardSchemaV1 | StandardJSONSchemaV1;

export interface StandardSchemaConversionResult {
  schema: unknown;
  components?: Record<string, any>;
}

export type StandardSchemaConverter = (
  schema: unknown,
  options: {
    schemaType: 'input' | 'output';
  }
) => StandardSchemaConversionResult | undefined;

/**
 * @publicApi
 */
export interface SwaggerDocumentOptions {
  /**
   * List of modules to include in the specification
   */
  include?: Function[];

  /**
   * Additional, extra models that should be inspected and included in the specification
   */
  extraModels?: Function[];

  /**
   * If `true`, swagger will ignore the global prefix set through `setGlobalPrefix()` method
   */
  ignoreGlobalPrefix?: boolean;

  /**
   * If `true`, swagger will also load routes from the modules imported by `include` modules
   */
  deepScanRoutes?: boolean;

  /**
   * Custom operationIdFactory that will be used to generate the `operationId`
   * based on the `controllerKey`, `methodKey`, and version.
   * @default () => controllerKey_methodKey_version
   */
  operationIdFactory?: OperationIdFactory;

  /**
   * Custom linkNameFactory that will be used to generate the name of links
   * in the `links` field of responses
   *
   * @see [Link objects](https://swagger.io/docs/specification/links/)
   *
   * @default () => `${controllerKey}_${methodKey}_from_${fieldKey}`
   */
  linkNameFactory?: (
    controllerKey: string,
    methodKey: string,
    fieldKey: string
  ) => string;

  /*
   * Generate tags automatically based on the controller name.
   * If `false`, you must use the `@ApiTags()` decorator to define tags.
   * Otherwise, the controller name without the suffix `Controller` will be used.
   * @default true
   */
  autoTagControllers?: boolean;

  /**
   * If `true`, swagger will only include routes that are decorated with the `@ApiIncludeEndpoint()` decorator.
   * Routes decorated with `@ApiIncludeEndpoint(false)` are treated as not decorated.
   * @default false
   */
  onlyIncludeDecoratedEndpoints?: boolean;
  /**
   * When `true`, any `default` value on a schema property that is a non-plain
   * object at runtime (e.g. `new Date()`, class instances) will be omitted from
   * the generated document. This prevents the spec from changing on every server
   * restart when dynamic initializers like `createdAt = new Date()` are used.
   * @default false
   */
  excludeDynamicDefaults?: boolean;

  /**
   * When set, generated `example` and `examples` values on component schemas are
   * truncated once their nested object/array depth exceeds this number. Useful
   * when DTOs hold user-supplied `@ApiProperty({ example })` payloads or
   * plugin-synthesized TSDoc `@example` metadata that inflates the document.
   * Truncation only affects example values; schema graphs (`$ref`s,
   * `properties`, `items`) are not modified. `0` collapses every non-primitive
   * example to `{}`/`[]`. `undefined` (the default) leaves examples untouched.
   *
   * Per-property `@ApiProperty({ exampleMaxDepth })` overrides this value for
   * a single schema entry without affecting siblings or children.
   *
   * @default undefined
   */
  exampleMaxDepth?: number;

  /**
   * Optional adapter that converts a Standard Schema instance supplied to Nest
   * route decorators into an OpenAPI schema.
   *
   * The callback receives the raw schema value so consumers can narrow it to
   * library-specific types (for example `z.ZodType`) without resorting to
   * unsafe casts.
   */
  standardSchemaConverter?: StandardSchemaConverter;

  /**
   * Hooks that run for every operation after it has been assembled. Use them
   * to add vendor extensions, rewrite descriptions, or filter operations
   * based on your own decorators (the handler and controller are passed in
   * the context). Run in order; a `false` return drops the operation.
   */
  operationCustomizers?: OperationCustomizer[];

  /**
   * Hooks that run on the finished document, in order.
   */
  documentCustomizers?: DocumentCustomizer[];

  /**
   * Wraps every (by default 2xx) response payload into an envelope schema,
   * mirroring a global response-transform interceptor. Override or disable it
   * per controller or handler with `@ApiResponseWrapper()`.
   */
  responseWrapper?: ResponseWrapperOptions;
}

/**
 * Where an operation came from. Handed to every {@link OperationCustomizer}
 * so it can read the metadata of custom decorators placed on the controller
 * or the handler.
 *
 * @publicApi
 */
export interface OperationContext {
  /**
   * OpenAPI path template, e.g. `/cats/{id}`.
   */
  path: string;
  /**
   * Lower-case HTTP method, e.g. `get`.
   */
  method: string;
  /**
   * The controller class.
   */
  controller?: Type<unknown>;
  /**
   * The route handler the Nest decorators were applied to.
   */
  handler?: Function;
  /**
   * Name of the handler on the controller.
   */
  methodName?: string;
  /**
   * `true` when the operation is emitted under `webhooks`.
   */
  isWebhook: boolean;
}

/**
 * Runs for every operation once it has been fully assembled. Mutate the
 * operation in place, return a replacement, or return `false` to leave the
 * operation out of the document. A path item that loses all its operations
 * is removed as well.
 *
 * @publicApi
 */
export type OperationCustomizer = (
  operation: OperationObject,
  context: OperationContext
) => OperationObject | boolean | void;

/**
 * Runs on the finished document, after every built-in post-processing step.
 * Mutate the document in place or return a replacement.
 *
 * @publicApi
 */
export type DocumentCustomizer = (
  document: OpenAPIObject
) => OpenAPIObject | void;

/**
 * Describes how response payloads are wrapped into an envelope, for APIs whose
 * interceptors return `{ data: <payload> }`-style objects.
 *
 * @publicApi
 */
export interface ResponseWrapperOptions {
  /**
   * The class describing the envelope. It is registered as a component schema
   * and referenced through `allOf`, so its own properties (`success`,
   * `meta`, ...) are documented once.
   */
  type: Type<unknown> | Function;
  /**
   * The envelope property that carries the original payload.
   * @default 'data'
   */
  property?: string;
  /**
   * Status codes whose responses are wrapped. Accepts concrete codes (`200`),
   * ranges (`'2XX'`) and `'default'`.
   * @default every 2xx response
   */
  statusCodes?: Array<number | string>;
}
