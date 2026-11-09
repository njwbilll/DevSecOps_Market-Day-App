import { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Memindai QR memakai kamera belakang. Butuh HTTPS dan izin kamera.
export default function Scanner({ onResult, onError }) {
  useEffect(() => {
    const qr = new Html5Qrcode('qr-reader');
    let handled = false;

    const starting = qr
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          if (handled) return;
          handled = true;
          onResult(text);
        },
        () => {},
      )
      .catch((err) => onError?.(String(err)));

    return () => {
      starting
        .then(() => qr.stop())
        .then(() => qr.clear())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id="qr-reader" className="scanner" />;
}
