export const registerTSX = (monaco: any) => {
monaco.languages.register({ id: 'tsx', extensions: ['.tsx'], aliases: ['TSX', 'tsx'] });

monaco.languages.setMonarchTokensProvider('tsx', {
  defaultToken: '',
  tokenPostfix: '.tsx',
  keywords: [
    'abstract', 'any', 'as', 'asserts', 'async', 'await', 'break', 'case', 'catch',
    'class', 'const', 'continue', 'debugger', 'declare', 'default', 'delete', 'do',
    'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function',
    'get', 'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface', 'is',
    'keyof', 'let', 'module', 'namespace', 'new', 'null', 'of', 'override', 'package',
    'private', 'protected', 'public', 'readonly', 'require', 'return', 'set', 'static',
    'super', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined',
    'unique', 'unknown', 'var', 'void', 'while', 'with', 'yield',
  ],
  operators: ['<', '>', '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&', '|', '^', '!', '~', '&&', '||', '?', ':', '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=', '^='],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  tokenizer: {
    root: [
      [/<\/?/, { token: 'tag', next: '@tsxTag' }],
      { include: 'common' },
    ],
    common: [
      [/[a-z_$][\w$]*/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier',
        },
      }],
      [/\d+/, 'number'],
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      [/[{}]/, 'delimiter.bracket'],
    ],
    tsxTag: [
      [/[a-zA-Z_]\w*/, 'tag'],
      [/=/, 'operator'],
      [/"[^"]*"/, 'attribute.value'],
      [/>/, { token: 'tag', next: '@pop' }],
      [/\/>/, { token: 'tag', next: '@pop' }],
    ],
    string: [
      [/[^"]+/, 'string'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],
  },
});
}
