# Check sheet: p3-q02

Query: What does your co-branded video work look like? Specifically joint pieces where two big brands share the spotlight without it turning into a logo soup.

Verdict: VERIFIED under both rules (strict: identical teaser and video in all rounds; claims: 0 unsupported, no leak). No Strategy Lead offer in any round.

## Round 1 (2026-11-25T17:26:50.334Z, http 200, complete 14570 ms)

- Hero: **Two Big Brands, One Shared Spotlight** / Co-branded video without the logo soup / You're asking how a joint video can give two major brands equal presence while still telling one clear story.
- Video: https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/case-study-videos/aws-global-brand-advertising-campaign/AWS_and_NVIDIA_-_Project_Ceiba.mp4
- StrategyCard: **Let the Idea Carry Both Brands**: A joint video works when the story belongs to the collaboration itself, not to either brand. Each brand then shows up through its role in that story, not through equal-sized lockups.
- Teaser `aws-nvidia-co-branded-video-for-a-visionary-collaboration`: We creative directed a co-branded video for AWS and NVIDIA's AI supercomputer, Project Ceiba, from concept to execution, blending interviews, use cases and custom 3D animations. It reached over 8 million combined views across Instagram, TikTok, YouTube, X and LinkedIn. [capabilities: Creative Direction, Video Production; industries: Artificial Intelligence]
- Narrative: Project Ceiba is the closest match to what you're describing. We worked closely with stakeholders from both AWS and NVIDIA to distill their collaboration into one visionary story. For your project, we'd start with a joint session with both teams to agree on what the film has to say before any design or production decisions.

## Round 2 (2026-11-25T18:36:15.641Z, http 200, complete 16975 ms)

- Hero: **Two Brands, One Story, No Logo Soup** / Co-branded video for a joint spotlight / You're asking how a video can give two big brands equal billing while still feeling like a single, cohesive piece rather than a pile of logos.
- Video: https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/case-study-videos/aws-global-brand-advertising-campaign/AWS_and_NVIDIA_-_Project_Ceiba.mp4
- StrategyCard: **One Story Before Two Logos**: For a joint piece, we'd begin by agreeing on the single idea both brands want to stand behind, then let that idea decide the tone, visuals and structure. Brand presence follows from the story rather than being divided up in advance.
- MetricGrid: {"stats":[{"label":"Combined views","value":"8M+","context":"Across Instagram, TikTok, YouTube, X and LinkedIn"}],"columns":2,"variant":"highlight"}
- Teaser `aws-nvidia-co-branded-video-for-a-visionary-collaboration`: We creative directed a video for AWS and NVIDIA's AI supercomputer, Project Ceiba, from concept to execution. It blends interviews, use cases and custom 3D animations. [capabilities: Creative Direction, Video Production; industries: Artificial Intelligence]
- Narrative: AWS/NVIDIA is our one published co-branded video, so it's the closest answer to your question. We worked closely with both stakeholders to distill their collaboration into a single story. The case study doesn't describe how logos were handled, so we can't speak to that. For your joint piece, we'd first get both sides to agree on the one story the film tells, before any brand lockups come up.

## Round 3 (2026-11-25T19:42:14.221Z, http 200, complete 15857 ms)

- Hero: **Sharing the Spotlight Without the Logo Soup** / Co-branded video for two major brands / You're asking how a joint video can give two big brands equal presence while still feeling like one story rather than a pile of logos.
- Video: https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/case-study-videos/aws-global-brand-advertising-campaign/AWS_and_NVIDIA_-_Project_Ceiba.mp4
- StrategyCard: **Story First, Logos Second**: In a joint piece, we'd build the film around the single idea both brands share, so the partnership shows up in the story itself and not in how the branding is divided.
- Teaser `aws-nvidia-co-branded-video-for-a-visionary-collaboration`: We creative directed a co-branded video for AWS and NVIDIA's Project Ceiba AI supercomputer, from concept to execution. It blends interviews, use cases and custom 3D animations, and reached over 8 million combined views across Instagram, TikTok, YouTube, X and LinkedIn. [capabilities: Creative Direction, Video Production; industries: Artificial Intelligence]
- Narrative: The AWS and NVIDIA film is our one published co-branded video, and we made it by working closely with both stakeholders to distill their collaboration into a single story. We haven't published other joint video work, so we can't point to a second example. For your project, we'd start by getting both brand teams in one room to agree on what the film is saying, before anyone discusses logo placement.

## Stability

| round | started | teaser slugs | video URLs | Strategy Lead offer | rag_cache_hit | orch_cached |
|---|---|---|---|---|---|---|
| 1 | 2026-11-25T17:26:50.334Z | aws-nvidia-co-branded-video-for-a-visionary-collaboration | https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/case-study-videos/aws-global-brand-advertising-campaign/AWS_and_NVIDIA_-_Project_Ceiba.mp4 | no | 0 | false |
| 2 | 2026-11-25T18:36:15.641Z | aws-nvidia-co-branded-video-for-a-visionary-collaboration | https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/case-study-videos/aws-global-brand-advertising-campaign/AWS_and_NVIDIA_-_Project_Ceiba.mp4 | no | 0 | false |
| 3 | 2026-11-25T19:42:14.221Z | aws-nvidia-co-branded-video-for-a-visionary-collaboration | https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/case-study-videos/aws-global-brand-advertising-campaign/AWS_and_NVIDIA_-_Project_Ceiba.mp4 | no | 0 | false |

## Notes

Perf flags: rag_cache_hit 0, orch_cached false every round; rounds 17:26:50, 18:36:15, 19:42:14 UTC. Layout differs slightly in round 2 (adds a MetricGrid with 8M+ views in place of the sentence in the teaser); both are supported. Video shared with p3-q10, which is out of the final set.

## Claims

Round 1 items, checked by hand against the appendix (and, for catalogue-wide statements, 06-CATALOGUE.md). Advice phrased as "we'd start by..." is a proposed approach, not a claim about past work, and is marked n/a-approach.

| item | source slug | supporting quote from indexed text | verdict | stable in rounds 2-3 |
|---|---|---|---|---|
| Hero: joint video giving two brands equal presence while telling one story | | restates the query | supported | yes |
| Video: Project Ceiba | aws-nvidia-co-branded-video-for-a-visionary-collaboration | documents.hero_video_url equals this URL; HEAD 200 video/mp4 | supported (the study's own video) | yes, same URL all rounds |
| StrategyCard: story belongs to the collaboration, not either brand; brands show up through their role, not equal-sized lockups | | proposed approach | n/a-approach | yes |
| Teaser: creative directed co-branded video for AWS and NVIDIA's AI supercomputer Project Ceiba, concept to execution | aws-nvidia-co-branded-video-for-a-visionary-collaboration | "creative direction that developed the video from concept to execution"; "revolutionary AI supercomputer, Project Ceiba" | supported | yes |
| Teaser: interviews, use cases, custom 3D animations | aws-nvidia-co-branded-video-for-a-visionary-collaboration | "cinematic storytelling blending interviews, use cases, and custom 3D animations" | supported | yes |
| Teaser: over 8 million combined views across Instagram, TikTok, YouTube, X and LinkedIn | aws-nvidia-co-branded-video-for-a-visionary-collaboration | "multi-channel distribution achieving over 8 million combined views across Instagram, TikTok, YouTube, X, and LinkedIn" | supported | rounds 1 and 3 in the teaser; round 2 as a MetricGrid (8M+, same platforms) |
| Tags: Creative Direction, Video Production / Artificial Intelligence | aws-nvidia-co-branded-video-for-a-visionary-collaboration | DB tags match | supported | yes |
| Narrative: Project Ceiba is the closest match; we worked closely with stakeholders from both AWS and NVIDIA to distill their collaboration into one visionary story | aws-nvidia-co-branded-video-for-a-visionary-collaboration | "working closely with both stakeholders to distill the essence of their collaboration into a visionary story" | supported | yes |
| Narrative (rounds 2-3): it is our one published co-branded video | | 06-CATALOGUE.md: only one study titled co-branded | supported | n/a |
| Narrative (round 2): the case study doesn't describe how logos were handled, so we can't speak to that | aws-nvidia-co-branded-video-for-a-visionary-collaboration | source says nothing about logos | supported (honest limit; refers to the published case study, not retrieval) | n/a |
| Narrative: we'd start with a joint session with both teams | | proposed approach | n/a-approach | yes |

## Appendix: indexed source text

### aws-nvidia-co-branded-video-for-a-visionary-collaboration

Title: AWS/NVIDIA: Co-Branded Video for a Visionary Collaboration; client: AWS/NVIDIA; hero_video_url: https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/case-study-videos/aws-global-brand-advertising-campaign/AWS_and_NVIDIA_-_Project_Ceiba.mp4; vimeo_url: https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/case-study-videos/aws-global-brand-advertising-campaign/AWS_and_NVIDIA_-_Project_Ceiba.mp4
DB capabilities: Video Production, Creative Direction; DB industries: Artificial Intelligence

[chunk 0] AWS and NVIDIA needed more than just a promotional video — they needed a story that could capture the imagination of their audience while effectively showcasing the immense power and capabilities of their revolutionary AI supercomputer, Project Ceiba. Article Group took a dynamic and holistic approach to creative directing, working closely with both stakeholders to distill the essence of their collaboration into a visionary story. Starting with the kernel of an idea, we synthesized insights and technical details into a seamless visual and emotional journey. Solution included creative direction that developed the video from concept to execution, cinematic storytelling blending interviews, use cases, and custom 3D animations to illustrate the transformative power of AI, and multi-channel distribution achieving over 8 million combined views across Instagram, TikTok, YouTube, X, and LinkedIn.
