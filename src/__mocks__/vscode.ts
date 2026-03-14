/**
 * Minimal vscode mock for unit tests.
 * Only stubs the APIs used by convert.ts command handlers.
 */

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: "file" }),
  joinPath: (base: { fsPath: string }, ...segments: string[]) => {
    const joined = [base.fsPath, ...segments].join("/");
    return { fsPath: joined, scheme: "file" };
  },
};

export const workspace = {
  fs: {
    stat: async () => {
      throw new Error("File not found");
    },
    readFile: async () => new Uint8Array(),
    writeFile: async () => {},
    delete: async () => {},
  },
  workspaceFolders: undefined as unknown[] | undefined,
};

export const window = {
  showOpenDialog: async () => undefined,
  showWarningMessage: async () => undefined,
  showErrorMessage: () => {},
  activeTextEditor: undefined,
};

export const commands = {
  executeCommand: async () => {},
  registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => ({
    dispose: () => {},
  }),
};

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export enum ViewColumn {
  Beside = -2,
}
