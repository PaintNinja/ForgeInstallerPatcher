"use strict";

import { info, error } from './mod.ts';
import { exists } from "https://deno.land/std@0.77.0/fs/exists.ts";
import { sep } from "https://deno.land/std@0.77.0/path/mod.ts"; // use the right path separator depending on the platform ran on

// Check for Forge installer jar
export async function checkInputExistence(input: string) {
    info("Checking input installer file existence...");
    if (!await exists(input)) {
        error(`Input file "${input}" not found.`);
        info("You can download the Forge installer jar here: https://files.minecraftforge.net");
        Deno.exit(2);
    }
    info("Input installer file found");
}

// Check for patch file
export async function checkPatchExistence() {
    info("Checking patch file existence...");
    if (!await exists("patches.tar")) {
        error(`Installer patch file "patches.tar" not found.`);
        Deno.exit(2);
    }
    info("Patch file found");
}

// Check for patch tools
export async function checkPatchTool(toolName: string): Promise<string> {
    info(`Checking ${toolName} tool existence...`);
    // first check if installed system-wide
    let isToolInstalledChecker: Deno.Process<Deno.RunOptions>;
    if (Deno.build.os === "windows") isToolInstalledChecker = Deno.run({ cmd: ["where", "/q", toolName] });
    else isToolInstalledChecker = Deno.run({ cmd: ["type", toolName, "&>", "/dev/null"] }); // I'm assuming this is fine on macOS, I have no way of checking without shelling out lots of money to find out :/
    const isToolInstalled = (await isToolInstalledChecker.status()).success

    let toolFileString = toolName;
    if (!isToolInstalled) {
        // if not, check if there's an executable in the working directory that we can use
        if (Deno.build.os === "windows") toolFileString += ".exe";

        // still no? then throw an error and quit
        if (!await exists(toolName)) {
            error(`Required dependency "${toolName}" tool not found.`);
            if (toolName === "jar") info(`You can download it here: https://adoptopenjdk.net/?variant=openjdk8&jvmVariant=hotspot ("OpenJDK 8 HotSpot")`);
            else info("You can download it here: https://github.com/jmacd/xdelta-gpl/releases/tag/v3.1.0");
            Deno.exit(2);
        }
    }
    info(`${toolName} tool found`);
    return isToolInstalled ? toolName : `.${sep}${toolFileString}`;
}