import Image from "next/image";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      <aside className="auth-story" aria-label="LINEHORSE">
        <Image
          src="/images/construction-framing.webp"
          alt=""
          fill
          sizes="50vw"
          className="auth-story-image"
        />
        <p className="shell-wordmark relative">LINEHORSE</p>
        <div className="auth-story-content">
          <p className="shell-tagline">CONSTRUCTION INTELLIGENCE</p>
          <h2>
            Keep your
            <br />
            project running.
          </h2>
          <p className="max-w-md text-base leading-7 text-stone-200">
            Capture construction reality once. Turn it into useful intelligence
            everywhere.
          </p>
          <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-stone-300">
            Built for builders, by builders.
          </p>
        </div>
      </aside>
      <div className="auth-entry">{children}</div>
    </div>
  );
}
