"use strict";

import { parse } from "https://deno.land/std@0.77.0/flags/mod.ts";
import * as Colours from "https://deno.land/std@0.77.0/fmt/colors.ts";
import { sep } from "https://deno.land/std@0.77.0/path/mod.ts"; // use the right path separator depending on the platform ran on
import * as Checks from './checks.ts';
import * as Patches from './patches.ts';

let verbose = false;
export function info(stringToPrint: string) { verbose ? console.info(Colours.cyan("[Info] ") + stringToPrint) : () => { } }
export function error(stringToPrint: string) { verbose ? console.error(Colours.brightRed(`[Error] ${stringToPrint}`)) : () => { } }

// Parse the CLI args
const args = parse(Deno.args);

console.log("ForgeInstallerPatcher v0.2");
console.log("--------------------------");

const noticeText = [
    "Notice:",
    "Please do not automate downloading the Forge installer - please direct your users to manually download it instead.",
    "Forge is a free open source project that relies on Patreon and adfocus download links, automated downloads hurt",
    "this revenue which makes it harder to pay for server hosting costs and development time as a result.",
    "",
    "Forge installer downloads: https://files.minecraftforge.net | Patreon: https://www.patreon.com/LexManos",
    ""
];

if (Deno.args.length === 0 || args.h || args.help) {
    const helpText = [
        "-i, --input       Forge installer jar to patch",
        "-o, --output      Desired path of outputted patched jar",
        //"-n, --noInternet  Don't attempt to download missing dependencies", // todo: download missing portable dependencies
        "-h, --help        Prints this help info",
        "-v, --version     Prints the version of this tool",
        "-V, --verbose     Prints progress details and error help",
        "",
        "Examples:",
        `"-i forge-installer.jar -o patched-installer.jar -V"`,
        `"--input forge-installer.jar --output patched-installer.jar --verbose"`,
        "",
        "Exit codes:",
        "0 - OK",
        "1 - Missing required arg(s)",
        "2 - Patching error",
        "",
        "This utility requires the following Deno permissions: --allow-read --allow-write --allow-run",
        `Tip: Use the "NO_COLOR" environment variable if you want to disable colours.`,
        "",
    ];
    helpText.forEach(line => { line.endsWith(":") ? console.log(Colours.underline(line)) : console.log(line); });
    noticeText.forEach(line => { line.endsWith(":") ? console.log(Colours.underline(line)) : console.log(line); });
    Deno.exit();
}

if (!args.i && !args.input) {
    error("Missing an input, please specify an -i or --input argument.");
    Deno.exit(1);
} else if (!args.o && !args.output) {
    error("Missing an output, please specify an -o or --output argument.");
    Deno.exit(1);
} else if (args.v || args.version) {
    console.log("v0.2");
    Deno.exit();
} else if (args.V || args.verbose) {
    verbose = true;
}

// If we got to this point, -v/--version or -h/--help weren't specified

const input = args.i || args.input;
const output = args.o || args.output;
const noInternet = args.n || args.noInternet;

// Show the notice text every patch run just to be sure eveyone's seen it
noticeText.forEach(line => {
    console.log(line);
})

console.log(`Creating patched jar "${output}" based on "${input}"...`);

// Run all the checks asynchronously before attempting to patch the installer jar
let xdeltaToolPathPromise: Promise<string>;
let jarToolPathPromise: Promise<string>;
await Promise.all([
    Checks.checkInputExistence(input),
    Checks.checkPatchExistence(),
    xdeltaToolPathPromise = Checks.checkPatchTool("xdelta3"),
    jarToolPathPromise = Checks.checkPatchTool("jar")
]);
const xdeltaToolPath = await xdeltaToolPathPromise;
const jarToolPath = await jarToolPathPromise;
// If we get to this point, all the checks passed so let's start patching


// Get ready for patching
await Promise.all([
    Patches.extractPatchesTar(), // make sure the patch files from patches.tar are extracted
    Patches.selectivelyExtractInstallerJar(jarToolPath, input) // extract the parts of the installer jar we're interested in patching
]);

// Patch the files and prepare the patched jar file asynchronously
await Promise.all([
    Patches.patchFile(`net${sep}minecraftforge${sep}installer${sep}SimpleInstaller.class`, "SimpleInstaller.vcdiff", xdeltaToolPath), // patch SimpleInstaller.class
    Patches.patchFile(`net${sep}minecraftforge${sep}installer${sep}SimpleInstaller$1.class`, "SimpleInstaller$1.vcdiff", xdeltaToolPath), // patch SimpleInstaller$1.class
    Patches.patchFile(`META-INF${sep}MANIFEST.MF`, "MANIFEST.vcdiff", xdeltaToolPath), // patch MANIFEST.MF

    // todo: keep some form of jar signing
    Patches.patchFile(`META-INF${sep}FORGE.DSA`, "FORGE.DSA.vcdiff", xdeltaToolPath), // patch FORGE.DSA
    Patches.patchFile(`META-INF${sep}FORGE.SF`, "FORGE.SF.vcdiff", xdeltaToolPath), // patch FORGE.SF

    Deno.copyFile(input, output)
]);

// Merge the patched files into the original installer jar to create the patched installer jar
await Patches.applyPatches(jarToolPath, output, [
    `net${sep}minecraftforge${sep}installer${sep}SimpleInstaller.class`,
    `net${sep}minecraftforge${sep}installer${sep}SimpleInstaller$1.class`,
    `META-INF${sep}FORGE.DSA`, `META-INF${sep}FORGE.SF`
], `META-INF${sep}MANIFEST.MF`);

// Cleanup now that we're done
await Promise.all([
    Deno.remove("META-INF/", { recursive: true }),
    Deno.remove("net/", { recursive: true }),
    Deno.remove("SimpleInstaller.vcdiff"),
    Deno.remove("SimpleInstaller$1.vcdiff"),
    Deno.remove("MANIFEST.vcdiff"),
    Deno.remove("FORGE.DSA.vcdiff"),
    Deno.remove("FORGE.SF.vcdiff")
]);

console.log(Colours.brightGreen(`Success! You can find your patched Forge installer jar at "${output}"`));