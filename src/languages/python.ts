export const registerPython = (monaco: any) => {
  monaco.languages.register({ id: 'python', extensions: ['.py'], aliases: ['Python', 'python'] });

  monaco.languages.setMonarchTokensProvider('python', {
    defaultToken: '',
    tokenPostfix: '.py',
    keywords: [
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
      'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global',
      'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass',
      'raise', 'return', 'True', 'try', 'while', 'with', 'yield',
    ],
    operators: ['+', '-', '*', '**', '/', '//', '%', '@', '<<', '>>', '&', '|', '^', '~', ':', '=', '==', '!=', '<', '>', '<=', '>='],

    tokenizer: {
      root: [
        [/[{}]/, 'delimiter.bracket'],
        { include: 'common' },
      ],
      common: [
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        }],
        [/\d+/, 'number'],
        [/"""/, { token: 'string.quote', bracket: '@open', next: '@multiLineString' }],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      ],
      string: [
        [/[^"]+/, 'string'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
      multiLineString: [
        [/[^"""]+/, 'string'],
        [/"""/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });
}