export type NavItem = {
  href: string;
  label: string;
};

export type LanguageOption = {
  code: "es" | "en" | "fr" | "ca";
  label: string;
};

export type RouteDef = {
  key: "home" | "it" | "environmentalScience" | "ethics" | "education" | "contact";
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
    slugs: { es: "/", en: "/en/", fr: "/fr/", ca: "/ca/" },
    labels: { es: "Inicio", en: "Home", fr: "Accueil", ca: "Inici" },
  },
  {
    key: "it",
    slugs: { es: "/it/", en: "/en/it/", fr: "/fr/it/", ca: "/ca/it/" },
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
      es: "/cienciasambientales/",
      en: "/en/environmental-science/",
      fr: "/fr/sciences-environnement/",
      ca: "/ca/cienciesambientals/",
    },
    labels: {
      es: "Ciencias Ambientales",
      en: "Environmental Science",
      fr: "Sciences de l'environnement",
      ca: "Ciències Ambientals",
    },
  },
  {
    key: "ethics",
    slugs: {
      es: "/deontologia/",
      en: "/en/ethics/",
      fr: "/fr/ethique/",
      ca: "/ca/deontologia/",
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
    slugs: { es: "/formacion/", en: "/en/education/", fr: "/fr/formation/", ca: "/ca/formacio/" },
    labels: {
      es: "Formación",
      en: "Education",
      fr: "Formation",
      ca: "Formació",
    },
  },
  {
    key: "contact",
    slugs: { es: "/contacto/", en: "/en/contact/", fr: "/fr/contact/", ca: "/ca/contacte/" },
    labels: {
      es: "Contacto",
      en: "Contact",
      fr: "Contact",
      ca: "Contacte",
    },
  },
];

export type ContactCopy = {
  heading: string;
  intro: string;
  nameLabel: string;
  emailLabel: string;
  messageLabel: string;
  consentLabel: string;
  privacyLinkLabel: string;
  submitLabel: string;
  sendingLabel: string;
  successMessage: string;
  errorGeneric: string;
  errorRateLimited: string;
  errorValidation: string;
  errorNameRequired: string;
  errorEmailInvalid: string;
  errorMessageTooShort: string;
  errorConsentRequired: string;
  directEmailIntro: string;
};

export const contactCopy: Record<"es" | "en" | "fr" | "ca", ContactCopy> = {
  es: {
    heading: "Contacto",
    intro: "¿Tienes una consulta profesional? Completa el formulario y te responderé en cuanto pueda.",
    nameLabel: "Nombre",
    emailLabel: "Correo electrónico",
    messageLabel: "Mensaje",
    consentLabel: "He leído y acepto la",
    privacyLinkLabel: "política de privacidad",
    submitLabel: "Enviar mensaje",
    sendingLabel: "Enviando…",
    successMessage: "Gracias, tu mensaje se ha enviado correctamente. Te responderé en cuanto pueda.",
    errorGeneric: "No se ha podido enviar el mensaje. Inténtalo de nuevo en unos minutos.",
    errorRateLimited: "Has enviado demasiados mensajes seguidos. Espera unos minutos antes de volver a intentarlo.",
    errorValidation: "Revisa los campos marcados antes de enviar el formulario.",
    errorNameRequired: "Escribe tu nombre.",
    errorEmailInvalid: "Escribe un correo electrónico válido.",
    errorMessageTooShort: "Escribe un mensaje de al menos 10 caracteres.",
    errorConsentRequired: "Debes aceptar la política de privacidad para continuar.",
    directEmailIntro: "También puedes escribir directamente a",
  },
  en: {
    heading: "Contact",
    intro: "Have a professional inquiry? Fill in the form and I'll get back to you as soon as possible.",
    nameLabel: "Name",
    emailLabel: "Email",
    messageLabel: "Message",
    consentLabel: "I have read and accept the",
    privacyLinkLabel: "privacy policy",
    submitLabel: "Send message",
    sendingLabel: "Sending…",
    successMessage: "Thank you, your message has been sent successfully. I'll get back to you as soon as possible.",
    errorGeneric: "The message could not be sent. Please try again in a few minutes.",
    errorRateLimited: "You've sent too many messages in a row. Please wait a few minutes before trying again.",
    errorValidation: "Please check the fields marked below before submitting the form.",
    errorNameRequired: "Enter your name.",
    errorEmailInvalid: "Enter a valid email address.",
    errorMessageTooShort: "Write a message of at least 10 characters.",
    errorConsentRequired: "You must accept the privacy policy to continue.",
    directEmailIntro: "You can also write directly to",
  },
  fr: {
    heading: "Contact",
    intro: "Vous avez une question professionnelle ? Remplissez le formulaire, je vous répondrai dès que possible.",
    nameLabel: "Nom",
    emailLabel: "Adresse e-mail",
    messageLabel: "Message",
    consentLabel: "J'ai lu et j'accepte la",
    privacyLinkLabel: "politique de confidentialité",
    submitLabel: "Envoyer le message",
    sendingLabel: "Envoi en cours…",
    successMessage: "Merci, votre message a bien été envoyé. Je vous répondrai dès que possible.",
    errorGeneric: "Le message n'a pas pu être envoyé. Veuillez réessayer dans quelques minutes.",
    errorRateLimited: "Vous avez envoyé trop de messages d'affilée. Veuillez patienter quelques minutes avant de réessayer.",
    errorValidation: "Vérifiez les champs indiqués avant d'envoyer le formulaire.",
    errorNameRequired: "Indiquez votre nom.",
    errorEmailInvalid: "Indiquez une adresse e-mail valide.",
    errorMessageTooShort: "Écrivez un message d'au moins 10 caractères.",
    errorConsentRequired: "Vous devez accepter la politique de confidentialité pour continuer.",
    directEmailIntro: "Vous pouvez aussi écrire directement à",
  },
  ca: {
    heading: "Contacte",
    intro: "Tens una consulta professional? Omple el formulari i et respondré tan aviat com pugui.",
    nameLabel: "Nom",
    emailLabel: "Correu electrònic",
    messageLabel: "Missatge",
    consentLabel: "He llegit i accepto la",
    privacyLinkLabel: "política de privacitat",
    submitLabel: "Enviar missatge",
    sendingLabel: "Enviant…",
    successMessage: "Gràcies, el teu missatge s'ha enviat correctament. Et respondré tan aviat com pugui.",
    errorGeneric: "No s'ha pogut enviar el missatge. Torna-ho a provar d'aquí a uns minuts.",
    errorRateLimited: "Has enviat massa missatges seguits. Espera uns minuts abans de tornar-ho a provar.",
    errorValidation: "Revisa els camps marcats abans d'enviar el formulari.",
    errorNameRequired: "Escriu el teu nom.",
    errorEmailInvalid: "Escriu un correu electrònic vàlid.",
    errorMessageTooShort: "Escriu un missatge d'almenys 10 caràcters.",
    errorConsentRequired: "Has d'acceptar la política de privacitat per continuar.",
    directEmailIntro: "També pots escriure directament a",
  },
};

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
