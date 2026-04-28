/**
 * Populate Case Studies Script
 * 
 * Creates document records with metadata, links PDFs, and generates embeddings.
 * Skips LlamaParse - uses predefined summaries instead.
 * 
 * Usage:
 *   npm run populate
 * 
 * Prerequisites:
 *   - PDFs already uploaded to Supabase Storage (run split:upload first)
 *   - OpenAI API key in .env.local
 *   - Database cleared (run DELETE queries first)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables. Check .env.local');
  process.exit(1);
}

if (!openaiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'case-study-pdfs';

// ============================================
// OPENAI EMBEDDING
// ============================================

async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.log(`   ⚠️ Retry ${attempt}/${retries}...`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Failed after retries');
}

// ============================================
// CASE STUDY DEFINITIONS
// ============================================
interface CaseStudyDef {
  page: number;
  client: string;
  title: string;
  summary: string;
  capabilities: string[];
  industries: string[];
  vimeoUrl?: string;
}

const CASE_STUDIES: CaseStudyDef[] = [
  // Source: AG Website RAG case studies.pdf (43 pages, 1 case study per page)
  {
    page: 1, client: "Renew Home", title: "Elevating a New Brand to Own the Market Conversation",
    summary: "As a newly-formed sustainable energy company, Renew Home was preparing for a major solution launch at Distributech. While still defining its core brand positioning, the company had an immediate need to develop their go-to-market story, CEO and Chief Product Officer's keynotes, and priority content assets. Article Group quickly defined their narrative and enhanced their brand design while simultaneously delivering critical, high-impact assets and executive-level storytelling. Solution included strategic narrative and messaging, executive keynote presentations, launch-ready content, product page copy and design, blog content, and visual and brand assets including early art direction guidelines and layered content templates.",
    capabilities: ["brand-strategy", "content-marketing", "creative-direction"], industries: ["technology"]
  },
  {
    page: 2, client: "Twitch", title: "Expanding a Vibrant Visual Universe",
    summary: "The Twitch Brand Partnership Studio team needed a versatile creative partner to help them deliver a high volume of assets while upleveling quality and new visual systems, extending the Twitch brand into a wide range of new content categories, including sports and adventure TV. Moving from project scopes to an always-on partnership, Article Group became a trusted extension of Twitch and Amazon Ads, expanding the brand into various genres, delivering high-quality creative work and adapting to different needs and workflows for Amazon Ads initiatives. Solution included ongoing creative support partnership model via retainer, Twitch Sports brand expression playbook, Twitch Expedition TV brand expression, and Amazon Upfronts Deck.",
    capabilities: ["creative-direction", "brand-strategy"], industries: ["media-entertainment"]
  },
  {
    page: 3, client: "AIG", title: "When Stakes Are High: Reintroducing AIG to the Market",
    summary: "For their first Investor Day in over a decade, global insurance giant AIG needed a creative partner to turn their complex strategic roadmap and financials into a compelling visual narrative that reinforced their transformation and built market confidence. Over a two-month sprint, Article Group worked side-by-side with AIG's C-suite and partners to create a keynote visual design system bringing clarity and visual intrigue to complex data and the story of performance, turnaround, and transformation. In the final week, the team embedded on-site in NYC to refine delivery, finalize hundreds of slides and key materials, and support live production. Solution included event and keynote visual direction and design guide, keynote presentation design including hundreds of slides, graphs, and charts, environmental and simulcast event branding and design, on-site keynote adjustments and delivery, and production solutioning and problem solving.",
    capabilities: ["creative-direction", "content-marketing"], industries: ["finance"]
  },
  {
    page: 4, client: "AWS", title: "Creating a New Kind of Product Demo",
    summary: "In fall 2024, AWS launched the new Amazon SageMaker: a unified interface for building, training, and deploying machine learning models. They needed a unified product demo that could clarify the platform's complexity and showcase a variety of different capabilities. The demo had to be intuitive for developers, flexible for marketing, and scalable across use cases. Article Group proposed an interactive, modular click-through experience that could live across AWS's ecosystem — from detailed product pages on the website to trade show booths and beyond. Solution included subject matter expert consultation, copywriting, design, and animation, the first ever interactive click-through demo featured on an AWS product page, and a templated approach used by other AWS product teams.",
    capabilities: ["creative-direction", "content-marketing"], industries: ["technology"]
  },
  {
    page: 5, client: "AWS", title: "Bringing Powerful Gen AI Models to Life",
    summary: "AWS needed bold, elegant videos to advertise their new generative AI models, Amazon Nova Canvas (text-to-image generation) and Amazon Nova Reel (text-to-video and image-to-video generation). These videos needed to appeal to creative professionals in the marketing, entertainment, and retail spaces. With a proven ability to creatively leverage AWS services, including generative AI models, Article Group was given the opportunity to showcase our design and animation chops. We used Amazon Nova Canvas and Amazon Nova Reel AI to generate footage for the videos, collaborating closely with AWS clients to craft prompts and messaging that effectively framed benefits for each target audience. Solution included a script with messaging addressing creative professionals' needs, storyboards partially made using imagery generated by AI models, animated beautiful branded design, and one of our promo videos was featured in TechCrunch and Yahoo.",
    capabilities: ["video-production", "creative-direction"], industries: ["technology"]
  },
  {
    page: 6, client: "Chrome Enterprise", title: "Turning a Security Upgrade into a Compelling Video",
    summary: "Chrome Enterprise launched a new paid, premium tier for enterprise users, offering advanced security features designed to meet modern cybersecurity demands. They needed a video that could clearly and concisely explain technical capabilities — like data loss prevention and deep malware scanning — in an engaging and accessible way. Article Group handled every aspect of the video — from concept and scriptwriting to storyboarding, casting (both human and canine actors), location scouting, UI animation, and editing. We even composed original music. The shoot was designed with modularity in mind: device screens were filmed blank so future feature updates could be integrated without requiring a reshoot. Solution included a polished video with high-production value and clear messaging tailored to ITDMs and security decision makers, and modular versions for LinkedIn and YouTube.",
    capabilities: ["video-production", "creative-direction"], industries: ["technology"]
  },
  {
    page: 7, client: "Chrome Enterprise", title: "Reclaiming the Browser Conversation",
    summary: "Chrome had long led the enterprise browser category, but in 2025, new features and ever-changing market dynamics meant it was time for a refresh. They needed to reassert Chrome's relevance with fresh, creative content tailored to enterprise buyers. Article Group reimagined campaign visuals and messaging to resonate with IT decision-makers, emphasizing AI, security, and manageability. We refreshed UI treatments and campaign assets to reflect enterprise needs, localized for EMEA, and scaled creative for rising demand on platforms like Reddit and LinkedIn. Solution included new campaign videos (:06, :15, :30) that drove measurable lift in awareness and engagement, a cohesive suite of animated and static banners built for performance, and helped Chrome sharpen its enterprise positioning while honoring a well-known platform narrative.",
    capabilities: ["brand-strategy", "creative-direction", "growth-marketing"], industries: ["technology"]
  },
  {
    page: 8, client: "J.P. Morgan", title: "Naming the Future of Retail Payments Hardware",
    summary: "J.P. Morgan faced a complex challenge when branding its new payments hardware terminals: Finding clear, concise names that would resonate with retail customers while standing out from competitors, aligning with existing product taxonomy, working well internationally, and describing functionality — including leaving room for future addition of innovations like biometric identification. Article Group partnered closely with the client team and their internal product design, marketing, and legal stakeholders to generate, assess, and test a wide range of name candidates for commercial appeal, strategic value, and marketplace availability. The names that hit the mark, Paypin and Paypad, were launched by the company at one of the world's largest retail expos. Solution included naming and nomenclature strategy, name generation, and availability assessments.",
    capabilities: ["brand-strategy"], industries: ["finance"]
  },
  {
    page: 9, client: "Chorus (Alphabet X)", title: "Creating an Eye-Opening Asset Visibility Brand",
    summary: "Chorus is on a mission to change the way goods are made, moved, and managed around the world. As a startup within Alphabet's X, The Moonshot Factory, the company was developing an industry-changing asset visibility platform, and they needed a brand and narrative that could match — and communicate — that revolutionary energy. AG developed a brand narrative rooted in the transformative idea of \"orchestration,\" which shaped key messaging and the brief for the Chorus visual identity system, including a new logo. Subsequent engagements have included product naming, sales enablement, and investor communications as Chorus neared market readiness. Solution included brand narrative, brand and visual identity system, anthem video, investor and sales presentations, product naming and nomenclature, business papers and collateral creation, and product design consultation.",
    capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"]
  },
  {
    page: 10, client: "Google", title: "Crafting a Cross-Product Narrative",
    summary: "Google wanted to unify its product messaging to create a holistic story across their suite of products, and amplify what makes Google's offerings distinct and relevant for modern work. Article Group synthesized the priorities of various executives to define what sets Google apart. We emphasized simplicity, security, and seamless AI to position all of its products as made for modern work, and developed a brand new design system to make messaging and design feel cohesive across their entire offering. Solution included a joint narrative deck that serves as foundational content for internal cross-team alignment, executive-led customer conversations, event thought leadership, blogs, social, and more, and a co-branded design system in Google Slides to craft a cross-product visual identity.",
    capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"]
  },
  {
    page: 11, client: "Android Enterprise", title: "Hyper-Targeted Consideration Campaign",
    summary: "The financial service industry (FSI) has a strong appetite for modern technology, but a complex web of regulatory and security concerns makes it difficult to manage their software and devices. Android Enterprise needed to tell a hard-working story about the advantages they have to offer across mobile devices and IT management. AG helped Android Enterprise create a marketing moment with a consideration campaign built on flexibility and modernization. We enhanced messaging with distinct content that connected with industry sub-sectors like banking, insurance, investing, and fintech. Solution included a 16-page eBook exploring the nuances of mobile device management in FSI, research-driven blog post to share insights and promote eBook and webinar, and promotional social posts to drive engagement.",
    capabilities: ["content-marketing", "growth-marketing"], industries: ["technology", "finance"]
  },
  {
    page: 12, client: "ChromeOS", title: "Cohesive Small Business Campaign",
    summary: "When internal ChromeOS research revealed a growth opportunity in their small business market, they knew they needed useful content that was worthy of their audience's limited time. Article Group leveraged audience research to develop a central idea: When you spend less time on IT, you have more time to spend on the work you love. We brought that idea to life with a bold campaign designed to provide clear, helpful, action-inspiring information that our audience could consume quickly. Solution included web-published, animated slides exploring tips to simplify IT, LinkedIn lead generation ads, lead nurture email series, and webinar run of show deck, script, and graphics package.",
    capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"]
  },
  {
    page: 13, client: "ChromeOS/Cameyo", title: "Maintaining Momentum Through Launch",
    summary: "In 2024 Google acquired Cameyo, a virtual app delivery (VAD) platform. As the platform was being integrated into Google, it put the marketing team in a unique position: they had existing customers, concrete leads, and interest from prospects — they just didn't have a product ready to be sold. Article Group helped the Cameyo team develop an email series approach and content calendar to engage leads over the several months until product launch. Because it is emerging tech in the virtualization space, we also proposed a series of content assets to help educate and ultimately convert the audience across the communication cadence. Solution included email series approach and content calendar with topics, timing, and rationale for easy executive buy-in, a series of 7 monthly emails and 4 original, linked content assets, and a wide range of supporting marketing launch assets (decks, demos, etc.).",
    capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"]
  },
  {
    page: 14, client: "Google Workspace", title: "Positioning a New Brand for Launch",
    summary: "Google was still developing new features while planning the launch of their G Suite rebrand. Despite the overlap, they needed to update existing materials and develop net-new assets to demonstrate why this move mattered. Article Group began with strategic planning and positioning centered around a uniquely ownable idea: the value of virtual collaboration. Instead of traditional launch assets, we created a series of storytelling videos that brought the products' features in development to life. Solution included strategic planning and positioning, rebranded sales materials, launch design assets, and a series of launch announcement videos.",
    capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"]
  },
  {
    page: 15, client: "Google Workspace", title: "Building an Editorial Program",
    summary: "Following their successful rebrand from G Suite to Workspace, Google wanted to increase awareness and consideration for their technology and establish themselves as a thought leader on the future of work. Article Group developed a content strategy to deliver a three-year-long editorial program targeted at business decision makers trying to navigate the complexities of hybrid and remote work. From there, we delivered multi-dimensional drumbeat content to drive repeat visits to the Workspace future of work landing page. Solution included a series of high-performing videos — from storyboard to final edit — featuring industry experts and technologists, and a series of long-form articles with custom voice and tone to establish Google executives as thought leaders, hosted on both the Google Workspace blog and Forbes.",
    capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"]
  },
  {
    page: 16, client: "Google Workspace", title: "Planning and Delivering Demand Generation",
    summary: "As Google Workspace expanded its AI offerings, they needed hard-working demand generation content that not only reflected the latest features but also incorporated new strategic messaging based on audience research. Article Group created and executed a year-long approach to develop and update long-form content that targeted priority audiences and capitalized on key events and feature announcements. Our storytelling focused on use cases for each audience — from sales teams to frontline workers, manufacturers, and more — to ensure a deeper connection to the product. Solution included a series of detailed handbooks and compelling 1-pagers targeted at specific audience segments to provide a clear, concise demonstration of the AI-driven advantages of Gemini for Google Workspace. These assets were leveraged across multiple touchpoints — at events, on social media, and in email marketing — achieving broad engagement.",
    capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"]
  },
  {
    page: 17, client: "Task Mate (Google)", title: "Elevated Long-Form Content",
    summary: "Task Mate was looking to translate extensive research on inclusive data representation into a fun and engaging content piece to present at Google I/O. AG leveraged the existing research to create a Task Mate-branded eBook aligned with the look & feel of the event. To offset the density and detail of the source material, we made it interactive by integrating quizzes, fun facts, real-life case studies, and Google resources that augment the content from the original study. Solution included a downloadable and printable eBook for session attendees, LinkedIn posts to promote the conference, and a thought leadership blog with voice and tone aligned to support a cohesive, attention-grabbing message.",
    capabilities: ["content-marketing", "creative-direction"], industries: ["technology"]
  },
  {
    page: 18, client: "Task Mate (Google)", title: "Driving Growth with Inclusive Messaging",
    summary: "Task Mate, a microtasking platform and mobile app, experienced a rapid increase in the number of users requesting tasks. This led them to initiate their first-ever in-market app campaign to recruit new field taskers in India, with future plans to expand to Mexico and Kenya. Article Group developed an integrated campaign strategy centered around the theme \"Task Mate gives you the extra money you need for your life - on your terms.\" We saw an opportunity to increase engagement and motivate new users to install the app by prioritizing actionable ad copy and reimagining existing design. Solution included a series of :15 second animated video spots formatted for multiple platforms, and static ads highlighting specific, easy opportunities to earn money.",
    capabilities: ["growth-marketing", "creative-direction"], industries: ["technology"]
  },
  {
    page: 19, client: "MyLink (Google)", title: "Insight-Driven Brand Development",
    summary: "Ahead of launching MyLink, a free link-in-bio catalog and app that helps micro-businesses and entrepreneurs monetize their social platforms, Google needed a cohesive brand identity that would help the product stand out in a competitive market. Article Group conducted primary research with MyLink's target audience in Sub-Saharan Africa and developed a messaging framework to align with their needs. Then, to solidify their brand identity for future content, we created a brand guide and used it to develop cohesive sales enablement and event content. Solution included a brand guide including messaging voice and tone, logo variations, typography, color palettes, illustrations, and photography, a pitch deck to help reach new users with practical tips and compelling features, and a one-pager summarizing the key features and benefits of the product.",
    capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"]
  },
  {
    page: 20, client: "Chrome Enterprise", title: "Timely, Compelling Thought Leadership",
    summary: "As knowledge workers around the world shifted to remote work during the pandemic, Chrome Enterprise recognized the need for thought leadership content to establish their authority in the industry. Article Group worked closely with VP John Solomon to plan and develop a content suite that demonstrated timely insights on remote work. We positioned Chrome Enterprise as an expert in a time of change and uncertainty, catering to the new needs of workers and the IT professionals who supported them. Solution included presentation decks for live virtual events sponsored by Forbes and the Wall Street Journal, event promotion pieces on the Google Cloud blog, and an executive paper offering pro-tips to navigate the evolving world of remote work.",
    capabilities: ["content-marketing"], industries: ["technology"]
  },
  {
    page: 21, client: "Modern Computing Alliance", title: "Delightfully Useful Design",
    summary: "Google established the Modern Computing Alliance (MCA), a collaborative effort among tech companies to develop more integrated business solutions. To further engage their partners, Google commissioned a new industry report from Accenture, and they needed help spreading the findings in a digestible, branded way. To make the report relevant and compelling Article Group designed an integrated system of core assets with a modern, refined look & feel and custom co-branding for each MCA partner to use with their own customers. Solution included a digital paper summarizing strategic insights from the Accenture report, a 60+ slide deck presentation with speaker notes for a webinar, and landing page copy and design.",
    capabilities: ["content-marketing", "creative-direction"], industries: ["technology"]
  },
  {
    page: 22, client: "Chrome Enterprise", title: "A Vibrant Virtual Event",
    summary: "When Chrome browser and ChromeOS launched new features designed for the future of work, they wanted to generate excitement by demonstrating the power of those features with an ambitious virtual event called Demo Day. From planning and design to capture and post-production, Article Group balanced creative inspiration and practical considerations to bring Demo Day to life with precision and excellence. We made tactical decisions to frame each demo and interview as a celebration of Chrome Enterprise's exceptional security, productivity, and collaboration. Solution included Demo Day virtual event including content planning, developing theme and look & feel, writing speaker scripts, creating custom motion graphics, on-site production, post-production, and promotional assets.",
    capabilities: ["experience-design", "creative-direction", "video-production"], industries: ["technology"]
  },
  {
    page: 23, client: "Google Messages", title: "Human-Centered Product Ads",
    summary: "Messages, a cutting-edge messaging app, empowers users to connect and communicate seamlessly across locations and devices. As the app's popularity soared, it became crucial to raise awareness that Messages is powered by Google. AG created a heartfelt campaign that emphasized the crucial role of messaging in fostering human connection. The goal was to tell relatable stories, create emotional resonance, and build long-lasting brand loyalty. Solution included a 1:00 product ad video including pre-production, shoot, and post-production, 0:10 product ad video cutdowns, and static social ads.",
    capabilities: ["creative-direction", "video-production"], industries: ["technology"]
  },
  {
    page: 24, client: "Android", title: "Telling a More Human Story",
    summary: "Android excels in the mobile security space, but that wasn't reflected in consumer perceptions. So the marketing team needed a unified way to talk about the features and benefits of their operating system that would build trust with their audiences. Article Group evaluated the mobile security landscape and recommended positioning territories that would set the brand apart. Then we leveraged those territories to create a thorough messaging framework and worked with another Android partner to test that messaging with consumers. Solution included a positioning territories deck including research highlights and takeaways, a messaging framework including brand pillars and elevator pitches, and the framework shared in Android's Partner Marketing Hub to help retailers communicate about Android security.",
    capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"]
  },
  {
    page: 25, client: "UpShow/ChromeOS", title: "Purposeful Partner Marketing",
    summary: "To increase market reach among retail health organizations, UpShow wanted to launch an awareness campaign that targeted marketing professionals and celebrated ChromeOS, which powers the UpShow solution. Article Group brainstormed, pitched, iterated, and published UpShow-branded media ads and videos that demonstrated the practical benefits of their solution while also reinforcing ChromeOS messaging. To increase awareness and consideration, we prioritized interactivity and a cohesive value proposition that went beyond typical partner marketing. Solution included :10, :15, and :30 second video advertisements to efficiently pitch the value of UpShow and ChromeOS, rich, interactive media ads to promote engagement and buy-in, and landing page copy and design to summarize messaging and use cases.",
    capabilities: ["content-marketing", "growth-marketing"], industries: ["technology", "healthcare"]
  },
  {
    page: 26, client: "Chrome", title: "Earning SMB Consideration",
    summary: "When research revealed that SMB leaders didn't see the value of ChromeOS and Chromebook, Google needed a campaign to increase consideration by speaking directly to the audience's needs. Article Group crafted the \"ChromeOS runs with you,\" integrated campaign, centered around the idea that SMB leaders are always hustling and need a platform that keeps up. We showed them practical ways that Chrome helps them tackle their to-do list faster so they can spend more time on higher-priority goals. Solution included a live action :45 second product ad that focuses on audience needs, social posts, Spotify banners, and email signatures to make the campaign holistic and cohesive, and a custom-built landing page to summarize offering and track engagement.",
    capabilities: ["growth-marketing", "content-marketing", "creative-direction"], industries: ["technology"]
  },
  {
    page: 27, client: "Salesforce/Slack", title: "Strategic Sales Enablement",
    summary: "When Salesforce acquired Slack for nearly $30B, they wanted to generate ROI by training their global partners to upsell with their existing Salesforce implementation services. Article Group created a holistic and tactical suite of downloadable content designed to marry Salesforce and Slack messaging and give partners the tools, insights, and language they need to market their Slack implementation services. Solution included a playbook exploring common customer challenges, an email drip campaign including relevant statistics, a call script to empower sales teams, and copy for social media posts to promote services.",
    capabilities: ["content-marketing"], industries: ["technology"]
  },
  {
    page: 28, client: "Slalom", title: "Celebrating Customer Success",
    summary: "Slalom's Salesforce implementation practice was growing rapidly, and they had a backlog of customer success stories they wanted to create and share with prospective clients. But they didn't have the internal resources to write and design the stories themselves. Article Group designed a branded case study template and developed a fast-moving workflow to help Slalom turn around each case study in a matter of weeks, not months. We prioritized demonstrating relatable outcomes and making the customer the hero of the story — rather than the products and services. Solution included a custom Slalom-branded case study design template, 10 customer success stories including qualitative and quantitative outcomes, and promotional social posts.",
    capabilities: ["content-marketing", "creative-direction"], industries: ["technology", "b2b-services"]
  },
  {
    page: 29, client: "Salesforce/WhatsApp", title: "Hyping Up a Holiday Virtual Event",
    summary: "Salesforce & WhatsApp needed to increase consideration of their new business messaging integration in Latin America ahead of the holiday season — giving retailers a new way to improve their customer experience and boost sales during a key time. AG created a cohesive consideration and conversion campaign, culminating with a virtual event hosted in Brazil. To capitalize on holiday themes, we anchored event theme and assets around \"the value of business messaging in the season of connection.\" Solution included a pre-event sales enablement presentation in an innovative published slides format, pre-event email assets to drive interest and post-event email assets to drive conversion, and a post-event business messaging toolkit.",
    capabilities: ["growth-marketing", "content-marketing", "experience-design"], industries: ["technology"]
  },
  {
    page: 30, client: "Android", title: "Crafting a Brand New Virtual Event",
    summary: "Android Enterprise needed to update their brand positioning to differentiate from competitors and increase their market share. And they wanted to create a new virtual event that would celebrate the benefits of powerful new features with prospective customers. Article Group identified and tested positioning territories with quantitative and qualitative research. We leveraged those insights to refresh messaging around management and security and brought those ideas to life with the \"Art of Control\" virtual event — featuring discussions between Google, industry thought leaders, and customers like Walmart and the FBI. Solution included Art of Control virtual event including content planning, developing name and look & feel, refining speaker scripts, creating custom motion graphics, pre-recording, post-production, and promotional assets.",
    capabilities: ["brand-strategy", "experience-design", "video-production"], industries: ["technology"]
  },
  {
    page: 31, client: "Google Cloud", title: "Illuminating a New Brand Identity",
    summary: "Google launched the Cloud Innovators Program, a developer community that offers developers promotional benefits in exchange for their advocacy and adoption of Google Cloud services. They needed to establish a visual identity and create promotional assets ahead of their first Google Cloud Innovators Hive Event. Article Group partnered with Google to create the program's visual identity and imagery. Program badges served as designations and \"achievements\" to motivate and build up the community. An extensible design system allowed Google to expand on the original set of assets to develop additional templates and designs including virtual events graphics and promotional posts. Solution included the program's visual identity and style standards playbook, initial assets and program badges, and extended program identity for virtual event identity & graphics package.",
    capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"]
  },
  {
    page: 32, client: "AWS", title: "Keynotes That Reshape Perspectives",
    summary: "For the last 12 years, AWS has used re:Invent to showcase cutting edge, complex, and constantly evolving technologies. But with a large and diverse audience for keynotes, they needed to simplify the ideas without diminishing the value of their nuanced innovations. Article Group combined our expertise in technology, storytelling, and design to make technical details feel concrete and compelling with stunning visuals that turned slides into memorable keynote moments. We applied unique thinking and nimble problem solving, juggling multiple keynotes at once and making last-minute, in-person tweaks at the event. Solution included hundreds of keynote presentation slides, unique animations, efficient video production, and cutting-edge 3D modeling.",
    capabilities: ["creative-direction", "content-marketing"], industries: ["technology"]
  },
  {
    page: 33, client: "CrowdStrike", title: "Applying the Power of a Great Marketecture",
    summary: "By 2023, CrowdStrike's product portfolio had become too complicated for customers and sales teams to understand. They needed a better way to communicate their products, and they wanted it ready to unveil at their annual customer conference — Fal.con. Article Group reorganized CrowdStrike's portfolio through the eyes of their customers. Grouping a long list of products into well-known categories not only made their offering easier to understand, but also enabled CrowdStrike to define what those categories should be for the entire industry. Solution included a new marketecture for CrowdStrike's products that put their customers first, story co-creation around how these products and services are built upon a platform, and product story and new marketecture integrated into a cohesive keynote presentation that highlighted the newest product releases.",
    capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"]
  },
  {
    page: 34, client: "Amazon re:MARS", title: "Bold, Inspirational Branded Docuseries",
    summary: "Amazon re:MARS started as a landmark event for professionals in the MARS fields (machine learning, automation, robotics, and space), but Amazon had a vision to increase consideration among customers by augmenting the brand with thought leadership in an always-on digital content experience. Article Group developed and produced two branded documentary series designed to lead viewers on a content journey that provides increasing levels of depth, insight, and utility around the future of the industry. To increase relevance and drive consideration, we tailored each series for unique audiences — one to entertain casual MARS enthusiasts, and the other to inform experts with a technical deep dive. Solution included Luminaries: A premium documentary profile series published on Amazon Prime featuring some of the most influential thinkers across the MARS space, and Explorations: An original YouTube series that provides compelling deep-dives into real-world business applications for MARS technology.",
    capabilities: ["video-production", "creative-direction"], industries: ["technology"]
  },
  {
    page: 35, client: "ADP", title: "Creating Keynotes That Connect",
    summary: "ADP is expert in all things HR: human capital management, payroll, compliance. But they are not experts in storytelling or design, and they knew it. They needed a partner they could trust to ride along at every step of the content creation process. Article Group built trust with ADP by bringing a level of ownership and accountability to the creative process ADP hadn't experienced before. More than just a design shop, Article Group became a teammate — sometimes mentor — and creative powerhouse to bring ADP's keynotes to life. Solution included keynote presentation narrative and design for both the general session for customers and a special session for the highest level executives, and produced three customer success story videos — from storyboarding and scripting to editing and delivery — and integrated them into the keynote presentation.",
    capabilities: ["creative-direction", "content-marketing"], industries: ["technology", "b2b-services"]
  },
  {
    page: 36, client: "Simons Foundation", title: "Illuminating a New Brand Identity",
    summary: "To be more effective in their mission to champion basic science, Simons Foundation needed to clarify its identity both inside and outside of the organization. They wanted a new brand that brought the mission to life and unified a variety of sub-brands under one umbrella. Article Group developed a cohesive brand story and simple, but nuanced visual system that celebrates the mission and unites the identity of the foundation. We used abstract hand sketches, illustrations, and 3D renders to create unique designs that make space for creative exploration and expression. Solution included a research discovery report to establish foundational insights, messaging narrative and framework to create a cohesive story, design system to unify and refresh visual identity, website copywriting to update main landing page and \"About\" page, and brand launch video to celebrate and clarify the rebrand.",
    capabilities: ["brand-strategy", "creative-direction"], industries: ["non-profit"]
  },
  {
    page: 37, client: "AWS", title: "Inspirational Global Advertising Campaign",
    summary: "Amazon Web Services (AWS) is an industry-leading cloud-computing platform that most people knew nothing about. But as cloud computing became more and more mainstream, AWS knew it needed to start building a brand in earnest. Article Group grounded the campaign around a simple, but powerful tagline: \"AWS is How.\" We made our message relevant for a variety of businesses by celebrating AWS as the fundamental technology that makes all our customers' innovations possible. And we led with an emotive tone of commonality and togetherness to keep the message positive and inspirational. Solution included research-driven insights report that focused on the brand opportunities at hand, created global campaign tagline: \"AWS is How\", and storyboarded, produced, and edited sample creative videos.",
    capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"]
  },
  {
    page: 38, client: "Salt Security", title: "Defending Market Territory",
    summary: "Salt was widely regarded as a market innovator in API security. But when a number of new competitors joined the scene with fresh and catchy marketing, Salt wanted to keep their leadership position by updating and upgrading their brand to be less technical and more memorable. Article Group kicked off the project by identifying positioning territories and testing them with Salt's audience. We then leveraged those insights to create a new brand identity and supporting content that not only celebrated their proven expertise but also translated features into benefits that customers could better relate to. Solution included market research and discovery report testing messaging with target audience, messaging framework and core narrative clarifying and unifying a central story, visual identity system bringing the brand to life with precise and thoughtful design, :90 second explainer video summarizing Salt's value proposition, and sales presentation enabling smooth transition from marketing to sales.",
    capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"]
  },
  {
    page: 39, client: "Meta", title: "Informed Messaging and a Unified Story",
    summary: "Looking to increase interactions between customers and businesses on its platforms, Meta needed new messaging to highlight the unique benefits of its B2B products in Messenger, WhatsApp, and Instagram. Article Group gathered research and audience insights to inform messaging and narrative frameworks that united future content and campaigns under one cohesive story. The key idea was to help businesses meet customers where they already were: \"Meet them in Meta.\" Solution included an audience insight research report, narrative and messaging frameworks to clarify how stakeholders should speak to audience, an explainer video summarizing the value of businesses connecting with customers on Meta platforms, and industry-specific sales decks.",
    capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"]
  },
  {
    page: 40, client: "Omnicell", title: "Making Marketing and Sales Talk",
    summary: "Omnicell, a cutting edge pharmaceutical technology company, had a vision to update the positioning for its suite of offerings with a new core idea: the fully autonomous pharmacy of the future. They needed help closing the brand, marketing, and sales gap for this positioning with tactical content for their sales team. Article Group started with messaging hierarchies to create a bridge between the high-level brand position and practical features for individual products. We then used those frameworks to create slide decks that help sales teams tell a clear and cohesive story to prospects. To make technical benefits feel accessible and clear, we created a variety of illustrative metaphors with fun and memorable visual motifs. Solution included messaging frameworks to apply high-level positioning to specific products and use cases, first call sales decks with illustrative metaphors to make benefits simple and clear, and a two-page battle card to summarize key benefits and competitive advantages for sales teams.",
    capabilities: ["brand-strategy", "content-marketing"], industries: ["healthcare", "technology"]
  },
  {
    page: 41, client: "AWS", title: "Transforming Digital Audits",
    summary: "Before the Digital Audit Symposium, AWS customers and regulators faced the daunting task of sifting through extensive documentation to answer their questions about AWS security and infrastructure. AWS needed to develop a digital solution allowing customers and regulators to conduct audits more efficiently and at scale. Article Group partnered with the AWS Digital Audit Symposium team to create an impactful series of videos featuring AWS subject matter experts. These videos meticulously unpacked the answers to AWS' most frequently asked audit questions, providing clarity and insight on a grand scale. Article Group created more than 70 videos for the AWS Digital Audit Symposium, with a total runtime exceeding 6 hours. Our comprehensive content and continued video production have been instrumental in helping AWS secure and maintain major customer contracts while assuring regulators of the robust security of customer data.",
    capabilities: ["video-production", "content-marketing"], industries: ["technology"]
  },
  {
    page: 42, client: "ADP", title: "Customer Story Videos",
    summary: "ADP wanted to announce new product features for their Intelligent Self-Service, Next-Gen HCM, Voice of the Employee HR, and Payroll applications at their annual Meeting of the Minds conference. But they didn't want attendees to just take their word for the value of their products. They wanted them to hear about each product's impact directly from fellow ADP customers. ADP and AG partnered to identify one \"power user\" per product. Article Group partnered with them to create compelling testimonial video content that could not only air at Meeting of the Minds, but live on in various digital channels after the event. Article Group researched all products, interviewed customers over video calls, and developed interview guides and questions to tell each story. AG conducted interview and B-roll productions at customer offices in TX & FL, then edited each video quickly in the weeks leading up to the event.",
    capabilities: ["video-production", "creative-direction"], industries: ["technology", "b2b-services"]
  },
  {
    page: 43, client: "AWS/NVIDIA", title: "Co-Branded Video for a Visionary Collaboration",
    summary: "AWS and NVIDIA needed more than just a promotional video — they needed a story that could capture the imagination of their audience while effectively showcasing the immense power and capabilities of their revolutionary AI supercomputer, Project Ceiba. Article Group took a dynamic and holistic approach to creative directing, working closely with both stakeholders to distill the essence of their collaboration into a visionary story. Starting with the kernel of an idea, we synthesized insights and technical details into a seamless visual and emotional journey. Solution included creative direction that developed the video from concept to execution, cinematic storytelling blending interviews, use cases, and custom 3D animations to illustrate the transformative power of AI, and multi-channel distribution achieving over 8 million combined views across Instagram, TikTok, YouTube, X, and LinkedIn.",
    capabilities: ["video-production", "creative-direction"], industries: ["technology"]
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function createSlug(client: string, title: string): string {
  const combined = `${client} ${title}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function generateStorageFilename(client: string, title: string): string {
  const slug = createSlug(client, title);
  return `${slug}.pdf`;
}

// Get PDF URL from storage
function getPdfUrl(client: string, title: string): string {
  const filename = generateStorageFilename(client, title);
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/individual/${filename}`;
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  console.log(`
🚀 Article Group Case Study Population
==========================================
Case Studies: ${CASE_STUDIES.length}
==========================================
`);

  // Fetch capability and industry IDs
  console.log('📚 Loading taxonomy...');
  
  const { data: capabilities } = await supabase
    .from('capabilities')
    .select('id, slug');
  
  const { data: industries } = await supabase
    .from('industries')
    .select('id, slug');
  
  const capabilityMap = new Map(capabilities?.map(c => [c.slug, c.id]) || []);
  const industryMap = new Map(industries?.map(i => [i.slug, i.id]) || []);
  
  console.log(`   Found ${capabilityMap.size} capabilities, ${industryMap.size} industries\n`);

  let successCount = 0;
  let failCount = 0;

  for (const cs of CASE_STUDIES) {
    const fullTitle = `${cs.client}: ${cs.title}`;
    const slug = createSlug(cs.client, cs.title);
    const pdfUrl = getPdfUrl(cs.client, cs.title);
    
    process.stdout.write(`[${cs.page}] ${cs.client}: ${cs.title.substring(0, 35)}... `);
    
    try {
      // 1. Generate embedding for the summary
      const searchableText = `${cs.client} ${cs.title} ${cs.summary}`;
      const embedding = await generateEmbedding(searchableText);
      
      // 2. Create document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          title: fullTitle,
          slug: slug,
          doc_type: 'case_study',
          client_name: cs.client,
          summary: cs.summary,
          pdf_url: pdfUrl,
          vimeo_url: cs.vimeoUrl || null,
        })
        .select('id')
        .single();
      
      if (docError) {
        throw new Error(`Document insert: ${docError.message}`);
      }
      
      const documentId = doc.id;
      
      // 3. Create content chunk with embedding (for RAG search)
      const { error: chunkError } = await supabase
        .from('content_chunks')
        .insert({
          document_id: documentId,
          content: cs.summary,
          chunk_index: 0,
          chunk_type: 'narrative',
          embedding: embedding,
          metadata: { source: 'summary' },
        });
      
      if (chunkError) {
        console.warn(`   ⚠️ Chunk insert warning: ${chunkError.message}`);
      }
      
      // 4. Link capabilities
      const capabilityIds = cs.capabilities
        .map(slug => capabilityMap.get(slug))
        .filter(Boolean);
      
      if (capabilityIds.length > 0) {
        await supabase.from('document_capabilities').insert(
          capabilityIds.map(capId => ({ document_id: documentId, capability_id: capId }))
        );
      }
      
      // 5. Link industries
      const industryIds = cs.industries
        .map(slug => industryMap.get(slug))
        .filter(Boolean);
      
      if (industryIds.length > 0) {
        await supabase.from('document_industries').insert(
          industryIds.map(indId => ({ document_id: documentId, industry_id: indId }))
        );
      }
      
      console.log('✅');
      successCount++;
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
      
    } catch (error: any) {
      console.log(`❌ ${error.message}`);
      failCount++;
    }
  }

  console.log(`
==========================================
📊 SUMMARY
==========================================
Successful: ${successCount}
Failed:     ${failCount}
Total:      ${CASE_STUDIES.length}
==========================================

✨ Done! Case studies are now searchable and have PDFs linked.
`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
