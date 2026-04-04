import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const githubAssetInfo = [
  {
    saveTo: "wine.json",
    repo: "NelloKudo/spritz-wine-aur",
  },
  {
    saveTo: "dxvk.json",
    repo: "doitsujin/dxvk",
  },
  {
    saveTo: "vkd3d.json",
    repo: "HansKristian-Work/vkd3d-proton",
  },
];

/**
 * @param {*} response api response json
 * @returns index to the first gzip/xz/zdtd archive
 */
const findArchiveIndex = (response) => {
  for (let i = 0; i < response.assets.length; i++) {
    const contentType = response.assets[i].content_type;

    if (["gzip", "zstd", "x-xz"].includes(contentType.split("/")[1])) {
      return i;
    }
  }
};

/**
 * @param {string} url URL pointing to a file
 */
const calculateHashFromURL = async (url) => {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((res) => {
        res
          .arrayBuffer()
          .then((ab) => {
            const fileUint = new Uint8Array(ab);
            const hash = createHash("sha256");
            hash.update(fileUint);

            resolve(hash.digest("hex"));
          })
          .catch((e) => {
            reject(e);
          });
      })
      .catch((e) => {
        reject(e);
      });
  });
};

const updateJson = (tag, downloadURL, digest, file) => {
  const newContent = {
    tag: tag,
    download_url: downloadURL,
    hash: digest,
  };
  const path = join("components", file);
  const contents = JSON.parse(readFileSync(path));

  if (JSON.stringify(contents[0]) !== JSON.stringify(newContent)) {
    contents.unshift(newContent);
    writeFileSync(path, JSON.stringify(contents, null, 2));
  } else console.log(`${file} does not need to be updated, skipping`);
};

(async () => {
  // Github (Wine, Dxvk, Vkd3d)
  await Promise.all(
    githubAssetInfo.map(async (item) => {
      const response = await (
        await fetch(`https://api.github.com/repos/${item.repo}/releases/latest`)
      ).json();

      const tag = response.tag_name;
      const index = findArchiveIndex(response);
      const url = response.assets[index].browser_download_url;
      const digest = response.assets[index].digest.split("sha256:")[1];

      updateJson(tag, url, digest, item.saveTo);
    }),
  );

  // Jadeite done seperately because codeberg's api stinks and also doesn't have any sha256 digest that I can take from.
  // also no way to verify the content type of assets
  const jadeiteResponse = await (
    await fetch(
      "https://codeberg.org/api/v1/repos/mkrsym1/jadeite/releases/latest",
    )
  ).json();

  const tag = jadeiteResponse.tag_name;
  const downloadURL = jadeiteResponse.assets[0].browser_download_url;
  const digest = await calculateHashFromURL(downloadURL);

  updateJson(tag, downloadURL, digest, "jadeite.json");
})();
