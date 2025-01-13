export const registerSQL = (monaco: any) => {
  monaco.languages.register({ id: 'sql', extensions: ['.sql'], aliases: ['SQL', 'sql'] });

  monaco.languages.setMonarchTokensProvider('sql', {
    defaultToken: '',
    tokenPostfix: '.sql',
    keywords: [
      'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'INNER', 'LEFT',
      'RIGHT', 'ON', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'AS', 'DISTINCT',
      'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'UNION', 'ALL',
    ],
    operators: ['=', '<', '>', '<=', '>=', '<>', '!=', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS'],

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
        [/'/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      ],
      string: [
        [/[^']+/, 'string'],
        [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });
}