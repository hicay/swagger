import { Type } from '@nestjs/common';
import { DECORATORS } from '../constants.js';
import { ResponseWrapperOptions } from '../interfaces/swagger-document-options.interface.js';

export type ApiResponseWrapperMetadata =
  { disabled: true } | ({ disabled?: false } & ResponseWrapperOptions);

/**
 * Wraps the response payloads of a controller or a single handler into an
 * envelope schema, or opts out of the document-wide `responseWrapper` when
 * called with `false`. Handler-level metadata wins over controller-level
 * metadata, which wins over the document option.
 *
 * @publicApi
 */
export function ApiResponseWrapper(
  type: Type<unknown> | Function,
  options?: Omit<ResponseWrapperOptions, 'type'>
): MethodDecorator & ClassDecorator;
export function ApiResponseWrapper(
  disable: false
): MethodDecorator & ClassDecorator;
export function ApiResponseWrapper(
  typeOrDisable: Type<unknown> | Function | false,
  options: Omit<ResponseWrapperOptions, 'type'> = {}
): MethodDecorator & ClassDecorator {
  const metadata: ApiResponseWrapperMetadata =
    typeOrDisable === false
      ? { disabled: true }
      : { ...options, type: typeOrDisable };

  return (
    target: object | Function,
    key?: string | symbol,
    descriptor?: TypedPropertyDescriptor<any>
  ): any => {
    if (descriptor) {
      Reflect.defineMetadata(
        DECORATORS.API_RESPONSE_WRAPPER,
        metadata,
        descriptor.value
      );
      return descriptor;
    }
    Reflect.defineMetadata(DECORATORS.API_RESPONSE_WRAPPER, metadata, target);
    return target;
  };
}
