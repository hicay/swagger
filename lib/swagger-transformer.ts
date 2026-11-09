import groupBy from 'es-toolkit/compat/groupBy';
import isEqual from 'es-toolkit/compat/isEqual';
import keyBy from 'es-toolkit/compat/keyBy';
import mapValues from 'es-toolkit/compat/mapValues';
import omit from 'es-toolkit/compat/omit';
import pickBy from 'es-toolkit/compat/pickBy';
import uniqWith from 'es-toolkit/compat/uniqWith';
import { DenormalizedDoc } from './interfaces/denormalized-doc.interface.js';
import {
  OpenAPIObject,
  OperationCustomizer,
  OperationObject
} from './interfaces/index.js';
import { getOperationContext } from './utils/operation-context.js';
import { sortObjectLexicographically } from './utils/sort-object-lexicographically.js';

type DenormalizedDocWithRoot = DenormalizedDoc & {
  root: NonNullable<DenormalizedDoc['root']>;
};

export class SwaggerTransformer {
  public normalizePaths(
    denormalizedDoc: DenormalizedDoc[],
    options: { operationCustomizers?: OperationCustomizer[] } = {}
  ): Pick<OpenAPIObject, 'paths' | 'webhooks'> & {
    webhookPaths?: OpenAPIObject['paths'];
  } {
    const customizers = options.operationCustomizers ?? [];
    const roots = denormalizedDoc.filter(
      (doc): doc is DenormalizedDocWithRoot => Boolean(doc.root)
    );
    const webhookRoots = roots.filter(({ root }) => Boolean(root.isWebhook));
    const pathRoots = roots.filter(({ root }) => !root.isWebhook);
    const groupedByPath = groupBy(pathRoots, ({ root }) => root.path);
    const paths = this.dropEmptyPathItems(
      mapValues(groupedByPath, (routes) =>
        this.normalizeOperations(routes, customizers)
      )
    );

    const groupedByWebhookName = groupBy(
      webhookRoots,
      ({ root }) => root.webhookName || root.path
    );
    const webhooks = this.dropEmptyPathItems(
      mapValues(groupedByWebhookName, (routes) =>
        this.normalizeOperations(routes, customizers)
      )
    );
    const groupedByWebhookPath = groupBy(webhookRoots, ({ root }) => root.path);
    const webhookPaths = this.dropEmptyPathItems(
      mapValues(groupedByWebhookPath, (routes) =>
        this.normalizeOperations(routes, customizers)
      )
    );
    return {
      paths,
      ...(Object.keys(webhooks).length > 0 ? { webhooks } : {}),
      ...(Object.keys(webhookPaths).length > 0 ? { webhookPaths } : {})
    };
  }

  /**
   * A customizer may drop every operation of a path; an empty path item has
   * nothing to document.
   */
  private dropEmptyPathItems<T extends Record<string, Record<string, any>>>(
    pathItems: T
  ): T {
    return pickBy(
      pathItems,
      (pathItem) => Object.keys(pathItem).length > 0
    ) as T;
  }

  /**
   * Runs the customizers in order on the assembled operation. Returning
   * `false` leaves the operation out; returning an object replaces it.
   */
  private customizeOperation(
    operation: OperationObject,
    route: DenormalizedDocWithRoot,
    customizers: OperationCustomizer[]
  ): OperationObject | undefined {
    if (customizers.length === 0) {
      return operation;
    }
    const context = {
      path: route.root.path,
      method: route.root.method,
      isWebhook: Boolean(route.root.isWebhook),
      ...getOperationContext(route)
    };
    let current = operation;
    for (const customizer of customizers) {
      const result = customizer(current, context);
      if (result === false) {
        return undefined;
      }
      if (result && typeof result === 'object') {
        current = result;
      }
    }
    return current;
  }

  private normalizeOperations(
    routes: DenormalizedDocWithRoot[],
    customizers: OperationCustomizer[]
  ) {
    const keyByMethod = keyBy(routes, ({ root }) => root.method);
    const operations = mapValues(keyByMethod, (route: any) => {
      const mergedDefinition = {
        ...omit(route, 'root'),
        ...omit(route.root, ['method', 'path', 'isWebhook', 'webhookName'])
      };
      // Route patterns that differ only in what an OpenAPI path template cannot
      // express (e.g. ":id(^\\d+)" and ":id", ":path" and "*path") end up with
      // the same path and method, yet only one handler can be described.
      // Keep the security requirements of every handler it stands for.
      const handlers = routes.filter(
        ({ root }) => root.method === route.root.method
      );
      if (handlers.length > 1) {
        const security = uniqWith(
          handlers.flatMap(
            (handler) => handler.root.security ?? handler.security ?? []
          ),
          isEqual
        );
        if (security.length > 0) {
          mergedDefinition.security = security;
        }
      }
      return this.customizeOperation(
        sortObjectLexicographically(mergedDefinition) as OperationObject,
        route,
        customizers
      );
    });
    return pickBy(operations, (operation) => operation !== undefined);
  }
}
