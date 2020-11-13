# ForgeInstallerPatcher
Patches the Forge Installer to allow for installing client on CLI.

## Dependencies
- Deno
- xdelta3
- jar (from the JDK)

## Instructions
1. Clone the repo
2. Open a new terminal window in the repo folder
3. Run `deno run --allow-read --allow-write --allow-run mod.ts --help`

## Notice
Please do not automate downloading the Forge installer - please direct your users to manually download it instead.

Forge is a free open source project that relies on Patreon and adfocus download links, automated downloads hurt
this revenue which makes it harder to pay for server hosting costs and development time as a result.

Forge installer downloads: https://files.minecraftforge.net | Patreon: https://www.patreon.com/LexManos