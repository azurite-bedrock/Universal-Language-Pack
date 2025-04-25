# Minecraft: Universal Language Pack

<div style="display: flex; align-items: center;">
  <a href="https://crowdin.com/project/universal-language-pack">
    <img src="https://badges.crowdin.net/universal-language-pack/localized.svg" alt="Localization Status">
  </a>
  <img src="https://img.shields.io/github/repo-size/azurite-bedrock/Universal-Language-Pack?label=Repo%20Size" alt="Repository Size">
  <a href="https://discord.gg/rPNcYYNN6p">
    <img src="https://img.shields.io/discord/1218673790775726182?label=Azurite&color=5f51ec" alt="Discord Community">
  </a>
</div>

Minecraft: Universal Language Pack is a Bedrock Resource Pack that expands language support by including numerous missing languages.
Join our Crowdin project to help refine current translations and contribute new ones!

## Features

- **More Languages:** Adds many missing languages to Minecraft Bedrock.
- **Community Contributions:** Anyone can help improve existing translations or add new ones.
- **Modern Tools:** Made with Regolith and Deno to make maintaining the project easier.

## Getting Started

1. **Installation:** Check out the [Setup Guide](#setup-guide) for installation instructions.
2. **Help Translate:** Join us on Crowdin to contribute translations.
3. **Join the Community:** Come hang out or ask questions on [Discord](https://discord.gg/rPNcYYNN6p).

## Setup Guide
To build and run the Universal Language Pack, follow these steps:

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
