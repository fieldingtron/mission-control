import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../../data/links.db');
const db = new DatabaseSync(dbPath);

const PANEL_ID = 3; // "NEWS" panel

const data = [
  {
    category: "AI Research & Models",
    links: [
      { name: "OpenAI", url: "https://openai.com", description: "Creators of GPT-4 and ChatGPT" },
      { name: "Anthropic", url: "https://anthropic.com", description: "AI safety and research company, creators of Claude" },
      { name: "Mistral AI", url: "https://mistral.ai", description: "Frontier AI models for everyone" },
      { name: "Hugging Face", url: "https://huggingface.co", description: "The platform where the machine learning community builds the future" },
      { name: "DeepMind", url: "https://deepmind.google", description: "Google's leading AI research lab" }
    ]
  },
  {
    category: "AI Tools & Productivity",
    links: [
      { name: "Perplexity AI", url: "https://perplexity.ai", description: "AI-powered search engine" },
      { name: "ChatGPT", url: "https://chatgpt.com", description: "Conversational AI by OpenAI" },
      { name: "Claude", url: "https://claude.ai", description: "Conversational AI by Anthropic" },
      { name: "Notion AI", url: "https://notion.so", description: "AI tools integrated into Notion" },
      { name: "Otter.ai", url: "https://otter.ai", description: "AI-powered meeting transcription" }
    ]
  },
  {
    category: "AI Ethics & News",
    links: [
      { name: "AI Index", url: "https://aiindex.stanford.edu", description: "Comprehensive data and analysis on AI" },
      { name: "Alignment Forum", url: "https://alignmentforum.org", description: "Discussion of AI alignment research" },
      { name: "Wired AI", url: "https://wired.com/category/ai", description: "AI coverage by Wired" },
      { name: "MIT Technology Review AI", url: "https://technologyreview.com/topic/artificial-intelligence", description: "AI coverage by MIT Technology Review" },
      { name: "The Verge AI", url: "https://theverge.com/ai-artificial-intelligence", description: "AI coverage by The Verge" }
    ]
  },
  {
    category: "AI Coding Assistants",
    links: [
      { name: "GitHub Copilot", url: "https://github.com/features/copilot", description: "The world's most widely adopted AI developer tool" },
      { name: "Cursor", url: "https://cursor.com", description: "The AI Code Editor" },
      { name: "Tabnine", url: "https://tabnine.com", description: "AI assistant for software developers" },
      { name: "Sourcegraph Cody", url: "https://sourcegraph.com/cody", description: "AI that knows your codebase" },
      { name: "Replit Ghostwriter", url: "https://replit.com/ai", description: "AI-powered software development on Replit" }
    ]
  },
  {
    category: "LLM Frameworks",
    links: [
      { name: "LangChain", url: "https://langchain.com", description: "Framework for developing LLM applications" },
      { name: "LlamaIndex", url: "https://llamaindex.ai", description: "Data framework for LLM applications" },
      { name: "AutoGPT", url: "https://autogpt.net", description: "Autonomous AI agents framework" },
      { name: "BabyAGI", url: "https://babyagi.org", description: "AI-powered task management system" },
      { name: "CrewAI", url: "https://crew.ai", description: "Framework for orchestrating role-playing, autonomous AI agents" }
    ]
  },
  {
    category: "AI Creative & Image Generation",
    links: [
      { name: "Midjourney", url: "https://midjourney.com", description: "Generative AI for high-quality images" },
      { name: "Stable Diffusion", url: "https://stability.ai", description: "Open source image generation" },
      { name: "Leonardo.ai", url: "https://leonardo.ai", description: "Generative AI for creative projects" },
      { name: "Adobe Firefly", url: "https://adobe.com/products/firefly.html", description: "Adobe's creative generative AI" },
      { name: "RunwayML", url: "https://runwayml.com", description: "AI-powered creative tools for video and more" }
    ]
  },
  {
    category: "AI Newsletters",
    links: [
      { name: "The Rundown AI", url: "https://therundown.ai", description: "Daily AI news and tools" },
      { name: "TLDR AI", url: "https://tldr.tech/ai", description: "Daily summary of AI news" },
      { name: "Ben's Bites", url: "https://bensbites.beehiiv.com", description: "Daily AI digest" },
      { name: "Superhuman", url: "https://superhuman.ai", description: "AI tools and news" },
      { name: "Prompt Engineering Daily", url: "https://promptengineering.daily", description: "Daily updates on prompt engineering" }
    ]
  },
  {
    category: "Developer Tools",
    links: [
      { name: "Vercel", url: "https://vercel.com", description: "Platform for frontend developers" },
      { name: "Supabase", url: "https://supabase.com", description: "Open source Firebase alternative" },
      { name: "Turso", url: "https://turso.tech", description: "The edge database based on libSQL" },
      { name: "Railway", url: "https://railway.app", description: "Infrastructure platform for apps" },
      { name: "Clerk", url: "https://clerk.com", description: "Authentication and user management" }
    ]
  },
  {
    category: "Cloud Computing",
    links: [
      { name: "AWS", url: "https://aws.amazon.com", description: "Amazon Web Services" },
      { name: "Google Cloud", url: "https://cloud.google.com", description: "Google Cloud Platform" },
      { name: "Microsoft Azure", url: "https://azure.microsoft.com", description: "Microsoft's cloud computing platform" },
      { name: "DigitalOcean", url: "https://digitalocean.com", description: "Cloud platform for developers" },
      { name: "Linode", url: "https://linode.com", description: "Cloud computing services" }
    ]
  },
  {
    category: "Tech News & Blogs",
    links: [
      { name: "TechCrunch", url: "https://techcrunch.com", description: "Startup and technology news" },
      { name: "Hacker News", url: "https://news.ycombinator.com", description: "Tech social news" },
      { name: "Ars Technica", url: "https://arstechnica.com", description: "IT and technology news" },
      { name: "Engadget", url: "https://engadget.com", description: "Consumer electronics news" },
      { name: "Slashdot", url: "https://slashdot.org", description: "News for Nerds" }
    ]
  }
];

function addAICollection() {
  console.log('Adding AI Collection to Panel 3...');
  
  db.exec('BEGIN');
  try {
    for (const item of data) {
      // Add category
      const maxCatPosRow = db.prepare('SELECT MAX(position) as max FROM categories WHERE panel_id = ?').get(PANEL_ID) as any;
      const catPosition = (maxCatPosRow?.max ?? 0) + 1;
      
      const catResult = db.prepare('INSERT INTO categories (name, panel_id, position) VALUES (?, ?, ?)').run(item.category, PANEL_ID, catPosition);
      const categoryId = catResult.lastInsertRowid;
      
      console.log(`Added category: ${item.category} (ID: ${categoryId})`);
      
      // Add links
      for (let i = 0; i < item.links.length; i++) {
        const link = item.links[i];
        const linkPosition = i + 1;
        db.prepare('INSERT INTO links (category_id, name, url, position, description) VALUES (?, ?, ?, ?, ?)')
          .run(categoryId, link.name, link.url, linkPosition, link.description);
      }
      console.log(`  Added ${item.links.length} links`);
    }
    
    db.exec('COMMIT');
    console.log('Successfully added all categories and links!');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Error adding AI collection:', error);
  }
}

addAICollection();
