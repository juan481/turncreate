"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ServiceCategoryRecord } from "@/server/services/catalog";
import { createService } from "./actions";
import { ServiceFields } from "./service-fields";

export function NewServiceForm({
  tenantSlug,
  categories,
}: {
  tenantSlug: string;
  categories: ServiceCategoryRecord[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-lg"
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await createService(tenantSlug, { error: null }, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          toast.show("¡Servicio creado!");
          router.push(`/app/${tenantSlug}/servicios`);
        })
      }
    >
      <ServiceFields
        tenantSlug={tenantSlug}
        categories={categories}
        defaults={{ name: "", price: "", durationMin: 30, categoryId: null, description: "", public: true }}
      />
      {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Creando…" : "Crear servicio"}
      </Button>
    </form>
  );
}
