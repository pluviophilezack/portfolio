import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import axios from "axios";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID_BLOG || process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.error("❌ 錯誤：請在 .env 檔案中設定 NOTION_TOKEN 與 NOTION_DATABASE_ID_BLOG");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

// 目標路徑
const BLOGS_DIR = path.resolve("src/data/blogs");
const IMAGES_DIR = path.resolve("public/images");
const CONVERT_SCRIPT = path.resolve("tools/convert_to_webp");

fs.mkdirSync(BLOGS_DIR, { recursive: true });
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

// 下載文章內嵌圖片
async function downloadInlineImage(url, filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const success = await downloadFile(url, filePath);
  return success;
}

// 自訂 notion-to-md 處理文章內嵌圖片：下載至本地 public/images
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
      return property.title.map((t) => t.plain_text).join("") || "";
    case "rich_text":
      return property.rich_text.map((t) => t.plain_text).join("") || "";
    case "select":
      return property.select?.name || "";
    case "status":
      return property.status?.name || "";
    case "date":
      return property.date?.start || "";
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

// 讀取 Frontmatter 裡的 title（方便顯示於摘要日誌）
function getTitleFromMd(content) {
  const match = content.match(/^title:\s*(.+)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "未命名文章";
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

// 刪除本地由 sync 建立的文章及其關聯圖片
function deleteSyncedPost(mdFilePath, slug, content) {
  // 1. 刪除 .md
  try {
    if (fs.existsSync(mdFilePath)) {
      fs.unlinkSync(mdFilePath);
    }
  } catch (err) {
    console.warn(`   - 刪除文章失敗：`, err.message);
  }

  // 2. 刪除同名封面圖
  const coverExtensions = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
  for (const ext of coverExtensions) {
    const coverPath = path.join(BLOGS_DIR, `${slug}${ext}`);
    if (fs.existsSync(coverPath)) {
      try {
        fs.unlinkSync(coverPath);
      } catch (err) {
        console.warn(`   - 刪除封面失敗：`, err.message);
      }
    }
  }

  // 3. 刪除該文章中引用到的內嵌 notion 圖片
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
  console.log("🚀 正在連接 Notion 資料庫並獲取文章...\n");

  let queryResult;
  try {
    queryResult = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
    });
  } catch (error) {
    console.error("❌ 讀取 Notion 資料庫失敗：", error.message);
    console.error("👉 請檢查：");
    console.error("1. NOTION_TOKEN 與 NOTION_DATABASE_ID_BLOG 是否正確");
    console.error("2. 該 Database 是否已加入連線授權");
    process.exit(1);
  }

  const pages = queryResult.results;

  // 統計追蹤變數
  const addedPosts = [];    // 新增文章清單
  const hiddenPosts = [];   // 隱藏文章清單（改為非 Publish）
  const deletedPosts = [];  // 刪除文章清單（資料庫不再有該 entry）
  const updatedPosts = [];  // 更新文章清單

  // 1. 檢視本地現存的文章，過濾出「經由 sync 建立」（帶有 notion_id）的檔案
  const localBlogFiles = fs.readdirSync(BLOGS_DIR).filter((f) => f.endsWith(".md"));
  const localSyncedPosts = new Map(); // notion_id -> { filePath, slug, content, title }

  for (const file of localBlogFiles) {
    const filePath = path.join(BLOGS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const notionId = getNotionIdFromMd(content);
    if (notionId) {
      const slug = file.replace(/\.md$/, "");
      const title = getTitleFromMd(content);
      localSyncedPosts.set(notionId, { filePath, slug, content, title });
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

  // 2. 處理需要刪除或隱藏的文章
  for (const [notionId, postInfo] of localSyncedPosts.entries()) {
    if (!allNotionPageIds.has(notionId)) {
      // 在 Notion 資料庫中已找不到該 entry -> 刪除
      deletedPosts.push({ title: postInfo.title, slug: postInfo.slug });
      deleteSyncedPost(postInfo.filePath, postInfo.slug, postInfo.content);
    } else if (!publishedNotionIds.has(notionId)) {
      // 在 Notion 仍存在，但狀態非 Publish -> 隱藏
      hiddenPosts.push({ title: postInfo.title, slug: postInfo.slug });
      deleteSyncedPost(postInfo.filePath, postInfo.slug, postInfo.content);
    }
  }

  // 3. 處理 Notion 資料庫中 status === "Publish" 的文章
  for (const page of pages) {
    const notionId = page.id.replace(/-/g, "");
    if (!publishedNotionIds.has(notionId)) {
      continue;
    }

    const props = page.properties;
    const titleKey = Object.keys(props).find((k) => props[k].type === "title") || "Name";
    const title = extractPlainText(props[titleKey]) || "未命名文章";

    const slugVal = extractPlainText(props["Slug"]) || extractPlainText(props["slug"]);
    const slug = slugVal || notionId;

    const dateVal =
      extractPlainText(props["Date"]) ||
      extractPlainText(props["date"]) ||
      page.created_time.split("T")[0];
    const category = extractPlainText(props["Category"]) || extractPlainText(props["category"]) || extractPlainText(props["分類"]) || "";
    const summary = extractPlainText(props["Summary"]) || extractPlainText(props["summary"]) || extractPlainText(props["摘要"]) || "";

    const isNew = !localSyncedPosts.has(notionId);
    if (isNew) {
      addedPosts.push({ title, slug });
      console.log(`➕ 新增文章：${title} (${slug})`);
    } else {
      updatedPosts.push({ title, slug });
      console.log(`🔄 更新文章：${title} (${slug})`);
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
      const coverTarget = path.join(BLOGS_DIR, `${slug}${ext}`);
      await downloadFile(coverUrl, coverTarget);
    }

    // 轉換 Markdown
    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdStringObj = n2m.toMarkdownString(mdBlocks);
    const mdString = (typeof mdStringObj === "string" ? mdStringObj : mdStringObj?.parent) || "";

    const formattedSummary = summary
      ? summary.includes("\n") || summary.includes(":")
        ? JSON.stringify(summary)
        : summary
      : "";

    const frontmatter = [
      "---",
      `title: ${title}`,
      `date: ${dateVal}`,
      category ? `category: ${category}` : null,
      `summary: ${formattedSummary}`,
      `notion_id: ${notionId}`,
      "---",
      "",
    ]
      .filter((line) => line !== null)
      .join("\n");

    const fullContent = `${frontmatter}${mdString ? mdString + "\n" : ""}`;

    // 如果原先舊檔檔名不同，先清理舊檔
    if (localSyncedPosts.has(notionId)) {
      const oldPost = localSyncedPosts.get(notionId);
      if (oldPost.slug !== slug) {
        deleteSyncedPost(oldPost.filePath, oldPost.slug, oldPost.content);
      }
    }

    const targetMdPath = path.join(BLOGS_DIR, `${slug}.md`);
    fs.writeFileSync(targetMdPath, fullContent, "utf-8");
  }

  // 4. 執行 convert_to_webp 轉換圖片
  if (fs.existsSync(CONVERT_SCRIPT)) {
    console.log("\n🖼️  正在執行 convert_to_webp 轉檔封面與圖片...");
    try {
      execSync(`"${CONVERT_SCRIPT}"`, { stdio: "inherit" });
    } catch (err) {
      console.warn("⚠️ 執行 convert_to_webp 時發生警告或錯誤：", err.message);
    }
  }

  // 5. 印出詳細統整摘要報告
  console.log("\n==================== 📊 同步結果摘要 ====================");

  // 隱藏文章
  console.log(`\n🙈 隱藏文章（改為非 Publish）共 ${hiddenPosts.length} 篇：`);
  if (hiddenPosts.length === 0) {
    console.log("   (無)");
  } else {
    hiddenPosts.forEach((p, idx) => console.log(`   ${idx + 1}. ${p.title} (${p.slug})`));
  }

  // 刪除文章
  console.log(`\n🗑️  刪除文章（Notion 已無該 entry）共 ${deletedPosts.length} 篇：`);
  if (deletedPosts.length === 0) {
    console.log("   (無)");
  } else {
    deletedPosts.forEach((p, idx) => console.log(`   ${idx + 1}. ${p.title} (${p.slug})`));
  }

  // 本次發布的新文章
  console.log(`\n✨ 本次發布的新文章共 ${addedPosts.length} 篇：`);
  if (addedPosts.length === 0) {
    console.log("   (無)");
  } else {
    addedPosts.forEach((p, idx) => console.log(`   ${idx + 1}. ${p.title} (${p.slug})`));
  }

  // 目前已發布總數
  console.log(`\n📌 目前本地維持已發布文章共 ${publishedNotionIds.size} 篇`);
  console.log("========================================================\n");
}

sync();
