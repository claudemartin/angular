/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {BLOCK_MARKER} from './constants';
import {MessageId, ParsedMessage, TargetMessage, parseMessage} from './messages';


/**
 * A translation message that has been processed to extract the message parts and placeholders.
 */
export interface ParsedTranslation {
  messageParts: TemplateStringsArray;
  placeholderNames: string[];
}

/**
 * The internal structure used by the runtime localization to translate messages.
 */
export type ParsedTranslations = Record<MessageId, ParsedTranslation>;

export class MissingTranslationError extends Error {
  private readonly type = 'MissingTranslationError';
  constructor(readonly parsedMessage: ParsedMessage) {
    super(`No translation found for ${describeMessage(parsedMessage)}.`);
  }
}

export function isMissingTranslationError(e: any): e is MissingTranslationError {
  return e.type === 'MissingTranslationError';
}

/**
 * Translate the text of the `$localize` tagged-string (i.e. `messageParts` and
 * `substitutions`) using the given `translations`.
 *
 * The tagged-string is parsed to extract its `messageId` which is used to find an appropriate
 * `ParsedTranslation`. If this doesn't match and there are legacy ids then try matching a
 * translation using those.
 *
 * If one is found then it is used to translate the message into a new set of `messageParts` and
 * `substitutions`.
 * The translation may reorder (or remove) substitutions as appropriate.
 *
 * If there is no translation with a matching message id then an error is thrown.
 * If a translation contains a placeholder that is not found in the message being translated then an
 * error is thrown.
 */
export function translate(
    translations: Record<string, ParsedTranslation>, messageParts: TemplateStringsArray,
    substitutions: readonly any[]): [TemplateStringsArray, readonly any[]] {
  const message = parseMessage(messageParts, substitutions);
  // Look up the translation using the messageId, and then the legacyId if available.
  let translation = translations[message.messageId];
  // If the messageId did not match a translation, try matching the legacy ids instead
  for (let i = 0; i < message.legacyIds.length && translation === undefined; i++) {
    translation = translations[message.legacyIds[i]];
  }
  if (translation === undefined) {
    throw new MissingTranslationError(message);
  }
  return [
    translation.messageParts, translation.placeholderNames.map(placeholder => {
      if (message.substitutions.hasOwnProperty(placeholder)) {
        return message.substitutions[placeholder];
      } else {
        throw new Error(
            `No placeholder found with name ${placeholder} in message ${describeMessage(message)}.`);
      }
    })
  ];
}

/**
 * Parse the `messageParts` and `placeholderNames` out of a target `message`.
 *
 * Used by `loadTranslations()` to convert target message strings into a structure that is more
 * appropriate for doing translation.
 *
 * @param message the message to be parsed.
 */
export function parseTranslation(message: TargetMessage): ParsedTranslation {
  const parts = message.split(/{\$([^}]*)}/);
  const messageParts = [parts[0]];
  const placeholderNames: string[] = [];
  for (let i = 1; i < parts.length - 1; i += 2) {
    placeholderNames.push(parts[i]);
    messageParts.push(`${parts[i + 1]}`);
  }
  const rawMessageParts =
      messageParts.map(part => part.charAt(0) === BLOCK_MARKER ? '\\' + part : part);
  return {messageParts: makeTemplateObject(messageParts, rawMessageParts), placeholderNames};
}

/**
 * Create a `ParsedTranslation` from a set of `messageParts` and `placeholderNames`.
 *
 * @param messageParts The message parts to appear in the ParsedTranslation.
 * @param placeholderNames The names of the placeholders to intersperse between the `messageParts`.
 */
export function makeParsedTranslation(
    messageParts: string[], placeholderNames: string[] = []): ParsedTranslation {
  return {messageParts: makeTemplateObject(messageParts, messageParts), placeholderNames};
}

/**
 * Create the specialized array that is passed to tagged-string tag functions.
 *
 * @param cooked The message parts with their escape codes processed.
 * @param raw The message parts with their escaped codes as-is.
 */
export function makeTemplateObject(cooked: string[], raw: string[]): TemplateStringsArray {
  Object.defineProperty(cooked, 'raw', {value: raw});
  return cooked as any;
}


function describeMessage(message: ParsedMessage): string {
  const meaningString = message.meaning && ` - "${message.meaning}"`;
  return `"${message.messageId}" ("${message.messageString}"${meaningString})`;
}