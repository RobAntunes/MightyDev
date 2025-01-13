export const registerJSX = (monaco: any) => {
    monaco.languages.register({ id: 'jsx', extensions: ['.jsx'], aliases: ['JSX', 'jsx'] });

    monaco.languages.setMonarchTokensProvider('jsx', {
        defaultToken: '',
        tokenPostfix: '.jsx',
        keywords: [
            'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
            'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
            'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this',
            'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let',
        ],
        operators: ['<', '>', '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&', '|', '^', '!', '~', '&&', '||', '?', ':', '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=', '^='],
        symbols: /[=><!~?:&|+\-*\/\^%]+/,

        tokenizer: {
            root: [
                [/<\/?/, { token: 'tag', next: '@jsxTag' }],
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
            jsxTag: [
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
    })
}