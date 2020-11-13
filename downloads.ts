"use strict";

import { sep } from "https://deno.land/std@0.77.0/path/mod.ts"; // use the right path separator depending on the platform ran on
import { exists } from "https://deno.land/std@0.77.0/fs/exists.ts";

/**
 * Downloads binary data from the given URL and writes it to the disk.
 * 
 * @param url The URL to download from
 * 
 * @param path
 * Optional, the default is to use the current working directory.
 * - If specified, the file is saved to the provided path and name according to the saveBlobToFile(blob, path) conventions.
 * - If omitted, the infer param becomes true and the file is stored in the current working directory with its inferred filename and extension.
 * 
 * @param infer
 * Optional, the default is false.
 * - If specified and set to true, the filename and extension is added to the path. If no path is specified, the file is stored in the current
 *   working directory and this param becomes true by default.
 * 
 * @param overwrite
 * Optional, the default is true.
 * - If specified and set to false, the file won't be redownloaded from the given URL if it already exists on the disk at the determined save path.
 *   Note that this does *not* check if the file on the disk is the same as the one from the given URL, it merely checks the presence of the file.
 */
export async function downloadUrlToFile(url: URL, path?: string, infer?: boolean, overwrite?: boolean) {
    let filePath: string;
    if (path) filePath = path;
    else filePath = getFilenameFromURL(url);

    if (infer || !filePath) {
        if (!filePath.endsWith(sep)) filePath += sep;
        filePath += getFilenameFromURL(url);
    }

    // Cancel the download if we're told to not overwrite the file and the filePath already exists
    if (overwrite === false && await exists(filePath)) return;

    const blob = await downloadUrlToBlob(url);
    return saveBlobToFile(blob, filePath);
}

/**
 * Fetches binary data from the given URL and returns a Blob if the status code is 200.
 * @param url The URL to download from
 */
export async function downloadUrlToBlob(url: URL) {
    const response = await fetch(url);
    if (response.status !== 200)
        return Promise.reject(new Deno.errors.Http(`Expected: 200 "OK", got: ${response.status} "${response.statusText}"`));

    return response.blob();
}

/**
 * Saves a binary Blob to a file in the specified path.
 * If the path arg starts with a path separator (such as "/" or "\"), the path is absolute, otherwise, it's relative to the current working directory.
 * @param blob The binary Blob to save to a file
 * @param path The path the file is saved to
 * 
 * @example
 * ```
 * // Saves the contents of the blob from variable "blob" to a file named "foo.txt" in the current working directory
 * saveBlobToFile(blob, "foo.txt");
 * ```
 * 
 * @example
 * ```
 * // Saves the contents of the blob from the variable "blob" to a file named "bar.txt" in the directory "foo" that can be found in the current working directory
 * saveBlobToFile(blob, "foo/bar.txt");
 * 
 * // This is also valid
 * import { sep } from "https://deno.land/std@0.77.0/path/mod.ts"; // use the right path separator depending on the platform ran on
 * saveBlobToFile(blob, `foo${sep}bar.txt`);
 * ```
 * 
 * @example
 * ```
 * // Saves the contents of the blob from the variable "blob" to a file named "foo.txt" in the absolute directory "/var/www/"
 * saveBlobToFile(blob, "/var/www/foo.txt");
 * ```
 */
export async function saveBlobToFile(blob: Blob, path: string) {
    return Deno.writeFile(path, new Deno.Buffer(await blob.arrayBuffer()).bytes());
}

/**
 * Attempts to infer the filename and extension from a URL by looking at the contents after the last "/"
 * @param url The URL to infer the filename and extension from
 * 
 * @example
 * ```
 * const url = new URL("https://test.com/example.txt");
 * const fileNameAndExt = getFilenameFromURL(url); // returns "example.txt"
 * ```
 */
function getFilenameFromURL(url: URL) {
    const splitUrl = url.pathname.split("/");
    return splitUrl[splitUrl.length - 1].toString();
}