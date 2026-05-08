import { defaultLang, locales, ui, type Lang } from './ui';

export function isLang(lang: string | undefined): lang is Lang {
  return Boolean(lang && locales.includes(lang as Lang));
}

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/').filter(Boolean);
  return isLang(lang) ? lang : defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

export function getLocalizedPath(lang: Lang, path = '') {
  const cleanPath = path.replace(/^\//, '');
  return `/${lang}/${cleanPath}`.replace(/\/$/, '') || `/${lang}`;
}

export function getAlternateLinks(path = '') {
  return locales.map((lang) => ({
    lang,
    path: getLocalizedPath(lang, path),
  }));
}
