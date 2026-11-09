import { DenormalizedDoc } from '../interfaces/denormalized-doc.interface.js';
import { OperationContext } from '../interfaces/swagger-document-options.interface.js';

/**
 * Links each explored route to its controller and handler without adding
 * fields to the route itself, so the document stays clean.
 */
const contexts = new WeakMap<
  DenormalizedDoc,
  Pick<OperationContext, 'controller' | 'handler' | 'methodName'>
>();

export function setOperationContext(
  route: DenormalizedDoc,
  context: Pick<OperationContext, 'controller' | 'handler' | 'methodName'>
): void {
  contexts.set(route, context);
}

export function getOperationContext(
  route: DenormalizedDoc
): Pick<OperationContext, 'controller' | 'handler' | 'methodName'> | undefined {
  return contexts.get(route);
}
