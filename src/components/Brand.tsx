import Image from 'next/image';

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 inline-block rounded-2xl bg-white px-5 py-4 shadow-lg">
        <Image
          src="/etc-logo-light.jpeg"
          alt="شركة مسارات الامتياز - Excellence Tracks Co."
          width={180}
          height={96}
          priority
          className="h-auto w-40"
        />
      </div>
      {subtitle ? <p className="font-semibold text-brand-orange">{subtitle}</p> : null}
    </div>
  );
}
