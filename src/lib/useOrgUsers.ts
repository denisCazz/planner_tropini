"use client";

import { useEffect, useState, useCallback } from "react";
import type { OrgUser } from "@/types/client";

let cache: OrgUser[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Invalida la cache e notifica i componenti che usano useOrgUsers. */
export function invalidateOrgUsersCache() {
  cache = null;
  notify();
}

/** Carica una volta l'elenco dei tecnici/utenti dell'organizzazione. */
export function useOrgUsers() {
  const [users, setUsers] = useState<OrgUser[]>(() => cache ?? []);
  const [loading, setLoading] = useState(cache == null);

  const reload = useCallback(() => {
    setLoading(true);
    return fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: OrgUser[]) => {
        cache = Array.isArray(data) ? data : [];
        setUsers(cache);
        return cache;
      })
      .catch(() => {
        cache = [];
        setUsers([]);
        return cache;
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onInvalidate = () => {
      void reload();
    };
    listeners.add(onInvalidate);
    return () => {
      listeners.delete(onInvalidate);
    };
  }, [reload]);

  useEffect(() => {
    if (cache) return;
    const id = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(id);
  }, [reload]);

  // Le assegnazioni devono proporre soltanto persone che possono ancora accedere.
  return { users: users.filter((user) => user.attivo !== false), loading, reload };
}
