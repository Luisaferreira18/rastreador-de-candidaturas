export function AuthDivider({ children = "ou" }: { children?: React.ReactNode }) {
  return (
    <div className="relative flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
