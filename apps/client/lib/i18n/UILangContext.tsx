'use client';

import { createContext, useContext } from 'react';
import type { UILang } from './ui-strings';

const UILangContext = createContext<UILang>('en');

export const UILangProvider = UILangContext.Provider;

export function useUILang(): UILang {
  return useContext(UILangContext);
}
