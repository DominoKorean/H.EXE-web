const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Ensure archiver is available
try {
  require.resolve("archiver");
} catch {
  console.log("Installing archiver...");
  execSync("npm install archiver", { stdio: "inherit" });
}

const archiver = require("archiver");

const HANEUL_DIR = path.join(__dirname, "haneul");
const OUTPUT = path.join(__dirname, "haneul.jsdos");

const DOSBOX_CONF = `[dosbox]
machine=svga_s3
memsize=16

[cpu]
core=auto
cputype=auto
cycles=max

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
sbmixer=true
oplmode=auto
oplemu=default
oplrate=44100

[autoexec]
mount c .
c:
H.EXE
`;

async function build() {
  const output = fs.createWriteStream(OUTPUT);
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => { throw err; });
  archive.pipe(output);

  // Add dosbox.conf inside .jsdos/ directory (required by js-dos)
  archive.append(DOSBOX_CONF, { name: ".jsdos/dosbox.conf" });

  // Add all files from haneul/ directory to the root of the archive
  const files = fs.readdirSync(HANEUL_DIR);
  for (const file of files) {
    const filePath = path.join(HANEUL_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      archive.file(filePath, { name: file });
    }
  }

  await archive.finalize();

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      const size = (archive.pointer() / 1024).toFixed(1);
      console.log(`Created ${OUTPUT} (${size} KB, ${files.length} files)`);
      resolve();
    });
    output.on("error", reject);
  });
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
