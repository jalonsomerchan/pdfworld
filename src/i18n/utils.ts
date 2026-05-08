import { defaultLang, locales, ui, type Lang } from './ui';

export type { Lang };

export function isLang(lang: string | undefined): lang is Lang {
  return Boolean(lang && locales.includes(lang as Lang));
}

export function getLangFromUrl(url: URL): Lang {
  const segments = url.pathname.split('/').filter(Boolean);
  const lang = segments.find((segment) => isLang(segment));
  return isLang(lang) ? lang : defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

export function getLocalizedPath(lang: Lang, path = '') {
  const cleanPath = path.replace(/^\//, '').replace(/\/$/, '');
  return cleanPath ? `/${lang}/${cleanPath}` : `/${lang}`;
}

export function getAlternateLinks(path = '') {
  return locales.map((lang) => ({
    lang,
    path: getLocalizedPath(lang, path),
  }));
}
