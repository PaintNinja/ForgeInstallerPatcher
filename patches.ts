"use strict";

import { info, error } from './mod.ts';
import { sep } from "https://deno.land/std@0.77.0/path/mod.ts"; // use the right path separator depending on the platform ran on
import { ensureFile } from "https://deno.land/std@0.77.0/fs/ensure_file.ts";
import { Untar } from "https://deno.land/std@0.77.0/archive/tar.ts";

// Extract the patches.tar file
export async function extractPatchesTar() {
    info("Extracting patches from patches.tar...");
    // todo: only extract if not already extracted
    const reader = await Deno.open("patches.tar", { read: true });
    const untar = new Untar(reader);

    for await (const entry of untar) {
        await ensureFile(entry.fileName);
        const file = await Deno.open(entry.fileName, { write: true });
        // <entry> is a reader.
        await Deno.copy(entry, file);
        file.close();
    }
    reader.close();
    info("Patches extracted from patches.tar");
}

// Extract the files we're interested in patching from the official installer jar
export async function selectivelyExtractInstallerJar(jarToolPath: string, installerJarToExtract: string) {
    info("Selectively extracting installer jar for patching...");
    const jarToolCmd = {
        cmd: [jarToolPath, "-xf", installerJarToExtract,
            `net${sep}minecraftforge${sep}installer${sep}SimpleInstaller.class`,
            `net${sep}minecraftforge${sep}installer${sep}SimpleInstaller$1.class`,
            `META-INF${sep}MANIFEST.MF`, `META-INF${sep}FORGE.DSA`, `META-INF${sep}FORGE.SF`]
    };
    const jarToolProcess = Deno.run(jarToolCmd);

    if (!(await jarToolProcess.status()).success) {
        error(`Failed to extract the intaller jar with the "jar" tool.`);
        info(`Attempted command: ${jarToolCmd.cmd.toString().replaceAll(",", " ")}`)
        Deno.exit(2);
    }
    info("Selective installer jar extraction complete");
}

export async function patchFile(fileToPatch: string, deltaFileToPatchWith: string, xdeltaToolPath: string) {
    info(`Patching ${fileToPatch} with ${deltaFileToPatchWith}`);
    const xdeltaToolCmd = {
        cmd: [xdeltaToolPath, "-d", "-f", "-s", fileToPatch, deltaFileToPatchWith, `${fileToPatch}.patched`]
    };
    const xdeltaToolProcess = Deno.run(xdeltaToolCmd);

    if (!(await xdeltaToolProcess.status()).success) {
        error(`Failed to patch ${fileToPatch} with the "xdelta3" tool.`)
        info(`Attempted command: ${xdeltaToolCmd.cmd.toString().replaceAll(",", " ")}`)
        Deno.exit(2);
    }

    await Deno.remove(fileToPatch);
    await Deno.copyFile(`${fileToPatch}.patched`, fileToPatch);
    await Deno.remove(`${fileToPatch}.patched`);
    info(`Patched ${fileToPatch}`);
}

export async function applyPatches(jarToolPath: string, jarToApplyTo: string, classesToApply: string[], metaInfToApply?: string) {
    info(`Applying patched class files to "${jarToApplyTo}"...`);
    {
        let jarToolCmd = {
            cmd: [jarToolPath, "-uf", jarToApplyTo]
        };
        classesToApply.forEach(classToApply => {
            jarToolCmd.cmd.push(`${classToApply}`);
        })
        const jarToolProcess = Deno.run(jarToolCmd);

        if (!(await jarToolProcess.status()).success) {
            error(`Failed to apply patched class files to "${jarToApplyTo}" with the "jar" tool.`);
            info(`Attempted command: ${jarToolCmd.cmd.toString().replaceAll(",", " ")}`);
            await Deno.remove(jarToApplyTo);
            Deno.exit(2);
        }
    }
    info(`Applied patched class files to "${jarToApplyTo}"`);

    if (metaInfToApply) {
        info(`Handling special case for applying META-INF${sep}MANIFEST.MF...`);
        // handle special case for META-INF\MANIFEST.MF as it can't be updated directly with the jar tool
        // stage 1: remove the old one (updating the manifest file without specifying -m will remove it)
        const jarToolCmd = { cmd: [jarToolPath, "-uf", jarToApplyTo, `${metaInfToApply}`] };
        const jarToolProcess = Deno.run(jarToolCmd);

        if (!(await jarToolProcess.status()).success) {
            error(`Failed to apply patched MANIFEST.MF to "${jarToApplyTo}" with the "jar" tool.`);
            info(`Attempted command: ${jarToolCmd.cmd.toString().replaceAll(",", " ")}`);
            await Deno.remove(jarToApplyTo);
            Deno.exit(2);
        }

        // stage 2: put the new one in
        const jarToolCmd2 = { cmd: [jarToolPath, "-ufm", jarToApplyTo, `${metaInfToApply}`] };
        const jarToolProcess2 = Deno.run(jarToolCmd2);

        if (!(await jarToolProcess2.status()).success) {
            error(`Failed to apply patched MANIFEST.MF to "${jarToApplyTo}" with the "jar" tool.`);
            info(`Attempted command: ${jarToolCmd2.cmd.toString().replaceAll(",", " ")}`);
            await Deno.remove(jarToApplyTo);
            Deno.exit(2);
        }
        info(`Special case for META-INF${sep}MANIFEST.MF handled and applied to "${jarToApplyTo}"`);
    }
}