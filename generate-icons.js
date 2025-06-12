const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const states = ['active', 'inactive'];

// Ensure icons directory exists
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

async function generateIcons() {
  for (const state of states) {
    const svgPath = path.join(__dirname, `icons/icon${state === 'inactive' ? '-inactive' : ''}.svg`);
    const svgContent = fs.readFileSync(svgPath, 'utf8');

    for (const size of sizes) {
      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .toFile(path.join(__dirname, `icons/icon${size}-${state}.png`));
      
      console.log(`Generated ${size}x${size} ${state} icon`);
    }
  }
}

generateIcons().catch(console.error); 