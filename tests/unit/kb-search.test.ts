import { describe, expect, it } from "vitest";
import { normalize, tokenize, detectLang, retrieve, type KbDoc } from "../../functions/_lib/kb-search";

describe("normalize", () => {
  it("pasa a minúsculas, quita acentos y puntuación", () => {
    expect(normalize("¿Dónde estudió Formación Académica?")).toBe("donde estudio formacion academica");
  });
});

describe("tokenize", () => {
  it("descarta funcionales y tokens de 1 carácter, conserva siglas de 2", () => {
    expect(tokenize("¿Cuál es su rol en IT y en la UE?")).toEqual(["cual", "rol", "it", "ue"]);
  });
});

describe("detectLang", () => {
  it("distingue es/en/fr/ca por palabras funcionales", () => {
    expect(detectLang("What is his role?")).toBe("en");
    expect(detectLang("Quel est son rôle ?")).toBe("fr");
    expect(detectLang("¿Cuál es su rol?")).toBe("es");
  });
});

describe("retrieve", () => {
  const docs: KbDoc[] = [
    { id: "site/deontologia", title: "Deontología", url: "u1", lang: "es", source: "", text: "Preside el Comité de Ética y Deontología del COAMB. Ética profesional aplicada." },
    { id: "en/ethics", title: "Ethics", url: "u2", lang: "en", source: "", text: "Chairs the Ethics and Deontology Committee of COAMB." },
    { id: "site/formacion", title: "Formación", url: "u3", lang: "es", source: "", text: "Másteres y posgrados en dirección de tecnologías, ciencias ambientales y filosofía." },
    { id: "site/it", title: "Dirección IT", url: "u4", lang: "es", source: "", text: "Dirección de operaciones y gobierno de servicios tecnológicos, cloud y ciberseguridad." },
  ];

  it("prioriza el documento temáticamente relevante", () => {
    const hits = retrieve("¿Quién preside el comité de deontología?", docs, 2);
    expect(hits[0].doc.id).toBe("site/deontologia");
  });

  it("realza el documento en el idioma de la consulta", () => {
    const hits = retrieve("Who chairs the ethics committee?", docs, 4);
    expect(hits[0].doc.id).toBe("en/ethics");
  });

  it("devuelve como mucho k resultados y solo con score > 0", () => {
    const hits = retrieve("ciberseguridad cloud", docs, 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(hits.every((h) => h.score > 0)).toBe(true);
    expect(hits[0].doc.id).toBe("site/it");
  });

  it("no casa nada cuando la consulta es solo ruido", () => {
    expect(retrieve("el la de por y", docs)).toEqual([]);
  });
});
