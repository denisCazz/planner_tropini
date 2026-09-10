"use client";

import { useState, useEffect, useRef } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Client } from "@/types/client";
import ClientDetailView, { ClientDetailSkeleton } from "@/components/clienti/ClientDetailView";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  function scheduleDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);

    const toastId = toast("Eliminazione programmata", {
      description: "Tornerai alla lista tra pochi secondi.",
      duration: 5000,
      action: {
        label: "Annulla",
        onClick: () => {
          if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
          deleteTimerRef.current = null;
          toast.dismiss(toastId);
        },
      },
    });

    deleteTimerRef.current = setTimeout(() => {
      deleteTimerRef.current = null;
      toast.dismiss(toastId);
      void (async () => {
        try {
          await fetch(`/api/clients/${id}`, { method: "DELETE" });
          toast.success("Cliente eliminato");
          router.push("/clienti");
        } catch {
          toast.error("Errore durante l'eliminazione");
        }
      })();
    }, 5000);
  }

  if (loading) return <ClientDetailSkeleton />;
  if (!client) return <div className="p-8 text-gray-400">Cliente non trovato</div>;

  return (
    <ClientDetailView
      client={client}
      onClientChange={setClient}
      onDelete={scheduleDelete}
    />
  );
}
