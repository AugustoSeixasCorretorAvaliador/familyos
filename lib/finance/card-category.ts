type CategoryOption = { id: string; name: string };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
}

export function findCardCategoryId(cardName: string, categories: CategoryOption[]) {
  const normalizedCard = normalize(cardName);
  return categories.find((category) => {
    const normalizedName = normalize(category.name);
    if (!normalizedName.startsWith("cartaodecredito")) return false;
    const issuer = normalizedName.slice("cartaodecredito".length);
    return Boolean(issuer) && (normalizedCard.includes(issuer) || issuer.includes(normalizedCard));
  })?.id ?? null;
}
