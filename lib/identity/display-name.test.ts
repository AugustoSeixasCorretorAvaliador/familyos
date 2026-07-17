import { describe, expect, it } from "vitest";
import { normalizeDisplayName, resolveDisplayName } from "./display-name";

describe("resolveDisplayName", () => {
  it("prioriza o nome completo da pessoa vinculada", () => {
    expect(
      resolveDisplayName({
        person: { firstName: "Augusto", lastName: "Seixas" },
        profileDisplayName: "jass 2020",
        userMetadata: { full_name: "jass 2020" },
        email: "augusto@example.com",
      })
    ).toBe("Augusto Seixas");
  });

  it("usa o perfil interno quando não existe pessoa vinculada", () => {
    expect(
      resolveDisplayName({
        profileDisplayName: "Maria José da Cunha Alves Seixas",
        userMetadata: { full_name: "Conta Google" },
      })
    ).toBe("Maria José da Cunha Alves Seixas");
  });

  it("usa metadata quando pessoa e perfil não existem", () => {
    expect(
      resolveDisplayName({
        userMetadata: { full_name: "Rodrigo Alves Seixas" },
        email: "rodrigo@example.com",
      })
    ).toBe("Rodrigo Alves Seixas");
  });

  it("normaliza espaços extras no nome", () => {
    expect(
      resolveDisplayName({
        person: { firstName: "  Marcella  ", lastName: "  Seixas  " },
      })
    ).toBe("Marcella Seixas");
  });

  it("preserva caracteres acentuados", () => {
    expect(normalizeDisplayName("  Maria   José  ")).toBe("Maria José");
  });
});
