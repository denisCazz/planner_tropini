import { readFileSync } from "fs";
const txt = readFileSync("public/location/test/doc.kml", "utf8");

// Map: styleId → color (aabbggrr)
const styleColors = {};
const styleRe = /<Style id="([^"]+)">([\s\S]*?)<\/Style>/g;
let m;
while ((m = styleRe.exec(txt)) !== null) {
  const id = m[1], body = m[2];
  const cm = body.match(/<color>([^<]+)<\/color>/);
  if (cm) styleColors[id] = cm[1];
}

// StyleMap: StyleMap id → { normal: styleId, highlight: styleId }
const styleMaps = {};
const smRe = /<StyleMap id="([^"]+)">([\s\S]*?)<\/StyleMap>/g;
while ((m = smRe.exec(txt)) !== null) {
  const id = m[1], body = m[2];
  const normalM = body.match(/<key>normal<\/key>[\s\S]*?<styleUrl>#([^<]+)<\/styleUrl>/);
  const hlM = body.match(/<key>highlight<\/key>[\s\S]*?<styleUrl>#([^<]+)<\/styleUrl>/);
  styleMaps[id] = {
    normal: normalM ? normalM[1] : null,
    highlight: hlM ? hlM[1] : null,
  };
}

// Resolve: for each StyleMap, get normal color
const resolvedColors = {};
for (const [smId, refs] of Object.entries(styleMaps)) {
  const normalStyle = refs.normal;
  if (normalStyle && styleColors[normalStyle]) {
    resolvedColors[smId] = styleColors[normalStyle];
  }
}

// Count placemarks per resolved color
const colorCount = {};
const pmRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g;
while ((m = pmRe.exec(txt)) !== null) {
  const body = m[1];
  const su = body.match(/<styleUrl>#([^<]+)<\/styleUrl>/);
  if (su) {
    const styleRef = su[1];
    const color = resolvedColors[styleRef] ?? styleColors[styleRef] ?? "unknown";
    // Convert aabbggrr → rgb
    let colorLabel = color;
    if (color.length === 8) {
      const r = parseInt(color.slice(6), 16);
      const g = parseInt(color.slice(4, 6), 16);
      const b = parseInt(color.slice(2, 4), 16);
      colorLabel = `rgb(${r},${g},${b}) [${color}]`;
    }
    colorCount[colorLabel] = (colorCount[colorLabel] ?? 0) + 1;
  }
}

console.log("=== Placemark count by color ===");
for (const [c, n] of Object.entries(colorCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(4)} × ${c}`);
}
