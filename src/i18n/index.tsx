import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en, type Dict } from "./en";
import { ru } from "./ru";
import { supabase } from '@/integrations/supabase/client';

export type Lang = "en" | "ru";
const dicts: Record<Lang, Dict> = { en, ru };
const KEY = "app_lang";

type Ctx = { lang: Lang; t: Dict; setLang: (l: Lang) => void };
const I18nContext = createContext<Ctx>({ lang: "en", t: en, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const stored = localStorage.getItem(KEY) as Lang | null;
    const tgLang = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } }).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    const next: Lang = stored === "en" || stored === "ru" ? stored : tgLang === "ru" ? "ru" : "en";
    setLangState(next);
    document.documentElement.lang = next;
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from('profiles').select('language').eq('user_id', data.user.id).single();
      if (active && profile) { setLangState(profile.language); localStorage.setItem(KEY, profile.language); document.documentElement.lang = profile.language; }
    });
    return () => { active = false; };
  }, []);
  const setLang = (l: Lang) => {
    localStorage.setItem(KEY, l);
    document.documentElement.lang = l;
    setLangState(l);
  };
  return <I18nContext.Provider value={{ lang, t: dicts[lang], setLang }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
