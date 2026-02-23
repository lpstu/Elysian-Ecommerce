export function formatFcfa(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}
