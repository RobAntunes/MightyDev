import { languages } from 'monaco-editor';

export const registerTOML = (monaco: any) => {
monaco.languages.register({ id: 'toml', extensions: ['.toml'] });

monaco.languages.setMonarchTokensProvider('toml', {
  defaultToken: '',
  tokenPostfix: '.toml',

  brackets: [
    { open: '[', close: ']', token: 'delimiter.square' },
  ],

  keywords: ['true', 'false'],

  tokenizer: {
    root: [
      // Comments
      [/#[^\n]*/, 'comment'],

      // Strings
      [/"/, { token: 'string.quote', bracket: '@open', next: '@stringDouble' }],
      [/'/, { token: 'string.quote', bracket: '@open', next: '@stringSingle' }],

      // Numbers
      [/[-+]?\d+(\.\d+)?([eE][-+]?\d+)?/, 'number'],

      // Booleans
      [/\b(true|false)\b/, 'keyword'],

      // Keys and Arrays
      [/^[a-zA-Z0-9_\-]+(?=\s*=\s*)/, 'key'],
      [/\[.*?\]/, 'key'],

      // Whitespace
      [/[ \t\r\n]+/, ''],

      // Equal signs
      [/=/, 'delimiter'],
    ],

    stringDouble: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],

    stringSingle: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],
  },
});}