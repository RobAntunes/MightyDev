// index.ts
import { Monaco } from '@monaco-editor/react';
import { registerJSX } from './jsx';
import { registerTSX } from './tsx';
import { registerPython } from './python';
import { registerSQL } from './sql';
import { registerRust } from './rust';
import { registerTOML } from './toml';

const registeredLanguages = new Set<string>();

export const registerAllLanguages = (monaco: Monaco) => {
  // Only register languages once
  if (registeredLanguages.size === 0) {
    try {
      registerTOML(monaco);
      registerRust(monaco);
      registerJSX(monaco);
      registerTSX(monaco);
      registerPython(monaco);
      registerSQL(monaco);

      // Add languages to the set after successful registration
      registeredLanguages.add('toml');
      registeredLanguages.add('rust');
      registeredLanguages.add('jsx');
      registeredLanguages.add('tsx');
      registeredLanguages.add('python');
      registeredLanguages.add('sql');

      console.log('Successfully registered languages:', Array.from(registeredLanguages));
    } catch (error) {
      console.error('Error registering languages:', error);
    }
  }
};

// Example updated language registration (rust.ts)
interface LanguageDefinition {
  id: string;
  extensions: string[];
  aliases: string[];
}

interface IMonarchLanguageRule {
  regex?: string | RegExp;
  action?: {
    token: string;
    next?: string;
    bracket?: string;
    cases?: Record<string, string>;
  } | string;
  include?: string;
}

interface IMonarchLanguageAction {
  token: string;
  next?: string;
  bracket?: string;
  cases?: Record<string, string>;
}

type MonarchLanguageRule = [string | RegExp, string | IMonarchLanguageAction] | IMonarchLanguageRule;

export interface MonarchLanguageConfig {
  defaultToken: string;
  tokenPostfix: string;
  keywords: string[];
  typeKeywords?: string[];
  operators?: string[];
  symbols?: RegExp;
  escapes?: RegExp;
  tokenizer: {
    [key: string]: MonarchLanguageRule[];
  };
}

export const registerLanguage = (
  monaco: Monaco,
  definition: LanguageDefinition,
  configuration: MonarchLanguageConfig
) => {
  try {
    // Register the language if not already registered
    if (!monaco.languages.getLanguages().some(lang => lang.id === definition.id)) {
      monaco.languages.register(definition);
      monaco.languages.setMonarchTokensProvider(definition.id, configuration);
      console.log(`Successfully registered language: ${definition.id}`);
    }
  } catch (error) {
    console.error(`Error registering language ${definition.id}:`, error);
    throw error;
  }
};