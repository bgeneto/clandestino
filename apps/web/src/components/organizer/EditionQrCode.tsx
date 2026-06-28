import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type EditionQrCodeProps = {
  url: string;
  label?: string;
};

export function EditionQrCode({ url, label }: EditionQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void QRCode.toDataURL(url, {
      margin: 1,
      width: 200,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
    }).then((generated) => {
      if (!cancelled) {
        setDataUrl(generated);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="text-center">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="QR code da edição"
          className="mx-auto h-[200px] w-[200px] rounded-lg"
        />
      ) : (
        <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center rounded-lg bg-surface-muted text-xs text-subtle">
          Gerando QR…
        </div>
      )}
      {label ? <p className="mt-2 text-xs text-subtle">{label}</p> : null}
      <p className="mt-2 break-all text-[11px] text-subtle">{url}</p>
    </div>
  );
}
