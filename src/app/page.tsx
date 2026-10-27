import { redirect } from "next/navigation";

/** A raiz leva ao painel (o proxy já manda para /login quem não entrou). */
export default function Home() {
  redirect("/painel");
}
