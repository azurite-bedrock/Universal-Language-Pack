# Universal Language Pack

<div style="display: flex; align-items: center;">
<a href="https://crowdin.com/project/universal-language-pack"><img src="https://badges.crowdin.net/universal-language-pack/localized.svg" alt="Localization Status"></a>
<a href="https://github.com/azurite-bedrock/Universal-Language-Pack"><img src="https://img.shields.io/github/repo-size/azurite-bedrock/Universal-Language-Pack?label=Repo%20Size" alt="Repository Size"></a>
<a href="https://discord.gg/rPNcYYNN6p"><img src="https://badgen.net/discord/members/dAcghG992N?icon=discord" alt="Discord Community"></a>
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

We want to add numerous missing languages to Minecraft Bedrock, using the help of the Bedrock community!

## Local Setup Guide

1. **Install Dependencies**
    - [Regolith](https://github.com/Bedrock-OSS/regolith) (build tool for Minecraft Bedrock packs)
    - [Deno](https://deno.com/) (runtime used by our Regolith filters)

2. **Clone the Repository**

    ```bash
    git clone https://github.com/azurite-bedrock/Universal-Language-Pack.git
    cd Universal-Language-Pack
    ```

3. **Install Regolith Filters**

    ```bash
    regolith install-all
    ```

4. **Build the Pack**

    One-time build:

    ```bash
    regolith run dev
    ```

    Watch mode (rebuilds on file changes):

    ```bash
    regolith watch
    ```

5. **Export a `.mcpack` File**

    ```bash
    regolith run pack
    ```

## Licensing

This project uses a split-license model. See [NOTICE.md](NOTICE.md) for full details.

| Component                | License                                           |
| ------------------------ | ------------------------------------------------- |
| Translations and content | [CC-BY-NC-SA-4.0](LICENSES/CC-BY-NC-SA-4.0.txt)   |
| Code and tooling         | [GPL-3.0-or-later](LICENSES/GPL-3.0-or-later.txt) |

See [TRADEMARK.md](TRADEMARK.md) for the trademark policy. Trademark rights exist independently of, and are not granted by, either license.

By contributing you agree to the licensing terms described in [CONTRIBUTING.md](CONTRIBUTING.md).
