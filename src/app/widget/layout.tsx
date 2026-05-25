import "../globals.css";

/**
 * Standalone /widget and iframe embed: keep the host page minimal; full design tokens + Tailwind
 * come from `globals.css` (also imported in root `layout.tsx` — import here so this route’s RSC
 * graph always includes the same CSS chunk and embedded views don’t render “unstyled” if the
 * main bundle order differs).
 */
export default function WidgetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html:
            "html,body{background:transparent;min-height:0;margin:0;overflow:hidden}",
        }}
      />
      {children}
    </>
  );
}
