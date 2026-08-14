import { FormEvent, useEffect, useState } from "react";
/* style-architecture-file-exception: compact contact CRUD uses native semantic form controls and row actions. */
import { Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button/Button";
import styles from "./ContactsTab.module.css";

export function ContactsTab({ clientId }: { clientId: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => setContacts(await api.getClientContacts(clientId));
  useEffect(() => {
    void load();
  }, [clientId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await api.saveClientContact(clientId, {
        ...data,
        isPrimary: data.isPrimary === "on",
      });
      form.reset();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.root}>
      <div>
        <h3>Contatos do cliente</h3>
        <p>
          Cadastre decisores, contatos financeiros e responsáveis pela
          aprovação.
        </p>
      </div>
      <form onSubmit={submit} className={styles.form}>
        <input name="name" required placeholder="Nome" />
        <input name="position" placeholder="Cargo / função" />
        <input name="email" type="email" placeholder="E-mail" />
        <input name="phone" placeholder="Telefone / WhatsApp" />
        <textarea name="notes" placeholder="Observações" />
        <label>
          <input name="isPrimary" type="checkbox" /> Contato principal
        </label>
        <Button type="submit" loading={busy}>
          Adicionar contato
        </Button>
      </form>
      <div className={styles.list}>
        {contacts.map((contact) => (
          <article key={contact.id}>
            <div>
              <strong>
                {contact.name}
                {contact.isPrimary ? " · principal" : ""}
              </strong>
              <span>
                {[contact.position, contact.email, contact.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {contact.notes && <small>{contact.notes}</small>}
            </div>
            <button
              aria-label={`Remover ${contact.name}`}
              onClick={() =>
                void api.deleteClientContact(clientId, contact.id).then(load)
              }
            >
              <Trash2 />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
