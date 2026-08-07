// Resize + compress the raw captures in ./shots/*.png into the WebP assets the
// site serves (../assets/shots/*.webp). Run after capture.mjs.
import sharp from 'sharp';
const IN = new URL('./shots/', import.meta.url).pathname;
const OUT = new URL('../assets/shots/', import.meta.url).pathname;

// [src, outName, maxWidth, quality]
const jobs = [
  ['stats-light.png', 'statistics.webp', 1600, 84],
  ['stats-dark.png', 'statistics-dark.webp', 1600, 84],
  ['stats-mobile.png', 'statistics-mobile.webp', 560, 86],
  ['map-light.png', 'map.webp', 1600, 80],
  ['map-dark.png', 'map-dark.webp', 1500, 78],
  ['species-light.png', 'species.webp', 1600, 84],
  ['breeding-light.png', 'breeding.webp', 1600, 84],
  ['media-light.png', 'multimedia.webp', 1600, 84],
  ['calendar-light.png', 'calendar.webp', 1600, 84],
  ['named-birds-light.png', 'named-birds.webp', 1600, 84],
  ['weather-light.png', 'weather.webp', 1080, 86],
];
for (const [src, out, w, q] of jobs) {
  const m = await sharp(`${IN}${src}`).resize({ width: w, withoutEnlargement: true }).webp({ quality: q }).toFile(`${OUT}${out}`);
  console.log(out.padEnd(26), `${m.width}x${m.height}`, Math.round(m.size / 1024) + 'KB');
}
console.log('IMAGES DONE');
