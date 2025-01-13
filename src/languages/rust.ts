import { Monaco } from '@monaco-editor/react';

interface LanguageDefinition {
  id: string;
  extensions: string[];
  aliases: string[];
}

interface IMonarchLanguageAction {
  token: string;
  next?: string;
  bracket?: string;
  cases?: Record<string, string>;
}

interface TokenWithCases {
  token: string;
  cases: Record<string, string>;
}

type SimpleRule = [RegExp | string, string | string[] | TokenWithCases | IMonarchLanguageAction];
type ComplexRule = {
  regex?: RegExp | string;
  action?: string | string[] | TokenWithCases | IMonarchLanguageAction;
  include?: string;
};

type MonarchLanguageRule = SimpleRule | ComplexRule;

interface MonarchLanguageConfig {
  defaultToken: string;
  tokenPostfix: string;
  keywords: string[];
  typeKeywords: string[];
  operators: string[];
  symbols: RegExp;
  escapes: RegExp;
  tokenizer: {
    [key: string]: MonarchLanguageRule[];
  };
}

export const registerRust = (monaco: Monaco): void => {
  const definition: LanguageDefinition = {
    id: 'rust',
    extensions: ['.rs'],
    aliases: ['Rust', 'rust']
  };

  // Define custom token colors
  monaco.editor.defineTheme('rust-custom', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'namespace', foreground: '4EC9B0' },  // Green color for namespace parts
      { token: 'namespace.separator', foreground: 'D4D4D4' },  // White color for ::
      { token: 'function', foreground: 'DCDCAA' },   // Yellow color for functions
    ],
    colors: {}
  });

  const configuration: MonarchLanguageConfig = {
    defaultToken: '',
    tokenPostfix: '.rs',

    keywords: [
      'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
      'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
      'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct',
      'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
      'async', 'await', 'dyn'
    ],

    typeKeywords: [
      'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
      'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
      'f32', 'f64', 'bool', 'char', 'str', 'String'
    ],

    operators: [
      '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
      '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
      '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
      '%=', '<<=', '>>=', '>>>='
    ],

    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        // Namespace detection with separate coloring for :: and uppercase support
        [/([a-zA-Z_][a-zA-Z0-9_]*)(::)/, ['namespace', 'namespace.separator']],
        
        // Function detection with proper capture groups
        [/(fn\s+)([a-zA-Z_]\w*)/, ['keyword', 'function']],
        
        // Function calls
        [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
        
        // Regular identifiers and keywords
        [/[a-z_$][\w$]*/, {
          token: 'identifier',
          cases: {
            '@typeKeywords': 'type',
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        } as TokenWithCases],

        // Whitespace
        { include: '@whitespace' },

        // Delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, {
          token: 'operator',
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        } as TokenWithCases],

        // Numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],

        // Delimiter
        [/[;,.]/, 'delimiter'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' } as IMonarchLanguageAction],

        // Characters
        [/'[^\\']'/, 'string'],
        [/'\\.'/, 'string'],
        [/'/, 'string.invalid']
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\*/, { token: 'comment', next: '@comment' } as IMonarchLanguageAction],
        [/\/\/.*$/, 'comment'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, { token: 'comment', next: '@push' } as IMonarchLanguageAction],
        [/\*\//, { token: 'comment', next: '@pop' } as IMonarchLanguageAction],
        [/[\/*]/, 'comment']
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' } as IMonarchLanguageAction]
      ]
    }
  };

  try {
    monaco.languages.register(definition);
    monaco.languages.setMonarchTokensProvider(definition.id, configuration);
    monaco.editor.setTheme('rust-custom');
    console.log('Successfully registered Rust language with custom highlighting');
  } catch (error) {
    console.error('Error registering Rust language:', error);
    throw error;
  }
};