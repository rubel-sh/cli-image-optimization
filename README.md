# Image Optimization Tool

This tool allows you to optimize images by converting them to different formats, adjusting quality, and optionally cropping them. It supports batch processing of images in a directory and can also download and process images from URLs.

## Features

- Convert images to WebP or PNG format.
- Adjust image quality.
- Crop images to specified dimensions.
- Batch process images in a directory.
- Download and process images from URLs.
- Display optimization statistics.

## Installation

To use this tool, you need to have [Node.js](https://nodejs.org/) installed. Then, install the required dependencies:

```bash
npm install fs node-fetch ora path readline sharp
```

## Usage

Run the script using yarn/ npm:

```bash
yarn run optimize or npm run optimize
```

Follow the prompts to provide the necessary inputs:

1. **Enter path to image/image folder (or URL):** Provide the path to a single image, a directory containing images, or a URL to download an image.
2. **Choose Image Format:** Select the output format (WebP or PNG).
3. **Enter quality (0-100, default is 80):** Specify the quality of the output image.
4. **Do you want to crop the image? (y/n):** Choose whether to crop the image.
5. **Enter width and height separated by space (e.g., "800 600"):** If cropping, provide the dimensions.

## Example

```bash
yarn run optimize or npm run optimize
```

Example interaction:

```
1. Enter path to image/image folder (or URL): /path/to/image.jpg
2. Choose Image Format:
  1. webp
  2. png
Enter your choice (1 or 2): 1
3. Enter quality (0-100, default is 80): 80
4. Do you want to crop the image? (y/n): y
Enter width and height separated by space (e.g., "800 600"): 800 600
```

## Output

The optimized images will be saved in an `optimized` directory within the same directory as the input images. The script will display optimization statistics, including the original and optimized sizes, formats, dimensions, and the percentage of space saved.

## License

This project is licensed under the MIT License.
