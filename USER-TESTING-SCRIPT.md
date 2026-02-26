# User Testing Script - Article Group AI Concierge

**Version**: 1.0
**Test Duration**: 30-45 minutes per user
**Purpose**: Validate core user flows and gather feedback on AI-generated pitch decks

---

## Pre-Test Setup

### For Test Facilitator
- [ ] Application is running and accessible
- [ ] Database has case studies populated
- [ ] Test recording tool ready (screen capture, notes)
- [ ] User consent form signed (if recording)
- [ ] Prepare 5-10 test scenarios based on user persona

### For Test Participant
- [ ] Brief introduction: "We're testing an AI tool that creates personalized pitch decks"
- [ ] Encourage thinking aloud
- [ ] No wrong answers - we're testing the app, not you
- [ ] Session will take 30-45 minutes

---

## Test Scenarios by User Persona

### 👔 Scenario 1: Tech Startup Founder
**Context**: You're a founder of a SaaS startup looking to rebrand before Series A funding.

**Task 1: Initial Query**
```
Navigate to the homepage and submit:
"I'm launching a B2B SaaS product for enterprise sales teams.
We need help with brand strategy and a go-to-market campaign."
```

**What to observe:**
- [ ] User finds the query input easily
- [ ] User understands what to type
- [ ] Loading state is clear
- [ ] Results appear within reasonable time (<30 seconds)

**Expected Results:**
- Layout with relevant case studies (B2B, Technology, Brand Strategy)
- Clear explanation of approach
- Components render correctly (HeroBlock, CaseStudyTeaser, etc.)

**Questions to ask:**
- "Is this response relevant to your needs?"
- "Would you click on any of these case studies?"
- "Is anything confusing or unclear?"

---

**Task 2: Explore Case Study**
```
Click on one of the recommended case studies.
```

**What to observe:**
- [ ] User finds case study link
- [ ] Case study page loads correctly
- [ ] PDF displays properly
- [ ] Related articles/content shows

**Questions to ask:**
- "Is the PDF readable at this size?"
- "Would you want to download this PDF?"
- "Are the related articles helpful?"

---

**Task 3: Refine Search**
```
Go back and try a more specific query:
"Show me examples of SaaS companies you've helped with
rebranding and digital marketing."
```

**What to observe:**
- [ ] User knows how to submit a new query
- [ ] Results differ from first query
- [ ] Results are more specific

**Questions to ask:**
- "Did the results improve?"
- "Do you feel the AI understands your needs?"

---

### 🏥 Scenario 2: Healthcare Executive
**Context**: You're a CMO at a healthcare tech company expanding into new markets.

**Task 1: Industry-Specific Query**
```
"We're a healthcare technology company looking to launch
a new telemedicine platform. Need brand positioning and
content strategy."
```

**What to observe:**
- [ ] Healthcare/medical case studies appear
- [ ] Response addresses compliance/sensitive nature
- [ ] Tone is appropriate for industry

**Questions to ask:**
- "Do the examples feel relevant to healthcare?"
- "Does the AI seem to understand healthcare challenges?"

---

### 🛍️ Scenario 3: Consumer Brand Manager
**Context**: You manage a DTC consumer brand looking to grow on social media.

**Task 1: Social Media Focus**
```
"I run a direct-to-consumer fashion brand. We need help with
social media strategy and influencer marketing to reach Gen Z."
```

**What to observe:**
- [ ] Social media/content strategy examples appear
- [ ] Consumer/retail case studies shown
- [ ] Creative/visual components emphasized

**Questions to ask:**
- "Do you see examples that match your goals?"
- "Would you trust this AI to recommend an agency?"

---

## Edge Cases & Stress Tests

### Test 4: Vague Query
```
"Help me with marketing"
```

**Expected**: AI asks clarifying questions or provides broad examples

**What to observe:**
- [ ] System handles vague input gracefully
- [ ] Response provides guidance on being more specific

---

### Test 5: Very Long Query
```
"I'm the founder of a technology startup in the enterprise software
space focused on artificial intelligence and machine learning solutions
for data analytics in the financial services industry, and we're looking
to completely overhaul our brand identity, develop a comprehensive
go-to-market strategy, create a new website, launch social media
campaigns, produce video content, and establish thought leadership
through content marketing while also exploring experiential marketing
opportunities and event sponsorships."
```

**Expected**: System processes long query and extracts key points

**What to observe:**
- [ ] No errors or timeouts
- [ ] Response addresses main points
- [ ] Loading time is reasonable

---

### Test 6: Multiple Rapid Queries
```
Submit 5 queries in quick succession:
1. "Brand strategy for tech startup"
2. "Social media help"
3. "Video production"
4. "Website redesign"
5. "Content marketing"
```

**Expected**: Rate limiting kicks in gracefully after ~20 requests/min

**What to observe:**
- [ ] Rate limit message is clear
- [ ] System doesn't crash
- [ ] User understands what happened

---

### Test 7: Empty Query
```
Leave the query field empty and click submit.
```

**Expected**: Validation error or focus returns to input

**What to observe:**
- [ ] Helpful error message
- [ ] User understands what to do

---

### Test 8: Special Characters
```
"Brand strategy for startup!!! 🚀 #tech @article-group"
```

**Expected**: System handles special characters gracefully

---

## Mobile Testing

### Test 9: Mobile Experience
**Device**: iPhone/Android phone

**Tasks:**
- [ ] Homepage loads correctly
- [ ] Query input is easy to use on mobile keyboard
- [ ] Results are readable on small screen
- [ ] Case study PDFs work on mobile
- [ ] Navigation is intuitive

**Questions:**
- "Would you use this on your phone?"
- "Is anything hard to tap or read?"

---

## Performance Benchmarks

Track these metrics during testing:

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Query response time | < 10 seconds | | |
| Page load time | < 3 seconds | | |
| Case study page load | < 2 seconds | | |
| PDF display time | < 5 seconds | | |
| Mobile responsiveness | No horizontal scroll | | |

---

## User Satisfaction Questions

### After Testing (1-5 scale, 5 = strongly agree)

1. **Ease of Use**
   - "I found the interface intuitive and easy to navigate"
   - Score: ___

2. **Relevance**
   - "The AI recommendations matched my needs"
   - Score: ___

3. **Quality**
   - "The case studies and examples were high quality"
   - Score: ___

4. **Speed**
   - "The system responded quickly enough"
   - Score: ___

5. **Trust**
   - "I would trust this tool to help me find the right agency"
   - Score: ___

6. **Visual Design**
   - "The design looks professional and polished"
   - Score: ___

### Open-Ended Questions

1. **What did you like most about the experience?**

   _______________________________________________________

2. **What frustrated you or seemed confusing?**

   _______________________________________________________

3. **What would you change or improve?**

   _______________________________________________________

4. **Would you recommend this to a colleague? Why or why not?**

   _______________________________________________________

5. **On a scale of 1-10, how likely are you to use this tool for your business needs?**

   Score: ___ / 10

---

## Bug Reporting Template

If tester encounters issues:

```
BUG #___
Date: ____________
Tester: ____________
Browser: ____________ (Chrome/Safari/Firefox)
Device: ____________ (Desktop/Mobile)

ISSUE:
What happened?

STEPS TO REPRODUCE:
1.
2.
3.

EXPECTED:
What should have happened?

ACTUAL:
What actually happened?

SEVERITY:
[ ] Critical (blocks main functionality)
[ ] High (major feature broken)
[ ] Medium (minor feature issue)
[ ] Low (cosmetic/minor)

SCREENSHOT:
(attach if possible)
```

---

## Post-Test Debrief (Facilitator Notes)

### Key Insights
- What worked well?
- What needs immediate fixing?
- Surprising findings?

### Priority Issues
1. _________________ (Critical)
2. _________________ (High)
3. _________________ (Medium)

### User Quotes
> "_____________________________________________"

> "_____________________________________________"

### Next Steps
- [ ] Compile results from all testers
- [ ] Categorize feedback (UI, content, performance, etc.)
- [ ] Prioritize fixes
- [ ] Schedule follow-up testing if needed

---

## Quick Reference: Test Queries

Copy-paste these for consistent testing:

**Tech/SaaS:**
- "I'm launching a B2B SaaS product for enterprise sales teams"
- "Show me examples of tech startups you've rebranded"

**Healthcare:**
- "Healthcare technology company expanding into telemedicine"
- "Need brand positioning for medical device company"

**Consumer/Retail:**
- "Direct-to-consumer fashion brand, need social media strategy"
- "Food & beverage company launching new product line"

**Finance:**
- "Fintech startup needs brand strategy and digital marketing"
- "Investment firm rebrand and thought leadership content"

**General:**
- "Help me understand your capabilities"
- "Show me your best work"
- "I need a creative agency"

---

## Success Criteria

Test is successful if:
- [ ] 80%+ of users complete main flow without help
- [ ] 70%+ of users rate relevance 4/5 or higher
- [ ] 0 critical bugs found
- [ ] < 3 high-severity bugs found
- [ ] Response time < 10 seconds for 90% of queries
- [ ] Average satisfaction score > 4/5

---

## Contact

For questions about this test script:
- Technical issues: [Your Dev Team]
- Test coordination: [Your PM/QA Team]
