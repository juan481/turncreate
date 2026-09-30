import "server-only";

type FirebaseAuthResponse = {
  idToken: string;
  localId: string;
  email: string;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: "Ya existe una cuenta con ese email",
  EMAIL_NOT_FOUND: "Email o contraseÃ±a incorrectos",
  INVALID_PASSWORD: "Email o contraseÃ±a incorrectos",
  INVALID_LOGIN_CREDENTIALS: "Email o contraseÃ±a incorrectos",
  USER_DISABLED: "Esta cuenta fue deshabilitada",
  OPERATION_NOT_ALLOWED: "El acceso con email todavÃ­a no estÃ¡ habilitado",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Demasiados intentos. ProbÃ¡ nuevamente mÃ¡s tarde",
};

async function requestAuth(endpoint: string, payload: Record<string, unknown>) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new Error("Missing Firebase Web API key");

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, returnSecureToken: true }),
    cache: "no-store",
  });
  const body = (await response.json()) as FirebaseAuthResponse & { error?: { message?: string } };

  if (!response.ok) {
    const code = body.error?.message?.split(" ")[0] ?? "";
    throw new Error(AUTH_ERROR_MESSAGES[code] ?? "No se pudo completar la autenticaciÃ³n");
  }

  return body;
}

export function signInWithFirebasePassword(email: string, password: string) {
  return requestAuth("accounts:signInWithPassword", { email, password });
}

export function signUpWithFirebasePassword(email: string, password: string) {
  return requestAuth("accounts:signUp", { email, password });
}
