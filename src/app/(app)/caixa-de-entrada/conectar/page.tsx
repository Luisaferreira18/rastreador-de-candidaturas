import { redirect } from "next/navigation";

/** Endereço antigo: a conexão do e-mail agora fica na página Conexões. */
export default function OldConnectEmailPage() {
  redirect("/conexoes#email");
}
