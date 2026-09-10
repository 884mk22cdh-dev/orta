// Приложение пишет импорты без расширения — так их разрешает Metro.
// Node так не умеет, поэтому для тестов дописываем «.js» сами.
// Иначе пришлось бы либо править импорты по всему коду, либо тащить сборщик.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (e) {
    if (/^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) {
      return next(`${specifier}.js`, context);
    }
    throw e;
  }
}

register(pathToFileURL(import.meta.filename));
