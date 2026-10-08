import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import axios from "axios";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;

// 決定同步目標 (blogs 或 projects)
const syncTypeArg = (process.argv[2] || "").toLowerCase();

if (!syncTypeArg || (syncTypeArg !== "blogs" && syncTypeArg !== "blog" && syncTypeArg !== "projects" && syncTypeArg !== "project")) {
  console.log("ℹ️  請指定要同步的類別：");
  console.log("   👉 同步隨筆：npm run sync blogs");
  console.log("   👉 同步專案：npm run sync projects\n");
  process.exit(1);
}

const isProjectSync = syncTypeArg === "projects" || syncTypeArg === "project";

const NOTION_DATABASE_ID = isProjectSync
  ? process.env.NOTION_DATABASE_ID_PROJECT || process.env.NOTION_DATABASE_ID_PROJECTS
  : process.env.NOTION_DATABASE_ID_BLOG || process.env.NOTION_DATABASE_ID;

const targetEnvKey = isProjectSync ? "NOTION_DATABASE_ID_PROJECT" : "NOTION_DATABASE_ID_BLOG";

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.error(`❌ 錯誤：請在 .env 檔案中設定 NOTION_TOKEN 與 ${targetEnvKey}`);
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

// 目標路徑
const TARGET_DIR = isProjectSync
  ? path.resolve("src/data/projects")
  : path.resolve("src/data/blogs");
const IMAGES_DIR = path.resolve("public/images");
const CONVERT_SCRIPT = path.resolve("tools/convert_to_webp");

fs.mkdirSync(TARGET_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// 下載檔案工具函式
async function downloadFile(url, targetPath) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 15000,
    });
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(targetPath);
      response.data.pipe(writer);
      writer.on("finish", () => resolve(true));
      writer.on("error", reject);
    });
  } catch (err) {
    console.warn(`⚠️ 下載檔案失敗 (${path.basename(targetPath)}):`, err.message);
    return false;
  }
}

// 下載文章/專案內嵌圖片
async function downloadInlineImage(url, filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const success = await downloadFile(url, filePath);
  return success;
}

// 自訂 notion-to-md 處理內嵌圖片：下載至本地 public/images
n2m.setCustomTransformer("image", async (block) => {
  const { image } = block;
  const rawUrl = image.type === "external" ? image.external.url : image.file.url;
  let ext = ".png";
  try {
    const parsedExt = path.extname(new URL(rawUrl).pathname);
    if (parsedExt && parsedExt.length <= 5) ext = parsedExt;
  } catch {
    // 忽略解析錯誤
  }
  const filename = `notion-${block.id}${ext}`;
  await downloadInlineImage(rawUrl, filename);
  return `![image](/images/notion-${block.id}.webp)`;
});

// 提取屬性值的輔助函式
function extractPlainText(property) {
  if (!property) return "";
  switch (property.type) {
    case "title":
      return property.title?.map((t) => t.plain_text).join("") || "";
    case "rich_text":
      return property.rich_text?.map((t) => t.plain_text).join("") || "";
    case "select":
      return property.select?.name || "";
    case "status":
      return property.status?.name || "";
    case "date":
      return property.date?.start || "";
    case "url":
      return property.url || "";
    default:
      return "";
  }
}

// 提取封面圖片 URL (支援 files 屬性)
function extractCoverUrl(property) {
  if (!property || property.type !== "files" || !property.files || property.files.length === 0) {
    return null;
  }
  const fileObj = property.files[0];
  if (fileObj.type === "file") {
    return fileObj.file?.url || null;
  } else if (fileObj.type === "external") {
    return fileObj.external?.url || null;
  }
  return null;
}

// 從本地 Markdown 檔案中讀取 notion_id
function getNotionIdFromMd(content) {
  const match = content.match(/^notion_id:\s*(["']?)([a-zA-Z0-9_-]+)\1/m);
  return match ? match[2] : null;
}

// 從本地 Markdown 檔案中讀取 last_edited_time
function getLastEditedTimeFromMd(content) {
  const match = content.match(/^last_edited_time:\s*(["']?)(.+?)\1\s*$/m);
  return match ? match[2].trim() : null;
}

// 讀取 Frontmatter 裡的 title（方便顯示於摘要日誌）
function getTitleFromMd(content) {
  const match = content.match(/^title:\s*(.+)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "未命名";
}

// 找出 markdown 內文引用到的 /images/ 檔案
function getReferencedImages(content) {
  const regex = /\/images\/(notion-[a-zA-Z0-9_.-]+)/g;
  const images = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    images.push(match[1]);
  }
  return images;
}

// 刪除本地由 sync 建立的項目及其關聯圖片
function deleteSyncedItem(mdFilePath, slug, content) {
  // 1. 刪除 .md
  try {
    if (fs.existsSync(mdFilePath)) {
      fs.unlinkSync(mdFilePath);
    }
  } catch (err) {
    console.warn(`   - 刪除項目失敗：`, err.message);
  }

  // 2. 刪除同名封面圖
  const coverExtensions = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
  for (const ext of coverExtensions) {
    const coverPath = path.join(TARGET_DIR, `${slug}${ext}`);
    if (fs.existsSync(coverPath)) {
      try {
        fs.unlinkSync(coverPath);
      } catch (err) {
        console.warn(`   - 刪除封面失敗：`, err.message);
      }
    }
  }

  // 3. 刪除該項目中引用到的內嵌 notion 圖片
  const inlineImages = getReferencedImages(content);
  for (const imgName of inlineImages) {
    const baseName = imgName.replace(/\.[^.]+$/, "");
    const possibleFiles = fs
      .readdirSync(IMAGES_DIR)
      .filter((f) => f.startsWith(baseName));
    for (const f of possibleFiles) {
      const fullImgPath = path.join(IMAGES_DIR, f);
      try {
        fs.unlinkSync(fullImgPath);
      } catch (err) {
        console.warn(`   - 刪除內嵌圖失敗：`, err.message);
      }
    }
  }
}

async function sync() {
  const entityTypeName = isProjectSync ? "專案" : "隨筆文章";
  console.log(`🚀 正在連接 Notion 資料庫並獲取${entityTypeName}...\n`);

  const pages = [];
  let cursor = undefined;

  try {
    do {
      const response = await notion.databases.query({
        database_id: NOTION_DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      pages.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error(`❌ 讀取 Notion 資料庫失敗：`, error.message);
    console.error("👉 請檢查：");
    console.error(`1. NOTION_TOKEN 與 ${targetEnvKey} 是否正確`);
    console.error("2. 該 Database 是否已加入連線授權");
    process.exit(1);
  }

  // 統計追蹤變數
  const addedItems = [];    // 新增項目清單
  const hiddenItems = [];   // 隱藏項目清單（改為非 Publish）
  const deletedItems = [];  // 刪除項目清單（資料庫不再有該 entry）
  const updatedItems = [];  // 更新項目清單
  const skippedItems = [];  // 無變更跳過清單（增量比對）

  // 1. 檢視本地現存的 Markdown 檔案，過濾出「經由 sync 建立」（帶有 notion_id）的檔案
  const localFiles = fs.readdirSync(TARGET_DIR).filter((f) => f.endsWith(".md"));
  const localSyncedItems = new Map(); // notion_id -> { filePath, slug, content, title, lastEditedTime }

  for (const file of localFiles) {
    const filePath = path.join(TARGET_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const notionId = getNotionIdFromMd(content);
    if (notionId) {
      const slug = file.replace(/\.md$/, "");
      const title = getTitleFromMd(content);
      const lastEditedTime = getLastEditedTimeFromMd(content);
      localSyncedItems.set(notionId, { filePath, slug, content, title, lastEditedTime });
    }
  }

  // 建立 Notion 資料庫中所有頁面的 Set（不論狀態）
  const allNotionPageIds = new Set();
  const publishedNotionIds = new Set();

  for (const page of pages) {
    const notionId = page.id.replace(/-/g, "");
    allNotionPageIds.add(notionId);

    const props = page.properties;
    const statusVal = (
      extractPlainText(props["Status"]) ||
      extractPlainText(props["status"]) ||
      extractPlainText(props["狀態"])
    ).trim();

    if (statusVal.toLowerCase() === "publish") {
      publishedNotionIds.add(notionId);
    }
  }

  // 2. 處理需要刪除或隱藏的項目
  for (const [notionId, itemInfo] of localSyncedItems.entries()) {
    if (!allNotionPageIds.has(notionId)) {
      deletedItems.push({ title: itemInfo.title, slug: itemInfo.slug });
      deleteSyncedItem(itemInfo.filePath, itemInfo.slug, itemInfo.content);
    } else if (!publishedNotionIds.has(notionId)) {
      hiddenItems.push({ title: itemInfo.title, slug: itemInfo.slug });
      deleteSyncedItem(itemInfo.filePath, itemInfo.slug, itemInfo.content);
    }
  }

  // 3. 處理 Notion 資料庫中 status === "Publish" 的項目
  for (const page of pages) {
    const notionId = page.id.replace(/-/g, "");
    if (!publishedNotionIds.has(notionId)) {
      continue;
    }

    const props = page.properties;
    const titleKey = Object.keys(props).find((k) => props[k].type === "title") || "Name";
    const title = extractPlainText(props[titleKey]) || `未命名${entityTypeName}`;

    const slugVal = extractPlainText(props["Slug"]) || extractPlainText(props["slug"]);
    const slug = slugVal || notionId;

    const isNew = !localSyncedItems.has(notionId);
    const localItem = localSyncedItems.get(notionId);

    // 增量比對：若本地存在且 last_edited_time 完全一致，直接跳過下載與轉檔
    if (!isNew && localItem?.lastEditedTime && localItem.lastEditedTime === page.last_edited_time) {
      skippedItems.push({ title, slug });
      console.log(`⏩ 略過（無更動）：${title} (${slug})`);
      continue;
    }

    const dateVal =
      extractPlainText(props["Date"]) ||
      extractPlainText(props["date"]) ||
      page.created_time.split("T")[0];
    const category =
      extractPlainText(props["Category"]) ||
      extractPlainText(props["category"]) ||
      extractPlainText(props["分類"]) ||
      "";

    if (isNew) {
      addedItems.push({ title, slug });
      console.log(`➕ 新增${entityTypeName}：${title} (${slug})`);
    } else {
      updatedItems.push({ title, slug });
      console.log(`🔄 更新${entityTypeName}：${title} (${slug})`);
    }

    // 處理 cover
    const coverProp = props["Cover"] || props["cover"] || props["封面"];
    const coverUrl = extractCoverUrl(coverProp);

    if (coverUrl) {
      let ext = ".png";
      try {
        const parsedExt = path.extname(new URL(coverUrl).pathname);
        if (parsedExt && parsedExt.length <= 5) ext = parsedExt;
      } catch {
        // 預設 .png
      }
      const coverTarget = path.join(TARGET_DIR, `${slug}${ext}`);
      await downloadFile(coverUrl, coverTarget);
    }

    // 轉換 Markdown
    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdStringObj = n2m.toMarkdownString(mdBlocks);
    const mdString = (typeof mdStringObj === "string" ? mdStringObj : mdStringObj?.parent) || "";

    // 依據類別組裝 Frontmatter
    let frontmatterLines = [];

    if (isProjectSync) {
      // 專案屬性：title, slug, date, category, cover, description, external_link, link_describe
      const description =
        extractPlainText(props["Description"]) ||
        extractPlainText(props["description"]) ||
        extractPlainText(props["Summary"]) ||
        extractPlainText(props["summary"]) ||
        extractPlainText(props["摘要"]) ||
        "";
      const externalLink =
        extractPlainText(props["External_link"]) ||
        extractPlainText(props["external_link"]) ||
        extractPlainText(props["External_Link"]) ||
        extractPlainText(props["External_url"]) ||
        extractPlainText(props["external_url"]) ||
        extractPlainText(props["externalUrl"]) ||
        "";
      const linkDescribe =
        extractPlainText(props["Link_describe"]) ||
        extractPlainText(props["link_describe"]) ||
        extractPlainText(props["Link_Describe"]) ||
        "";

      const formattedDesc = description
        ? description.includes("\n") || description.includes(":")
          ? JSON.stringify(description)
          : description
        : "";

      frontmatterLines = [
        "---",
        `title: ${title}`,
        `date: ${dateVal}`,
        category ? `category: ${category}` : null,
        formattedDesc ? `description: ${formattedDesc}` : null,
        externalLink ? `external_link: ${externalLink}` : null,
        linkDescribe ? `link_describe: ${linkDescribe}` : null,
        `notion_id: ${notionId}`,
        `last_edited_time: "${page.last_edited_time}"`,
        "---",
        "",
      ];
    } else {
      // 隨筆文章屬性：title, date, category, summary
      const summary =
        extractPlainText(props["Summary"]) ||
        extractPlainText(props["summary"]) ||
        extractPlainText(props["摘要"]) ||
        "";

      const formattedSummary = summary
        ? summary.includes("\n") || summary.includes(":")
          ? JSON.stringify(summary)
          : summary
        : "";

      frontmatterLines = [
        "---",
        `title: ${title}`,
        `date: ${dateVal}`,
        category ? `category: ${category}` : null,
        formattedSummary ? `summary: ${formattedSummary}` : null,
        `notion_id: ${notionId}`,
        `last_edited_time: "${page.last_edited_time}"`,
        "---",
        "",
      ];
    }

    const frontmatter = frontmatterLines
      .filter((line) => line !== null)
      .join("\n");

    const fullContent = `${frontmatter}${mdString ? mdString + "\n" : ""}`;

    // 如果原先舊檔檔名不同，先清理舊檔
    if (localSyncedItems.has(notionId)) {
      const oldItem = localSyncedItems.get(notionId);
      if (oldItem.slug !== slug) {
        deleteSyncedItem(oldItem.filePath, oldItem.slug, oldItem.content);
      }
    }

    const targetMdPath = path.join(TARGET_DIR, `${slug}.md`);
    fs.writeFileSync(targetMdPath, fullContent, "utf-8");
  }

  // 4. 執行 convert_to_webp 轉換圖片（若本次有新增或更新項目才執行）
  if (fs.existsSync(CONVERT_SCRIPT) && (addedItems.length > 0 || updatedItems.length > 0)) {
    console.log("\n🖼️  正在執行 convert_to_webp 轉檔封面與圖片...");
    try {
      execSync(`"${CONVERT_SCRIPT}"`, { stdio: "inherit" });
    } catch (err) {
      console.warn("⚠️ 執行 convert_to_webp 時發生警告或錯誤：", err.message);
    }
  }

  // 5. 印出詳細統整摘要報告
  console.log(`\n==================== 📊 ${entityTypeName}同步結果摘要 ====================`);

  // 略過未變更
  console.log(`\n⏩ 略過（無變更）共 ${skippedItems.length} 項`);

  // 隱藏項目
  console.log(`\n🙈 隱藏項目（改為非 Publish）共 ${hiddenItems.length} 項：`);
  if (hiddenItems.length === 0) {
    console.log("   (無)");
  } else {
    hiddenItems.forEach((p, idx) => console.log(`   ${idx + 1}. ${p.title} (${p.slug})`));
  }

  // 刪除項目
  console.log(`\n🗑️  刪除項目（Notion 已無該 entry）共 ${deletedItems.length} 項：`);
  if (deletedItems.length === 0) {
    console.log("   (無)");
  } else {
    deletedItems.forEach((p, idx) => console.log(`   ${idx + 1}. ${p.title} (${p.slug})`));
  }

  // 本次發布的新項目
  console.log(`\n✨ 本次發布的新項目共 ${addedItems.length} 項：`);
  if (addedItems.length === 0) {
    console.log("   (無)");
  } else {
    addedItems.forEach((p, idx) => console.log(`   ${idx + 1}. ${p.title} (${p.slug})`));
  }

  // 本次更新的項目
  console.log(`\n🔄 本次更新的項目共 ${updatedItems.length} 項：`);
  if (updatedItems.length === 0) {
    console.log("   (無)");
  } else {
    updatedItems.forEach((p, idx) => console.log(`   ${idx + 1}. ${p.title} (${p.slug})`));
  }

  // 目前已發布總數
  console.log(`\n📌 目前本地維持已發布${entityTypeName}共 ${publishedNotionIds.size} 項`);
  console.log("========================================================\n");
}

sync();
