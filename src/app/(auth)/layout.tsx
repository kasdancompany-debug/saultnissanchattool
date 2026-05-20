export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Soft vertical wash — depth without noise */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,oklch(0.97_0_0),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,oklch(0.22_0_0),transparent_55%)]"
      />
      {/* Corner accent — single subtle primary glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 size-[min(55vw,28rem)] rounded-full bg-primary/[0.065] blur-3xl dark:bg-primary/[0.09]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 size-[min(50vw,24rem)] rounded-full bg-muted/60 blur-3xl dark:bg-muted/20"
      />
      {/* Fine grid — lightweight SVG data URI */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='0.05' d='M0 .5h32M.5 0v32'/%3E%3C/svg%3E")`,
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden opacity-[0.35] dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='0.06' d='M0 .5h32M.5 0v32'/%3E%3C/svg%3E")`,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative flex min-h-screen flex-col items-center justify-center p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
