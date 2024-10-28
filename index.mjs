import fs from "fs";
import fetch from "node-fetch";
import ora from "ora";
import path from "path";
import readline from "readline";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));
const downloadDir = path.join(__dirname, "downloads");

if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

const cleanPath = (inputPath) => inputPath.replace(/^['"]|['"]$/g, "").trim();

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  else return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(outputPath, buffer);
}

async function processImage(inputPath, format, quality, shouldCrop, cropDimensions, spinner) {
  try {
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const outputDir = path.join(path.dirname(inputPath), "optimized");

    spinner.text = `Processing ${fileName}...`;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    let imageProcess = sharp(inputPath);
    const metadata = await imageProcess.metadata();

    if (shouldCrop && cropDimensions) {
      const [width, height] = cropDimensions;
      imageProcess = imageProcess.resize(parseInt(width), parseInt(height), {
        fit: "cover",
        position: "center",
      });
    }

    if (format === "webp") {
      imageProcess = imageProcess.webp({ quality });
    } else if (format === "png") {
      imageProcess = imageProcess.png({ quality });
    }

    const outputPath = path.join(outputDir, `${fileName}.${format}`);
    await imageProcess.toFile(outputPath);

    const inputStats = fs.statSync(inputPath);
    const outputStats = fs.statSync(outputPath);
    const outputMetadata = await sharp(outputPath).metadata();
    const savings = (((inputStats.size - outputStats.size) / inputStats.size) * 100).toFixed(2);

    const stats = {
      inputPath,
      outputPath,
      originalSize: inputStats.size,
      optimizedSize: outputStats.size,
      originalFormat: metadata.format,
      optimizedFormat: format,
      originalDimensions: `${metadata.width}x${metadata.height}`,
      optimizedDimensions: `${outputMetadata.width}x${outputMetadata.height}`,
      savings,
    };

    spinner.succeed(`Processed: ${fileName}.${format}`);
    return stats;
  } catch (error) {
    spinner.fail(`Error processing ${path.basename(inputPath)}: ${error.message}`);
    throw error;
  }
}

function isURL(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const mainSpinner = ora();
  let totalSavedBytes = 0;
  let totalOriginalBytes = 0;
  let processedStats = [];

  try {
    const rawInputPaths = await question("1. Enter paths to images/image folders (or URLs) separated by space: ");
    const inputPaths = rawInputPaths.split(" ").map(cleanPath);

    console.log("\n2. Choose Image Format:");
    console.log("1. webp");
    console.log("2. png");
    const formatChoice = await question("Enter your choice (1 or 2): (Default Webp)");

    const format = formatChoice ? (formatChoice === "1" ? "webp" : "png") : "webp";

    const qualityInput = await question("\n3. Enter quality (0-100, default is 80): ");
    const quality = qualityInput ? Math.min(100, Math.max(0, parseInt(qualityInput))) : 80;

    const cropResponse = await question("\n4. Do you want to crop the images? (y/n): ");
    const shouldCrop = cropResponse.toLowerCase() === "y";

    let cropDimensions;
    if (shouldCrop) {
      const dimensions = await question('Enter width and height separated by space (e.g., "800 600"): ');
      cropDimensions = dimensions.split(" ");
      if (cropDimensions.length !== 2 || isNaN(cropDimensions[0]) || isNaN(cropDimensions[1])) {
        throw new Error("Invalid dimensions! Please provide valid numbers.");
      }
    }

    for (let inputPath of inputPaths) {
      try {
        if (isURL(inputPath)) {
          const urlFilename = path.basename(new URL(inputPath).pathname);
          const urlFileExtension = path.extname(urlFilename);

          const outputFileName = await question(
            `Enter output file name for ${urlFilename} (leave blank to use URL file name): `
          );
          inputPath = path.join(downloadDir, outputFileName || urlFilename);

          if (!path.extname(inputPath)) {
            inputPath += urlFileExtension;
          }

          console.log(`Downloading image from URL: ${inputPath}...`);
          await downloadImage(inputPath, inputPath);
          console.log("Image downloaded successfully.");
        } else if (!fs.existsSync(inputPath)) {
          throw new Error(`Path does not exist: ${inputPath}`);
        }

        const stats = fs.statSync(inputPath);
        if (stats.isDirectory()) {
          const files = fs.readdirSync(inputPath);
          const imageFiles = files.filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));

          if (imageFiles.length === 0) {
            throw new Error("No image files found in the directory!");
          }

          mainSpinner.info(`Found ${imageFiles.length} image(s) to process`);
          const processSpinner = ora().start("Starting batch processing...");

          for (const file of imageFiles) {
            const fullPath = path.join(inputPath, file);
            try {
              const fileStats = await processImage(
                fullPath,
                format,
                quality,
                shouldCrop,
                cropDimensions,
                processSpinner
              );
              if (fileStats) {
                processedStats.push(fileStats);
                totalOriginalBytes += fileStats.originalSize;
                totalSavedBytes += fileStats.originalSize - fileStats.optimizedSize;
              }
            } catch (error) {
              console.error(`Error processing ${file}: ${error.message}`);
            }
          }

          processSpinner.succeed(`Batch processing complete! Processed ${imageFiles.length} files`);
        } else {
          const processSpinner = ora().start("Processing image...");
          const fileStats = await processImage(inputPath, format, quality, shouldCrop, cropDimensions, processSpinner);
          if (fileStats) {
            processedStats.push(fileStats);
            totalOriginalBytes += fileStats.originalSize;
            totalSavedBytes += fileStats.originalSize - fileStats.optimizedSize;
          }
        }
      } catch (error) {
        console.error(`Error with path ${inputPath}: ${error.message}`);
      }
    }

    // Results display
    console.log("\n📊 Optimization Results:\n");

    processedStats.forEach((stat, index) => {
      const fileName = path.basename(stat.inputPath);
      console.log(`${index + 1}. ${fileName}`);
      console.log(
        `   Before: ${formatFileSize(stat.originalSize)} (${stat.originalFormat.toUpperCase()} - ${
          stat.originalDimensions
        })`
      );
      console.log(
        `   After:  ${formatFileSize(stat.optimizedSize)} (${stat.optimizedFormat.toUpperCase()} - ${
          stat.optimizedDimensions
        })`
      );
      console.log(`   Reduced: ${stat.savings}%`);
      console.log("");
    });

    if (processedStats.length > 0) {
      const totalSavingsPercent = ((totalSavedBytes / totalOriginalBytes) * 100).toFixed(2);
      console.log("📈 Total Statistics:");
      console.log(`   Total Size Before: ${formatFileSize(totalOriginalBytes)}`);
      console.log(`   Total Size After:  ${formatFileSize(totalOriginalBytes - totalSavedBytes)}`);
      console.log(`   Total Space Saved: ${formatFileSize(totalSavedBytes)} (${totalSavingsPercent}%)`);
    } else {
      console.log("No images were processed successfully.");
    }

    console.log(`\n💾 Output Directory: ${path.join(path.dirname(inputPaths[0]), "optimized")}`);
    mainSpinner.succeed("All operations completed successfully!");
  } catch (error) {
    mainSpinner.fail(`Error: ${error.message}`);
  } finally {
    rl.close();
  }
}

main();
