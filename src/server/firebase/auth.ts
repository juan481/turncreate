import "server-only";

type FirebaseAuthResponse = {
  idToken: string;
  localId: string;
  email: string;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: "Ya existe una cuenta con ese email",
  EMAIL_NOT_FOUND: "Email o contraseña incorrectos",
  INVALID_PASSWORD: "Email o contraseña incorrectos",
  INVALID_LOGIN_CREDENTIALS: "Email o contraseña incorrectos",
  USER_DISABLED: "Esta cuenta fue deshabilitada",
  OPERATION_NOT_ALLOWED: "El acceso con email todavía no está habilitado",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Demasiados intentos. Probá nuevamente más tarde",
};

async function requestAuth(endpoint: string, payload: Record<string, unknown>) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new Error("Missing Firebase Web API key");

  // Contra el Auth Emulator (E2E) las credenciales son locales; la key no se valida.
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const base = emulatorHost ? `http://${emulatorHost}/identitytoolkit.googleapis.com/v1` : "https://identitytoolkit.googleapis.com/v1";

  const response = await fetch(`${base}/${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, returnSecureToken: true }),
    cache: "no-store",
  });
  const body = (await response.json()) as FirebaseAuthResponse & { error?: { message?: string } };

  if (!response.ok) {
    const code = body.error?.message?.split(" ")[0] ?? "";
    throw new Error(AUTH_ERROR_MESSAGES[code] ?? "No se pudo completar la autenticación");
  }

  return body;
}

export function signInWithFirebasePassword(email: string, password: string) {
  return requestAuth("accounts:signInWithPassword", { email, password });
}

export function signUpWithFirebasePassword(email: string, password: string) {
  return requestAuth("accounts:signUp", { email, password });
}
