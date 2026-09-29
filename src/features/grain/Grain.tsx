import { useEffect, useState } from 'react';
import { createRng } from '../../lib/random.ts';
import { useSettings } from '../../stores/settings.ts';
import styles from './Grain.module.css';

const TILE = 180;

let tile: Promise<string | null> | null = null;

/** Generates the grain tile once per session and shares its object URL. */
function grainTile(): Promise<string | null> {
  tile ??= new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    const image = ctx.createImageData(TILE, TILE);
    const rng = createRng('grain');
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.floor(rng.next() * 255);
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 22;
    }
    ctx.putImageData(image, 0, 0);
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null));
  });
  return tile;
}

/** Film grain over the whole observatory — generated in the browser, never downloaded. */
export function Grain() {
  const enabled = useSettings((s) => s.grain);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void grainTile().then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  if (!enabled || !url) return null;
  return <div className={styles.grain} style={{ backgroundImage: `url(${url})` }} aria-hidden="true" />;
}
