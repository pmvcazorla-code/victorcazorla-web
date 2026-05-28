export type NavItem = {
  href: string;
  label: string;
};

export type LanguageOption = {
  code: "es" | "en" | "fr" | "ca";
  label: string;
};

export type RouteDef = {
  key: "home" | "it" | "environmentalScience" | "ethics" | "education";
  slugs: {
    es: string;
    en: string;
    fr: string;
    ca: string;
  };
  labels: {
    es: string;
    en: string;
    fr: string;
    ca: string;
  };
};

export const routes: RouteDef[] = [
  {
    key: "home",
    slugs: { es: "/", en: "/en", fr: "/fr", ca: "/ca" },
    labels: { es: "Inicio", en: "Home", fr: "Accueil", ca: "Inici" },
  },
  {
    key: "it",
    slugs: { es: "/it", en: "/en/it", fr: "/fr/it", ca: "/ca/it" },
    labels: {
      es: "Dirección y Gobernanza de IT",
      en: "IT Management & Governance",
      fr: "Gestion IT et Gouvernance",
      ca: "Direcció i Governança de TI",
    },
  },
  {
    key: "environmentalScience",
    slugs: {
      es: "/cienciasambientales",
      en: "/en/environmental-science",
      fr: "/fr/sciences-environnement",
      ca: "/ca/cienciesambientals",
    },
    labels: {
      es: "Gestión Ambiental",
      en: "Environmental Science",
      fr: "Sciences de l'environnement",
      ca: "Ciències Ambientals",
    },
  },
  {
    key: "ethics",
    slugs: {
      es: "/deontologia",
      en: "/en/ethics",
      fr: "/fr/ethique",
      ca: "/ca/deontologia",
    },
    labels: {
      es: "Deontología",
      en: "Ethics",
      fr: "Éthique",
      ca: "Deontologia",
    },
  },
  {
    key: "education",
    slugs: { es: "/formacion", en: "/en/education", fr: "/fr/formation", ca: "/ca/formacio" },
    labels: {
      es: "Formación",
      en: "Education",
      fr: "Formation",
      ca: "Formació",
    },
  },
];

export const navItems = {
  es: routes.map((route) => ({ href: route.slugs.es, label: route.labels.es })),
  en: routes.map((route) => ({ href: route.slugs.en, label: route.labels.en })),
  fr: routes.map((route) => ({ href: route.slugs.fr, label: route.labels.fr })),
  ca: routes.map((route) => ({ href: route.slugs.ca, label: route.labels.ca })),
};

export const languages: LanguageOption[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ca", label: "Català" },
];
