/**
 * LibreMD — Command Registry
 *
 * Central registry of all executable actions.
 * Commands are registered by ID with metadata (label, shortcut, category).
 * The Command Palette searches this registry.
 * Toolbar buttons execute commands from this registry.
 *
 * This is the SINGLE SOURCE OF TRUTH for all actions in the app.
 */

import { emit, Events } from '../events.js';
import { t } from '../i18n/index.js';

// ── Types ──────────────────────────────────────────────────────────

/**
 * @typedef {object} CommandDefinition
 * @property {string} id - Unique command ID (e.g., 'editor.toggleBold')
 * @property {string} label - Human-readable label (e.g., 'Toggle Bold')
 * @property {string} [i18nKey] - Key for translation
 * @property {string} [category] - Category for grouping (e.g., 'Editor', 'File', 'View')
 * @property {string} [shortcut] - Display shortcut (e.g., 'Ctrl+B')
 * @property {string} [icon] - Icon identifier (for toolbar)
 * @property {Function} execute - The action to perform
 * @property {Function} [isEnabled] - Returns boolean, whether command is available
 */

// ── State ──────────────────────────────────────────────────────────

/** @type {Map<string, CommandDefinition>} */
const commands = new Map();

// ── Public API ─────────────────────────────────────────────────────

export function getTranslatedLabel(cmd) {
  if (cmd.i18nKey) return t(cmd.i18nKey);
  return cmd.label;
}

export function getTranslatedCategory(cmd) {
  if (cmd.category) return t(`category.${cmd.category}`, { count: 1 }); // fallback handles the rest
  return '';
}

/**
 * Register a command.
 * @param {CommandDefinition} command
 */
export function registerCommand(command) {
  if (!command.id || !command.execute) {
    console.warn('[Commands] Invalid command definition:', command);
    return;
  }

  commands.set(command.id, command);
}

/**
 * Register multiple commands at once.
 * @param {CommandDefinition[]} commandList
 */
export function registerCommands(commandList) {
  for (const cmd of commandList) {
    registerCommand(cmd);
  }
}

/**
 * Execute a command by ID.
 * @param {string} commandId
 * @param {*} [args] - Optional arguments passed to the execute function
 * @returns {boolean} Whether the command was found and executed
 */
export function executeCommand(commandId, args) {
  const command = commands.get(commandId);
  if (!command) {
    console.warn(`[Commands] Command not found: ${commandId}`);
    return false;
  }

  // Check if command is enabled
  if (command.isEnabled && !command.isEnabled()) {
    return false;
  }

  try {
    command.execute(args);
    emit(Events.COMMAND_EXECUTED, { id: commandId, label: getTranslatedLabel(command) });
    return true;
  } catch (err) {
    console.error(`[Commands] Error executing "${commandId}":`, err);
    return false;
  }
}

/**
 * Get a command by ID.
 * @param {string} commandId
 * @returns {CommandDefinition|undefined}
 */
export function getCommand(commandId) {
  return commands.get(commandId);
}

/**
 * Get all registered commands.
 * @returns {CommandDefinition[]}
 */
export function getAllCommands() {
  return Array.from(commands.values());
}

/**
 * Get commands filtered by category.
 * @param {string} category
 * @returns {CommandDefinition[]}
 */
export function getCommandsByCategory(category) {
  return Array.from(commands.values()).filter(cmd => cmd.category === category);
}

/**
 * Search commands by translated label (for Command Palette fuzzy search).
 * Returns commands sorted by relevance.
 * @param {string} query
 * @returns {CommandDefinition[]}
 */
export function searchCommands(query) {
  if (!query || query.trim().length === 0) {
    return getAllCommands();
  }

  const lowerQuery = query.toLowerCase();
  const results = [];

  for (const cmd of commands.values()) {
    // Check if enabled
    if (cmd.isEnabled && !cmd.isEnabled()) continue;

    const label = getTranslatedLabel(cmd).toLowerCase();
    const category = getTranslatedCategory(cmd).toLowerCase();
    const id = cmd.id.toLowerCase();

    // Exact match in label
    if (label === lowerQuery) {
      results.push({ cmd, score: 100 });
      continue;
    }

    // Starts with
    if (label.startsWith(lowerQuery)) {
      results.push({ cmd, score: 80 });
      continue;
    }

    // Contains
    if (label.includes(lowerQuery)) {
      results.push({ cmd, score: 60 });
      continue;
    }

    // Category match
    if (category.includes(lowerQuery)) {
      results.push({ cmd, score: 40 });
      continue;
    }

    // ID match
    if (id.includes(lowerQuery)) {
      results.push({ cmd, score: 20 });
      continue;
    }

    // Fuzzy: all query chars appear in order
    let qi = 0;
    for (let li = 0; li < label.length && qi < lowerQuery.length; li++) {
      if (label[li] === lowerQuery[qi]) qi++;
    }
    if (qi === lowerQuery.length) {
      results.push({ cmd, score: 10 });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.map(r => r.cmd);
}

/**
 * Unregister a command.
 * @param {string} commandId
 */
export function unregisterCommand(commandId) {
  commands.delete(commandId);
}
