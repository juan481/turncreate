import { test, expect } from "@playwright/test";
import { SLUG } from "./fixtures";

// Regresión: el chequeo de acceso vivía solo en el layout, y Next renderiza
// layout y página en paralelo -- con una cookie inventada, el payload RSC
// de la página podía traer la lista de clientes de cualquier local. Cada
// página pasa ahora por requireTenantPage (src/server/firebase/tenant-page.ts).
const FAKE_SESSION = "turncreate_session=cookie-inventada";
const PRIVATE_PAGES = ["clientes", "clientes/e2e_client_fixture", "caja", "reportes", "configuracion", "agenda"];

for (const path of PRIVATE_PAGES) {
  test(`sin sesión válida, /app/${SLUG}/${path} no filtra datos del local en el RSC`, async ({ request }) => {
    for (const headers of [{ Cookie: FAKE_SESSION }, { Cookie: FAKE_SESSION, RSC: "1" }]) {
      const response = await request.get(`/app/${SLUG}/${path}`, { headers, maxRedirects: 0 });
      const body = await response.text();
      expect(body).not.toContain("Cliente Fixture");
      expect(body).not.toContain("cliente-fixture@turncreate.test");
      expect(body).not.toContain("+5491100000000");
    }
  });
}

test("sin ser admin de plataforma, /platform no lista los locales en el RSC", async ({ request }) => {
  const response = await request.get("/platform", { headers: { Cookie: FAKE_SESSION, RSC: "1" }, maxRedirects: 0 });
  expect(await response.text()).not.toContain(SLUG);
});
