import { notFound } from "next/navigation";

/**
 * Fail closed until real account sessions and ADMIN authorization exist.
 * Both the admin UI and future admin APIs must independently verify roles.
 */
export default function AdminPage() {
  notFound();
}
