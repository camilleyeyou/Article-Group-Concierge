/**
 * Re-link existing case study videos to new document records.
 *
 * Background: The case study set was rebuilt against a new PDF, which
 * generated new slugs. The previous run of upload-videos.ts uploaded
 * videos under the old slugs (the storage paths still work — they're
 * just folder names) but the documents table has hero_video_url = NULL
 * for every new case study. This script repoints existing storage
 * URLs at the correct new documents without re-uploading any bytes.
 *
 * Run with:  npm run relink:videos
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const VIDEO_BUCKET = 'case-study-videos';

function publicUrl(folder: string, file: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${VIDEO_BUCKET}/${folder}/${file}`;
}

interface Mapping {
  newSlug: string;
  hero: { folder: string; file: string };
  support?: Array<{ folder: string; file: string; title: string }>;
}

// Manual mapping: old storage folder + file → new case study slug.
// Hero = the most prominent video for that case study; support = extras.
const MAPPINGS: Mapping[] = [
  {
    // ADP Customer Story Videos (Meeting of the Minds testimonials)
    newSlug: 'adp-customer-story-videos',
    hero: {
      folder: 'adp-meeting-of-the-minds-product-videos',
      file: 'ADP_-_Waste_Pro_-_Voice_of_the_Employee_Testimonial.mp4',
    },
  },
  {
    // Android: Telling a More Human Story (mobile security messaging)
    newSlug: 'android-telling-a-more-human-story',
    hero: {
      folder: 'android-mobile-security-messaging',
      file: 'Android_-_Theft_Detection_Demo.mp4',
    },
    support: [
      {
        folder: 'android-mobile-security-messaging',
        file: 'Android_Talks_Productivity_-_Intro.mp4',
        title: 'Android Talks Productivity — Intro',
      },
    ],
  },
  {
    // AWS: Bringing Powerful Gen AI Models to Life (Amazon Nova campaign)
    newSlug: 'aws-bringing-powerful-gen-ai-models-to-life',
    hero: {
      folder: 'aws-amazon-nova-ai-models-video-campaign',
      file: 'Amazon_Nova_-_Amazon_Nova_2_Explainer_Video.mp4',
    },
    support: [
      {
        folder: 'aws-amazon-nova-ai-models-video-campaign',
        file: 'Amazon_Nova_-_Amazon_Nova_Reel_1.1_Demo.mp4',
        title: 'Amazon Nova Reel 1.1 Demo',
      },
      {
        folder: 'aws-amazon-nova-ai-models-video-campaign',
        file: 'Amazon_Nova_-_Creative_Content_Models.mp4',
        title: 'Amazon Nova — Creative Content Models',
      },
      {
        folder: 'aws-amazon-nova-ai-models-video-campaign',
        file: 'Amazon_-_Thorn.mp4',
        title: 'Amazon — Thorn',
      },
    ],
  },
  {
    // AWS: Creating a New Kind of Product Demo (SageMaker / App Studio)
    newSlug: 'aws-creating-a-new-kind-of-product-demo',
    hero: {
      folder: 'aws-amazon-sagemaker-product-demo',
      file: 'AWS_-_App_Studio_Demo.mp4',
    },
    support: [
      {
        folder: 'aws-amazon-sagemaker-product-demo',
        file: 'AWS_reInvent_-_Amazon_Connect_Demo.mp4',
        title: 'AWS re:Invent — Amazon Connect Demo',
      },
    ],
  },
  {
    // AWS/NVIDIA: Co-Branded Video for a Visionary Collaboration (Project Ceiba)
    newSlug: 'aws-nvidia-co-branded-video-for-a-visionary-collaboration',
    hero: {
      folder: 'aws-global-brand-advertising-campaign',
      file: 'AWS_and_NVIDIA_-_Project_Ceiba.mp4',
    },
  },
  {
    // Chorus (Alphabet X): Creating an Eye-Opening Asset Visibility Brand
    newSlug: 'chorus-alphabet-x-creating-an-eye-opening-asset-visibility-brand',
    hero: {
      folder: 'chorus-alphabet-x-brand-narrative-for-asset-visibility-platform',
      file: 'Chorus_-_Anthem_Video.mp4',
    },
  },
  {
    // Chrome Enterprise: Turning a Security Upgrade into a Compelling Video
    newSlug: 'chrome-enterprise-turning-a-security-upgrade-into-a-compelling-video',
    hero: {
      folder: 'chrome-enterprise-chrome-enterprise-premium-security-video',
      file: 'Chrome_Enterprise_-_Chrome_Enterprise_Premium_Explainer_Video.mp4',
    },
  },
  {
    // Chrome Enterprise: Reclaiming the Browser Conversation (Beyond Browsing campaign)
    newSlug: 'chrome-enterprise-reclaiming-the-browser-conversation',
    hero: {
      folder: 'chrome-enterprise-no-place-like-chrome-campaign-reset',
      file: 'Chrome_Enterprise_-_Beyond_Browsing_-_CBCM_Mobile.mp4',
    },
  },
  {
    // Google: Crafting a Cross-Product Narrative (recruiting story)
    newSlug: 'google-crafting-a-cross-product-narrative',
    hero: {
      folder: 'google-cross-product-narrative-unification',
      file: 'Google_Recruiting_-_Technical_Judgment.mp4',
    },
  },
  {
    // Google Messages: Human-Centered Product Ads
    newSlug: 'google-messages-human-centered-product-ads',
    hero: {
      folder: 'google-messages-product-awareness-campaign',
      file: 'Google_Messages_-_We_re_All_Connected.mp4',
    },
  },
  {
    // Meta: Informed Messaging and a Unified Story (B2B messaging platform)
    newSlug: 'meta-informed-messaging-and-a-unified-story',
    hero: {
      folder: 'meta-b2b-messaging-platform-story',
      file: 'Meta_-_Business_Messenger_Explainer_Video.mp4',
    },
    support: [
      {
        folder: 'meta-b2b-messaging-platform-story',
        file: 'Facebook_-_Chat_Plugin_-_ROYBI.mp4',
        title: 'Facebook Chat Plugin — ROYBI',
      },
    ],
  },
  {
    // Task Mate (Google): Elevated Long-Form Content (Google I/O eBook + field tasks)
    newSlug: 'task-mate-google-elevated-long-form-content',
    hero: {
      folder: 'task-mate-inclusive-data-ebook-for-google-i-o',
      file: 'Google_-_Task_Mate_-_Field_Tasks.mp4',
    },
  },
];

async function main() {
  console.log(`
🎬 Re-linking case study videos
==========================================
Mappings: ${MAPPINGS.length}
==========================================
`);

  let heroLinked = 0;
  let supportLinked = 0;
  let failed = 0;

  for (const m of MAPPINGS) {
    const heroUrl = publicUrl(m.hero.folder, m.hero.file);
    process.stdout.write(`📺 ${m.newSlug.slice(0, 55).padEnd(55)} `);

    // Find the document
    const { data: doc, error: lookupError } = await supabase
      .from('documents')
      .select('id, slug')
      .eq('slug', m.newSlug)
      .eq('doc_type', 'case_study')
      .maybeSingle();

    if (lookupError || !doc) {
      console.log(`❌ Document not found`);
      failed++;
      continue;
    }

    // Verify the hero file actually exists in storage (HEAD request)
    const headRes = await fetch(heroUrl, { method: 'HEAD' });
    if (!headRes.ok) {
      console.log(`❌ Hero video not in storage (${headRes.status})`);
      failed++;
      continue;
    }

    // Update hero_video_url
    const { error: updateError } = await supabase
      .from('documents')
      .update({ hero_video_url: heroUrl })
      .eq('id', doc.id);

    if (updateError) {
      console.log(`❌ ${updateError.message}`);
      failed++;
      continue;
    }

    heroLinked++;

    // Insert support videos
    if (m.support && m.support.length > 0) {
      for (let i = 0; i < m.support.length; i++) {
        const sv = m.support[i];
        const url = publicUrl(sv.folder, sv.file);
        const { error: insertError } = await supabase
          .from('support_videos')
          .insert({
            document_id: doc.id,
            video_url: url,
            title: sv.title,
            display_order: i,
          });
        if (!insertError) supportLinked++;
      }
    }

    console.log(`✅ hero${m.support ? ` + ${m.support.length} support` : ''}`);
  }

  console.log(`
==========================================
📊 RE-LINK COMPLETE
==========================================
Hero videos linked:    ${heroLinked}
Support videos linked: ${supportLinked}
Failed:                ${failed}
==========================================
`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
