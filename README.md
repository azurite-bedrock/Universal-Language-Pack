# Universal Language Pack

<div style="display: flex; align-items: center;">
  <a href="https://crowdin.com/project/universal-language-pack">
    <img src="https://badges.crowdin.net/universal-language-pack/localized.svg" alt="Localization Status">
  </a>
  <img src="https://img.shields.io/github/repo-size/azurite-bedrock/Universal-Language-Pack?label=Repo%20Size" alt="Repository Size">
  <a href="https://discord.gg/rPNcYYNN6p">
    <img src="https://badgen.net/discord/members/dAcghG992N?icon=discord" alt="Discord Community">
  </a>
</div>

Universal Language Pack is a Bedrock Resource Pack that expands language support by including numerous missing languages.

Join our **[Crowdin Project](https://crowdin.com/project/universal-language-pack)** or **[Discord](https://discord.gg/rPNcYYNN6p)** to help refine current translations and contribute new ones!

<picture>
  <source media="(prefers-color-scheme: dark)"
          srcset="https://raw.githubusercontent.com/azurite-bedrock/Universal-Language-Pack/main/assets/banner-dark.png">
  <img src="https://raw.githubusercontent.com/azurite-bedrock/Universal-Language-Pack/main/assets/banner-light.png"
       alt="Universal Language Pack, translation progress banner"
       width="100%">
</picture>

## Our Goal

We want to add numerous missing languages to Minecraft Bedrock, using the help of our community!

## Local Setup Guide

To build and run the Universal Language Pack from scratch, follow these steps:

1. **Install Dependencies**
    - [Regolith](https://github.com/Bedrock-OSS/regolith) – a build tool for Minecraft Bedrock packs/addons.
    - [Deno](https://deno.com/) – a runtime used by some Regolith filters.

2. **Clone the Repository**

    ```bash
    git clone https://github.com/azurite-bedrock/Universal-Language-Pack.git
    cd Universal-Language-Pack
    ```

3. **Install Regolith Plugins**

    ```bash
    regolith install-all
    ```

4. **Build the Pack**
    - To run a one-time build:
        ```bash
        regolith run
        ```
    - Or to watch for changes and rebuild automatically:
        ```bash
        regolith watch
        ```

5. **Export a Pack File**
   To generate the final `.mcpack` file:

    ```bash
    regolith run pack
    ```

## Licensing

Starting with **version 0.4.0**, this project uses a split-license model:

- **Translations, language data, and other content output** are licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](LICENSES/CC-BY-NC-SA-4.0.txt).
- **Code, scripts, and tooling** are licensed under the [GNU General Public License v3.0 or later](LICENSES/GPL-3.0-or-later.txt).

The full license texts are in the [`LICENSES/`](LICENSES/) directory.

### Which License Applies to What?

| Component                                                           | License                          |
| ------------------------------------------------------------------- | -------------------------------- |
| Build scripts, generators, automation                               | `GPL-3.0-or-later`               |
| Source code in this repository                                      | `GPL-3.0-or-later`               |
| Translation files (`.lang`, JSON resources, exported language data) | `CC-BY-NC-SA-4.0`                |
| Documentation, README content                                       | `CC-BY-NC-SA-4.0`                |
| Project name, logo, branding                                        | See [TRADEMARK.md](TRADEMARK.md) |

### Historical Licensing (Versions Before 0.4.0)

Releases prior to version 0.4.0 were distributed under the **MIT License**. Those releases remain available under MIT in perpetuity.
Relicensing is forward-looking and does not affect previously released versions. See [NOTICE.md](NOTICE.md) for full details on the relicensing transition.

### Trademark

The names "Azurite," "Universal Language Pack," and associated logos are **not** covered by the licenses above. See [TRADEMARK.md](TRADEMARK.md) for the trademark policy.

"Minecraft" is a trademark of Mojang Synergies AB / Microsoft Corporation. This project is not affiliated with, endorsed by, or sponsored by Mojang or Microsoft.

### Contributing

By contributing on or after version 0.4.0, you agree to the licensing terms described in [CONTRIBUTING.md](CONTRIBUTING.md).
