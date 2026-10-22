// The last path segment, whichever kind of slash the path uses (Windows paths arrive with backslashes).
const base = (p) => (typeof p === 'string' ? (p.split(/[\\/]/).filter(Boolean).pop() ?? '') : '');

/**
 * Turn a Claude Code tool call into a small, privacy-safe description for the Context feature.
 * Only a tool name and a short target are kept: a file's base name, a command's first word, or a
 * host name. Full paths, command lines, search patterns, prompts and file contents are never stored.
 */
export function describeTool(name, input = {}) {
  const tool = String(name || '').slice(0, 40);
  switch (name) {
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'Read':
      return { tool, target: base(input.file_path) };
    case 'NotebookEdit':
      return { tool, target: base(input.notebook_path) };
    case 'Bash':
      return { tool, target: String(input.command || '').trim().split(/\s+/)[0].slice(0, 24) };
    case 'WebFetch':
      try {
        return { tool, target: new URL(input.url).hostname.slice(0, 60) };
      } catch {
        return { tool, target: '' };
      }
    default:
      return { tool, target: '' };
  }
}
