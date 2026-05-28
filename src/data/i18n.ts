export type NavItem = {
  href: string;
  label: string;
};

export type LanguageOption = {
  code: "es" | "en" | "fr";
  label: string;
};

export type RouteDef = {
  key: "home" | "it" | "environmentalScience" | "ethics" | "education";
  slugs: {
    es: string;
    en: string;
    fr: string;
  };
  labels: {
    es: string;
    en: string;
    fr: string;
  };
};

export const routes: RouteDef[] = [
  {
    key: "home",
    slugs: { es: "/", en: "/en", fr: "/fr" },
    labels: { es: "Inicio", en: "Home", fr: "Accueil" },
  },
  {
    key: "it",
    slugs: { es: "/it", en: "/en/it", fr: "/fr/it" },
    labels: {
      es: "Dirección y Gobernanza de IT",
      en: "IT Management & Governance",
      fr: "Gestion IT et Gouvernance",
    },
  },
  {
    key: "environmentalScience",
    slugs: {
      es: "/cienciasambientales",
      en: "/en/environmental-science",
      fr: "/fr/sciences-environnement",
    },
    labels: {
      es: "Gestión Ambiental",
      en: "Environmental Science",
      fr: "Sciences de l'environnement",
    },
  },
  {
    key: "ethics",
    slugs: { es: "/deontologia", en: "/en/ethics", fr: "/fr/ethique" },
    labels: {
      es: "Deontología",
      en: "Ethics",
      fr: "Éthique",
    },
  },
  {
    key: "education",
    slugs: { es: "/formacion", en: "/en/education", fr: "/fr/formation" },
    labels: {
      es: "Formación",
      en: "Education",
      fr: "Formation",
    },
  },
];

export const navItems = {
  es: routes.map((route) => ({ href: route.slugs.es, label: route.labels.es })),
  en: routes.map((route) => ({ href: route.slugs.en, label: route.labels.en })),
  fr: routes.map((route) => ({ href: route.slugs.fr, label: route.labels.fr })),
};

export const languages: LanguageOption[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];
