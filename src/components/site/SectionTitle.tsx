export function SectionTitle({ title, id }: { eyebrow?: string; title: string; id?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      <h2 className="font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">{title}</h2>
      <span className="mt-4 block h-px w-12 bg-gold/70" />
    </div>
  );
}
