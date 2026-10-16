// Validación de los datos de transferencia de la seña. Pura (sin Firestore
// ni React): la usan el formulario para avisar antes de enviar y la server
// action para no confiar en lo que mande el navegador.

export const ALIAS_PATTERN = /^[a-z0-9.-]{6,20}$/;
export const CBU_PATTERN = /^\d{22}$/;
export const HOLDER_MAX_LENGTH = 80;
export const BANK_MAX_LENGTH = 60;

export type TransferInput = {
  enabled: boolean;
  alias: string;
  cbu: string;
  holderName: string;
  bankName: string;
};

export type TransferValue = {
  enabled: boolean;
  alias: string;
  cbu: string | null;
  holderName: string;
  bankName: string | null;
};

export type TransferFieldErrors = Partial<Record<"alias" | "cbu" | "holderName" | "bankName", string>>;

export function normalizeAlias(value: string) {
  return value.trim().toLowerCase();
}

/** El CBU/CVU se suele copiar con espacios o guiones: se guardan solo los dígitos. */
export function normalizeCbu(value: string) {
  return value.replace(/[\s-]/g, "");
}

function collapseSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Alias y titular solo son obligatorios con la transferencia activada:
 * apagada, se puede dejar a medio cargar. Lo que SÍ esté cargado tiene que
 * tener formato válido siempre, para no guardar basura que después aparezca
 * cuando la vuelva a prender.
 */
export function validateTransfer(input: TransferInput): { value: TransferValue; errors: TransferFieldErrors } {
  const alias = normalizeAlias(input.alias);
  const cbu = normalizeCbu(input.cbu);
  const holderName = collapseSpaces(input.holderName);
  const bankName = collapseSpaces(input.bankName);
  const errors: TransferFieldErrors = {};

  if (alias) {
    if (!ALIAS_PATTERN.test(alias)) errors.alias = "El alias tiene que tener entre 6 y 20 caracteres: letras, números, puntos o guiones.";
  } else if (input.enabled) {
    errors.alias = "Cargá el alias para que te puedan transferir.";
  }

  if (cbu && !CBU_PATTERN.test(cbu)) errors.cbu = "El CBU/CVU tiene exactamente 22 números.";

  if (holderName) {
    if (holderName.length < 2) errors.holderName = "Revisá el nombre del titular.";
    else if (holderName.length > HOLDER_MAX_LENGTH) errors.holderName = `El titular puede tener hasta ${HOLDER_MAX_LENGTH} caracteres.`;
  } else if (input.enabled) {
    errors.holderName = "Cargá el titular de la cuenta: la clienta lo ve antes de transferir.";
  }

  if (bankName.length > BANK_MAX_LENGTH) errors.bankName = `El banco puede tener hasta ${BANK_MAX_LENGTH} caracteres.`;

  return {
    value: { enabled: input.enabled, alias, cbu: cbu || null, holderName, bankName: bankName || null },
    errors,
  };
}
