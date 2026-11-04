import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Print do app em moldura, no tema da página. No celular vira um recorte do
 * canto superior esquerdo, para o texto continuar legível. Os dois arquivos são carregados
 * sob demanda (o navegador não baixa a imagem escondida pelo CSS), menos o print do topo.
 */
export function AppPrint({
  name,
  alt,
  sizes,
  priority = false,
  className,
}: {
  /** Nome do arquivo em public/landing, sem "-claro.png" ou "-escuro.png". */
  name: string;
  alt: string;
  sizes: string;
  /** O print do topo da página: é o maior elemento da primeira tela. Vale para o tema claro, que é o padrão. */
  priority?: boolean;
  className?: string;
}) {
  const shared = { sizes, width: 2400, height: 1500 };
  return (
    <div className={cn("aspect-[4/3] overflow-hidden rounded-xl border bg-card shadow-sm sm:aspect-auto", className)}>
      <Image
        {...shared}
        alt={alt}
        src={`/landing/${name}-claro.png`}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className="h-auto w-160 max-w-none sm:w-full dark:hidden"
      />
      <Image {...shared} alt={alt} src={`/landing/${name}-escuro.png`} className="hidden h-auto w-160 max-w-none sm:w-full dark:block" />
    </div>
  );
}
