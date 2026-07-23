# Twitch Matrix Controller (64x16)

A Tampermonkey userscript built to interact seamlessly with the Twitch channel [daverdavid](https://www.twitch.tv/daverdavid). This overlay allows users to dynamically generate pixel art, insert text, and compress images into `!Pixel` chat commands specifically for the 64x16 LED display on stream.

## Core Features

* **Image Scaler and Cropper**: Paste directly from your clipboard and choose the exact area you want projected. The script will handle the downscaling automatically.
* **Text & Emoji Engine**: Inject crisp text or browse emojis using the built-in search tool to construct fun pixel structures.
* **Color Quantization and Palettes**: Optimize your artwork using a custom compression slider or lock it to retro standards (16-color CGA, 32-color DB32, or 64-color RGB 2-bit) to ensure vibrant rendering.
* **Smart Auto-Queue System**: The tool parses the canvas, consolidates matching colors into single commands to save space, and breaks the final output down into manageable chat lines. Pressing `Enter` automatically copies the next sequential command to your clipboard.
* **Bulk Export**: Use the built-in "COPY ALL" button for processing large batches instantly.

## Preview

Check out the interactive UI floating directly over the Twitch interface:

![UI Preview](image_4f3959.png)

## Quick Setup

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your web browser.
2. Click to create a new script and overwrite the default template with the content from `matrix_controller.js`.
3. Save the script and load into [daverdavid's Twitch channel](https://www.twitch.tv/daverdavid). The control panel will render in the top right corner of the window.
