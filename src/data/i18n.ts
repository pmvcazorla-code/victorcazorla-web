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

export type ContactReasonValue =
  | "it_opportunities"
  | "science_research"
  | "philosophy_research"
  | "professional_ethics"
  | "academic"
  | "other";

export type ContactReasonOption = {
  value: ContactReasonValue;
  labels: Record<"es" | "en" | "fr" | "ca", string>;
};

// Mismos valores (no las etiquetas) que CONTACT_REASON_VALUES en
// functions/_lib/contact.ts: ese archivo valida el envío en el servidor
// sin importar nada de src/, así que la lista se mantiene duplicada a
// propósito. Si se añade/renombra una razón, hay que tocar los dos sitios.
export const contactReasons: ContactReasonOption[] = [
  {
    value: "it_opportunities",
    labels: { es: "Oportunidades IT", en: "IT Opportunities", fr: "Opportunités IT", ca: "Oportunitats TI" },
  },
  {
    value: "science_research",
    labels: {
      es: "Investigación Ciencia",
      en: "Science Research",
      fr: "Recherche scientifique",
      ca: "Recerca Científica",
    },
  },
  {
    value: "philosophy_research",
    labels: {
      es: "Investigación Filosofía",
      en: "Philosophy Research",
      fr: "Recherche en philosophie",
      ca: "Recerca en Filosofia",
    },
  },
  {
    value: "professional_ethics",
    labels: {
      es: "Ética profesional",
      en: "Professional Ethics",
      fr: "Éthique professionnelle",
      ca: "Ètica professional",
    },
  },
  {
    value: "academic",
    labels: { es: "Académico", en: "Academic", fr: "Académique", ca: "Acadèmic" },
  },
  {
    value: "other",
    labels: { es: "Otros", en: "Other", fr: "Autres", ca: "Altres" },
  },
];

export type ContactCopy = {
  heading: string;
  intro: string;
  nameLabel: string;
  emailLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
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
  errorReasonRequired: string;
  errorMessageTooShort: string;
  errorConsentRequired: string;
  errorCaptchaRequired: string;
  errorDisposableEmail: string;
  errorSpam: string;
  directEmailIntro: string;
};

export const contactCopy: Record<"es" | "en" | "fr" | "ca", ContactCopy> = {
  es: {
    heading: "Contacto",
    intro: "Si tienes una consulta profesional y/o académica, completa el formulario y te atenderé en la mayor brevedad posible.",
    nameLabel: "Nombre",
    emailLabel: "Correo electrónico",
    reasonLabel: "Razón",
    reasonPlaceholder: "Selecciona una opción",
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
    errorReasonRequired: "Selecciona una razón de contacto.",
    errorMessageTooShort: "Escribe un mensaje de al menos 10 caracteres.",
    errorConsentRequired: "Debes aceptar la política de privacidad para continuar.",
    errorCaptchaRequired: "Completa la verificación de seguridad.",
    errorDisposableEmail: "No se aceptan direcciones de correo temporales. Usa una dirección habitual.",
    errorSpam: "El mensaje no se ha podido enviar porque parece spam. Revísalo e inténtalo de nuevo.",
    directEmailIntro: "También puedes escribir directamente a",
  },
  en: {
    heading: "Contact",
    intro: "If you have a professional and/or academic inquiry, fill in the form and I'll get back to you as soon as possible.",
    nameLabel: "Name",
    emailLabel: "Email",
    reasonLabel: "Reason",
    reasonPlaceholder: "Select an option",
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
    errorReasonRequired: "Select a reason for contacting.",
    errorMessageTooShort: "Write a message of at least 10 characters.",
    errorConsentRequired: "You must accept the privacy policy to continue.",
    errorCaptchaRequired: "Complete the security verification.",
    errorDisposableEmail: "Temporary email addresses aren't accepted. Please use a regular address.",
    errorSpam: "The message couldn't be sent because it looks like spam. Please review it and try again.",
    directEmailIntro: "You can also write directly to",
  },
  fr: {
    heading: "Contact",
    intro: "Si vous avez une question professionnelle et/ou académique, remplissez le formulaire et je vous répondrai dans les meilleurs délais.",
    nameLabel: "Nom",
    emailLabel: "Adresse e-mail",
    reasonLabel: "Motif",
    reasonPlaceholder: "Sélectionnez une option",
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
    errorReasonRequired: "Sélectionnez un motif de contact.",
    errorMessageTooShort: "Écrivez un message d'au moins 10 caractères.",
    errorConsentRequired: "Vous devez accepter la politique de confidentialité pour continuer.",
    errorCaptchaRequired: "Complétez la vérification de sécurité.",
    errorDisposableEmail: "Les adresses e-mail temporaires ne sont pas acceptées. Utilisez une adresse habituelle.",
    errorSpam: "Le message n'a pas pu être envoyé car il ressemble à du spam. Vérifiez-le et réessayez.",
    directEmailIntro: "Vous pouvez aussi écrire directement à",
  },
  ca: {
    heading: "Contacte",
    intro: "Si tens una consulta professional i/o acadèmica, omple el formulari i et respondré al més aviat possible.",
    nameLabel: "Nom",
    emailLabel: "Correu electrònic",
    reasonLabel: "Motiu",
    reasonPlaceholder: "Selecciona una opció",
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
    errorReasonRequired: "Selecciona un motiu de contacte.",
    errorMessageTooShort: "Escriu un missatge d'almenys 10 caràcters.",
    errorConsentRequired: "Has d'acceptar la política de privacitat per continuar.",
    errorCaptchaRequired: "Completa la verificació de seguretat.",
    errorDisposableEmail: "No s'accepten adreces de correu temporals. Fes servir una adreça habitual.",
    errorSpam: "El missatge no s'ha pogut enviar perquè sembla spam. Revisa'l i torna-ho a provar.",
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
