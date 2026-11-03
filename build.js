// build.js
// Bundler & Packager: esbuild compilation + old zip cleaner + fresh zip packager

import esbuild from 'esbuild';
import { ZipArchive } from 'archiver';
import fs from 'fs';
import path from 'path';

async function build() {
  console.log('⚡ Starting build process with esbuild...');

  // 1. Cập nhật version trong manifest.json lên 2.5.0
  const manifestPath = path.resolve('extension/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = '2.5.0';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`📌 Manifest version updated to ${manifest.version}`);

  // 2. Biên dịch ES Module trong src/ thành 1 file duy nhất extension/content.js
  const startTime = Date.now();
  await esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    outfile: 'extension/content.js',
    format: 'iife',
    platform: 'browser',
    target: ['chrome100'],
    minify: false,
    sourcemap: false
  });
  console.log(`✅ esbuild compiled extension/content.js in ${Date.now() - startTime}ms`);

  // 3. Tự động tìm và xóa tất cả các file zip cũ trong thư mục gốc
  const rootFiles = fs.readdirSync('.');
  const oldZipFiles = rootFiles.filter(file => file.endsWith('.zip') && (file.includes('coursera') || file.includes('extension')));
  for (const zipFile of oldZipFiles) {
    try {
      fs.unlinkSync(zipFile);
      console.log(`🗑️ Deleted old zip archive: ${zipFile}`);
    } catch (err) {
      console.warn(`Could not delete ${zipFile}:`, err.message);
    }
  }

  // 4. Đóng gói zip mới nhất cho phiên bản 2.5.0
  const zipName = `coursera-helper-extension-${manifest.version}.zip`;
  console.log(`📦 Packaging fresh extension archive: ${zipName}...`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipName);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory('extension', false);
    archive.finalize();
  });
  
  if (fs.existsSync(zipName)) {
    const stats = fs.statSync(zipName);
    console.log(`🎉 Successfully packaged ${zipName} (${(stats.size / 1024).toFixed(1)} KB)`);
  }
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
